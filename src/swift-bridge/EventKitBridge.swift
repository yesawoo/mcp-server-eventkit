import EventKit
import Foundation
import SQLite3

// MARK: - Global State

/// Single EKEventStore instance (expensive to create)
private let eventStore = EKEventStore()

/// Track if we have calendar access
private var hasAccess = false

// MARK: - Response Structures

private struct SuccessResponse<T: Encodable>: Encodable {
    let success: Bool
    let data: T
}

private struct ErrorResponse: Encodable {
    let success: Bool
    let error: String
}

// MARK: - Helper Functions

/// Convert a Swift string to a C string that can be returned via FFI
/// Caller must free with ekb_free_string
private func toCString(_ string: String) -> UnsafeMutablePointer<CChar>? {
    return strdup(string)
}

/// Create a success JSON response
private func successResponse<T: Encodable>(_ data: T) -> UnsafeMutablePointer<CChar>? {
    let response = SuccessResponse(success: true, data: data)
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601

    guard let jsonData = try? encoder.encode(response),
        let jsonString = String(data: jsonData, encoding: .utf8)
    else {
        return errorResponse("Failed to encode response")
    }

    return toCString(jsonString)
}

/// Create an error JSON response
private func errorResponse(_ message: String) -> UnsafeMutablePointer<CChar>? {
    let response = ErrorResponse(success: false, error: message)
    let encoder = JSONEncoder()

    guard let jsonData = try? encoder.encode(response),
        let jsonString = String(data: jsonData, encoding: .utf8)
    else {
        // Fallback if encoding fails
        let json = """
            {"success":false,"error":"Failed to encode error message"}
            """
        return toCString(json)
    }

    return toCString(jsonString)
}

// MARK: - Reminder Model

private struct ReminderData: Codable {
    let id: String
    let title: String
    let notes: String?
    let isCompleted: Bool
    let completionDate: Date?
    let dueDate: Date?
    let priority: Int
    let creationDate: Date?
    let lastModifiedDate: Date?
    let isFlagged: Bool
    let hasRecurrenceRules: Bool
    let calendarId: String
    let calendarTitle: String
}

/// Convert EKReminder to our data model
/// Note: On macOS, isFlagged is simulated via priority > 0 (EKReminder.isFlagged is iOS only)
private func reminderToData(_ reminder: EKReminder) -> ReminderData {
    var dueDate: Date? = nil
    if let dueDateComponents = reminder.dueDateComponents {
        dueDate = Calendar.current.date(from: dueDateComponents)
    }

    // On macOS, flagged status is represented by priority > 0
    let isFlagged = reminder.priority > 0

    return ReminderData(
        id: reminder.calendarItemIdentifier,
        title: reminder.title ?? "",
        notes: reminder.notes,
        isCompleted: reminder.isCompleted,
        completionDate: reminder.completionDate,
        dueDate: dueDate,
        priority: reminder.priority,
        creationDate: reminder.creationDate,
        lastModifiedDate: reminder.lastModifiedDate,
        isFlagged: isFlagged,
        hasRecurrenceRules: reminder.hasRecurrenceRules,
        calendarId: reminder.calendar?.calendarIdentifier ?? "",
        calendarTitle: reminder.calendar?.title ?? ""
    )
}

// MARK: - FFI Exports

/// Request access to reminders
/// Returns: JSON {"success": true, "data": true} or error
@_cdecl("ekb_request_access")
public func ekb_request_access() -> UnsafeMutablePointer<CChar>? {
    let semaphore = DispatchSemaphore(value: 0)
    var accessGranted = false
    var accessError: Error? = nil

    if #available(macOS 14.0, *) {
        eventStore.requestFullAccessToReminders { granted, error in
            accessGranted = granted
            accessError = error
            semaphore.signal()
        }
    } else {
        eventStore.requestAccess(to: .reminder) { granted, error in
            accessGranted = granted
            accessError = error
            semaphore.signal()
        }
    }

    semaphore.wait()

    if let error = accessError {
        return errorResponse("Access denied: \(error.localizedDescription)")
    }

    hasAccess = accessGranted

    if accessGranted {
        return successResponse(true)
    } else {
        return errorResponse(
            "Access to Reminders was denied. Please grant access in System Preferences > Privacy & Security > Reminders"
        )
    }
}

/// List reminders
/// Parameters:
///   - completedOnly: if true, only return completed reminders; if false, only incomplete
/// Returns: JSON array of reminders
@_cdecl("ekb_list_reminders")
public func ekb_list_reminders(_ completedOnly: Bool) -> UnsafeMutablePointer<CChar>? {
    // Ensure we have access
    if !hasAccess {
        // Try to request access first
        let _ = ekb_request_access()
        if !hasAccess {
            return errorResponse("No access to Reminders. Call ekb_request_access first.")
        }
    }

    let calendars = eventStore.calendars(for: .reminder)
    let predicate = eventStore.predicateForReminders(in: calendars)

    let semaphore = DispatchSemaphore(value: 0)
    var fetchedReminders: [EKReminder] = []

    eventStore.fetchReminders(matching: predicate) { reminders in
        fetchedReminders = reminders ?? []
        semaphore.signal()
    }

    semaphore.wait()

    // Filter by completion status
    let filtered = fetchedReminders.filter { $0.isCompleted == completedOnly }
    let reminderDataList = filtered.map { reminderToData($0) }

    return successResponse(reminderDataList)
}

/// Create a new reminder
/// Parameters:
///   - jsonPtr: JSON string with {title, notes?, due_date?}
/// Returns: JSON with created reminder
@_cdecl("ekb_create_reminder")
public func ekb_create_reminder(_ jsonPtr: UnsafePointer<CChar>?) -> UnsafeMutablePointer<CChar>? {
    guard let jsonPtr = jsonPtr else {
        return errorResponse("Invalid input: null pointer")
    }

    // Ensure we have access
    if !hasAccess {
        let _ = ekb_request_access()
        if !hasAccess {
            return errorResponse("No access to Reminders. Call ekb_request_access first.")
        }
    }

    let jsonString = String(cString: jsonPtr)

    struct CreateParams: Decodable {
        let title: String
        let notes: String?
        let due_date: String?
    }

    guard let jsonData = jsonString.data(using: .utf8) else {
        return errorResponse("Invalid JSON encoding")
    }

    let decoder = JSONDecoder()
    let params: CreateParams
    do {
        params = try decoder.decode(CreateParams.self, from: jsonData)
    } catch {
        return errorResponse("Failed to parse JSON: \(error.localizedDescription)")
    }

    // Get default calendar
    guard let calendar = eventStore.defaultCalendarForNewReminders() else {
        return errorResponse(
            "No default calendar for reminders. Please create a Reminders list first.")
    }

    // Create reminder
    let reminder = EKReminder(eventStore: eventStore)
    reminder.calendar = calendar
    reminder.title = params.title
    reminder.notes = params.notes

    // Parse due date if provided
    if let dueDateString = params.due_date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: dueDateString) {
            reminder.dueDateComponents = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute],
                from: date
            )
        } else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: dueDateString) {
                reminder.dueDateComponents = Calendar.current.dateComponents(
                    [.year, .month, .day, .hour, .minute],
                    from: date
                )
            }
        }
    }

    // Save
    do {
        try eventStore.save(reminder, commit: true)
    } catch {
        return errorResponse("Failed to save reminder: \(error.localizedDescription)")
    }

    return successResponse(reminderToData(reminder))
}

/// Mark a reminder as completed
/// Parameters:
///   - idPtr: reminder ID string
/// Returns: JSON with updated reminder
@_cdecl("ekb_complete_reminder")
public func ekb_complete_reminder(_ idPtr: UnsafePointer<CChar>?) -> UnsafeMutablePointer<CChar>? {
    guard let idPtr = idPtr else {
        return errorResponse("Invalid input: null pointer")
    }

    // Ensure we have access
    if !hasAccess {
        let _ = ekb_request_access()
        if !hasAccess {
            return errorResponse("No access to Reminders. Call ekb_request_access first.")
        }
    }

    let reminderId = String(cString: idPtr)

    // Fetch the reminder
    guard let reminder = eventStore.calendarItem(withIdentifier: reminderId) as? EKReminder else {
        return errorResponse("Reminder not found with ID: \(reminderId)")
    }

    // Mark as completed
    reminder.isCompleted = true
    reminder.completionDate = Date()

    // Save
    do {
        try eventStore.save(reminder, commit: true)
    } catch {
        return errorResponse("Failed to save reminder: \(error.localizedDescription)")
    }

    return successResponse(reminderToData(reminder))
}

/// Delete a reminder permanently
/// Parameters:
///   - idPtr: reminder ID string
/// Returns: JSON with success status
@_cdecl("ekb_delete_reminder")
public func ekb_delete_reminder(_ idPtr: UnsafePointer<CChar>?) -> UnsafeMutablePointer<CChar>? {
    guard let idPtr = idPtr else {
        return errorResponse("Invalid input: null pointer")
    }

    // Ensure we have access
    if !hasAccess {
        let _ = ekb_request_access()
        if !hasAccess {
            return errorResponse("No access to Reminders. Call ekb_request_access first.")
        }
    }

    let reminderId = String(cString: idPtr)

    // Fetch the reminder
    guard let reminder = eventStore.calendarItem(withIdentifier: reminderId) as? EKReminder else {
        return errorResponse("Reminder not found with ID: \(reminderId)")
    }

    // Delete
    do {
        try eventStore.remove(reminder, commit: true)
    } catch {
        return errorResponse("Failed to delete reminder: \(error.localizedDescription)")
    }

    return successResponse(true)
}

/// Update an existing reminder
/// Parameters:
///   - idPtr: reminder ID string
///   - jsonPtr: JSON string with fields to update {title?, notes?, due_date?, priority?}
/// Returns: JSON with updated reminder
@_cdecl("ekb_update_reminder")
public func ekb_update_reminder(_ idPtr: UnsafePointer<CChar>?, _ jsonPtr: UnsafePointer<CChar>?)
    -> UnsafeMutablePointer<CChar>?
{
    guard let idPtr = idPtr, let jsonPtr = jsonPtr else {
        return errorResponse("Invalid input: null pointer")
    }

    // Ensure we have access
    if !hasAccess {
        let _ = ekb_request_access()
        if !hasAccess {
            return errorResponse("No access to Reminders. Call ekb_request_access first.")
        }
    }

    let reminderId = String(cString: idPtr)
    let jsonString = String(cString: jsonPtr)

    // Fetch the reminder
    guard let reminder = eventStore.calendarItem(withIdentifier: reminderId) as? EKReminder else {
        return errorResponse("Reminder not found with ID: \(reminderId)")
    }

    struct UpdateParams: Decodable {
        let title: String?
        let notes: String?
        let due_date: String?
        let priority: Int?
    }

    guard let jsonData = jsonString.data(using: .utf8) else {
        return errorResponse("Invalid JSON encoding")
    }

    let decoder = JSONDecoder()
    let params: UpdateParams
    do {
        params = try decoder.decode(UpdateParams.self, from: jsonData)
    } catch {
        return errorResponse("Failed to parse JSON: \(error.localizedDescription)")
    }

    // Update fields if provided
    if let title = params.title {
        reminder.title = title
    }

    if let notes = params.notes {
        reminder.notes = notes
    }

    if let priority = params.priority {
        reminder.priority = priority
    }

    // Parse due date if provided
    if let dueDateString = params.due_date {
        if dueDateString.isEmpty {
            // Clear due date
            reminder.dueDateComponents = nil
        } else {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

            if let date = formatter.date(from: dueDateString) {
                reminder.dueDateComponents = Calendar.current.dateComponents(
                    [.year, .month, .day, .hour, .minute],
                    from: date
                )
            } else {
                // Try without fractional seconds
                formatter.formatOptions = [.withInternetDateTime]
                if let date = formatter.date(from: dueDateString) {
                    reminder.dueDateComponents = Calendar.current.dateComponents(
                        [.year, .month, .day, .hour, .minute],
                        from: date
                    )
                }
            }
        }
    }

    // Save
    do {
        try eventStore.save(reminder, commit: true)
    } catch {
        return errorResponse("Failed to save reminder: \(error.localizedDescription)")
    }

    return successResponse(reminderToData(reminder))
}

/// Search reminders by text in title or notes with optional filters
/// Parameters:
///   - jsonPtr: JSON with {query, completed?, flagged?, priority_min?, priority_max?, calendar_id?, due_before?, due_after?, has_due_date?, search_in?}
/// Returns: JSON array of matching reminders
@_cdecl("ekb_search_reminders")
public func ekb_search_reminders(_ jsonPtr: UnsafePointer<CChar>?)
    -> UnsafeMutablePointer<CChar>?
{
    guard let jsonPtr = jsonPtr else {
        return errorResponse("Invalid input: null pointer")
    }

    // Ensure we have access
    if !hasAccess {
        let _ = ekb_request_access()
        if !hasAccess {
            return errorResponse("No access to Reminders. Call ekb_request_access first.")
        }
    }

    let jsonString = String(cString: jsonPtr)

    struct SearchParams: Decodable {
        let query: String
        let completed: Bool?
        let flagged: Bool?
        let priority_min: Int?
        let priority_max: Int?
        let calendar_id: String?
        let due_before: String?  // ISO 8601
        let due_after: String?  // ISO 8601
        let has_due_date: Bool?
        let search_in: String?  // "title", "notes", or "both" (default)
    }

    guard let jsonData = jsonString.data(using: .utf8) else {
        return errorResponse("Invalid JSON encoding")
    }

    let decoder = JSONDecoder()
    let params: SearchParams
    do {
        params = try decoder.decode(SearchParams.self, from: jsonData)
    } catch {
        return errorResponse("Failed to parse JSON: \(error.localizedDescription)")
    }

    let query = params.query.lowercased()
    let searchIn = params.search_in ?? "both"

    // Parse date filters
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]

    var dueBefore: Date? = nil
    var dueAfter: Date? = nil

    if let dueBeforeStr = params.due_before {
        dueBefore = formatter.date(from: dueBeforeStr)
    }
    if let dueAfterStr = params.due_after {
        dueAfter = formatter.date(from: dueAfterStr)
    }

    let calendars = eventStore.calendars(for: .reminder)
    let predicate = eventStore.predicateForReminders(in: calendars)

    let semaphore = DispatchSemaphore(value: 0)
    var fetchedReminders: [EKReminder] = []

    eventStore.fetchReminders(matching: predicate) { reminders in
        fetchedReminders = reminders ?? []
        semaphore.signal()
    }

    semaphore.wait()

    // Apply all filters
    let filtered = fetchedReminders.filter { reminder in
        // Text search filter
        let titleMatch =
            searchIn != "notes" && (reminder.title?.lowercased().contains(query) ?? false)
        let notesMatch =
            searchIn != "title" && (reminder.notes?.lowercased().contains(query) ?? false)

        if !titleMatch && !notesMatch {
            return false
        }

        // Completion status filter
        if let completed = params.completed {
            if reminder.isCompleted != completed {
                return false
            }
        }

        // Flagged filter (priority > 0 on macOS)
        if let flagged = params.flagged {
            if (reminder.priority > 0) != flagged {
                return false
            }
        }

        // Priority filters
        if let priorityMin = params.priority_min {
            if reminder.priority < priorityMin {
                return false
            }
        }
        if let priorityMax = params.priority_max {
            if reminder.priority > priorityMax {
                return false
            }
        }

        // Calendar filter
        if let calendarId = params.calendar_id {
            if reminder.calendar?.calendarIdentifier != calendarId {
                return false
            }
        }

        // Has due date filter
        if let hasDueDate = params.has_due_date {
            let reminderHasDueDate = reminder.dueDateComponents != nil
            if reminderHasDueDate != hasDueDate {
                return false
            }
        }

        // Due date range filters
        if dueBefore != nil || dueAfter != nil {
            guard let dueDateComponents = reminder.dueDateComponents,
                let dueDate = Calendar.current.date(from: dueDateComponents)
            else {
                return false  // No due date, can't match date range
            }

            if let before = dueBefore {
                if dueDate >= before {
                    return false
                }
            }
            if let after = dueAfter {
                if dueDate <= after {
                    return false
                }
            }
        }

        return true
    }

    let reminderDataList = filtered.map { reminderToData($0) }
    return successResponse(reminderDataList)
}

/// List reminders with advanced filters
/// Parameters:
///   - jsonPtr: JSON with filters {completed?, flagged?, priority_min?, priority_max?, calendar_id?}
/// Returns: JSON array of reminders
@_cdecl("ekb_list_reminders_filtered")
public func ekb_list_reminders_filtered(_ jsonPtr: UnsafePointer<CChar>?) -> UnsafeMutablePointer<
    CChar
>? {
    guard let jsonPtr = jsonPtr else {
        return errorResponse("Invalid input: null pointer")
    }

    // Ensure we have access
    if !hasAccess {
        let _ = ekb_request_access()
        if !hasAccess {
            return errorResponse("No access to Reminders. Call ekb_request_access first.")
        }
    }

    let jsonString = String(cString: jsonPtr)

    struct FilterParams: Decodable {
        let completed: Bool?
        let flagged: Bool?
        let priority_min: Int?
        let priority_max: Int?
        let calendar_id: String?
    }

    guard let jsonData = jsonString.data(using: .utf8) else {
        return errorResponse("Invalid JSON encoding")
    }

    let decoder = JSONDecoder()
    let params: FilterParams
    do {
        params = try decoder.decode(FilterParams.self, from: jsonData)
    } catch {
        return errorResponse("Failed to parse JSON: \(error.localizedDescription)")
    }

    let calendars = eventStore.calendars(for: .reminder)
    let predicate = eventStore.predicateForReminders(in: calendars)

    let semaphore = DispatchSemaphore(value: 0)
    var fetchedReminders: [EKReminder] = []

    eventStore.fetchReminders(matching: predicate) { reminders in
        fetchedReminders = reminders ?? []
        semaphore.signal()
    }

    semaphore.wait()

    // Apply filters
    var filtered = fetchedReminders

    if let completed = params.completed {
        filtered = filtered.filter { $0.isCompleted == completed }
    }

    if let flagged = params.flagged {
        // On macOS, flagged = priority > 0
        filtered = filtered.filter { ($0.priority > 0) == flagged }
    }

    if let priorityMin = params.priority_min {
        filtered = filtered.filter { $0.priority >= priorityMin }
    }

    if let priorityMax = params.priority_max {
        filtered = filtered.filter { $0.priority <= priorityMax }
    }

    if let calendarId = params.calendar_id {
        filtered = filtered.filter { $0.calendar?.calendarIdentifier == calendarId }
    }

    let reminderDataList = filtered.map { reminderToData($0) }
    return successResponse(reminderDataList)
}

/// Toggle the flagged status of a reminder
/// Parameters:
///   - idPtr: reminder ID string
/// Returns: JSON with updated reminder
@_cdecl("ekb_toggle_flag")
public func ekb_toggle_flag(_ idPtr: UnsafePointer<CChar>?) -> UnsafeMutablePointer<CChar>? {
    guard let idPtr = idPtr else {
        return errorResponse("Invalid input: null pointer")
    }

    // Ensure we have access
    if !hasAccess {
        let _ = ekb_request_access()
        if !hasAccess {
            return errorResponse("No access to Reminders. Call ekb_request_access first.")
        }
    }

    let reminderId = String(cString: idPtr)

    // Fetch the reminder
    guard let reminder = eventStore.calendarItem(withIdentifier: reminderId) as? EKReminder else {
        return errorResponse("Reminder not found with ID: \(reminderId)")
    }

    // Toggle flag (on macOS, flag is represented by priority)
    // If currently flagged (priority > 0), set to 0; otherwise set to 1
    let currentlyFlagged = reminder.priority > 0
    reminder.priority = currentlyFlagged ? 0 : 1

    // Save
    do {
        try eventStore.save(reminder, commit: true)
    } catch {
        return errorResponse("Failed to save reminder: \(error.localizedDescription)")
    }

    return successResponse(reminderToData(reminder))
}

/// List all reminder calendars/lists
/// Returns: JSON array of calendars
@_cdecl("ekb_list_calendars")
public func ekb_list_calendars() -> UnsafeMutablePointer<CChar>? {
    // Ensure we have access
    if !hasAccess {
        let _ = ekb_request_access()
        if !hasAccess {
            return errorResponse("No access to Reminders. Call ekb_request_access first.")
        }
    }

    struct CalendarData: Codable {
        let id: String
        let title: String
        let color: String
        let isDefault: Bool
    }

    let calendars = eventStore.calendars(for: .reminder)
    let defaultCalendar = eventStore.defaultCalendarForNewReminders()

    let calendarDataList = calendars.map { calendar in
        // Convert CGColor to hex string
        var colorHex = "#007AFF"  // default blue
        if let cgColor = calendar.cgColor {
            let components = cgColor.components ?? [0, 0, 0, 1]
            if components.count >= 3 {
                let r = Int(components[0] * 255)
                let g = Int(components[1] * 255)
                let b = Int(components[2] * 255)
                colorHex = String(format: "#%02X%02X%02X", r, g, b)
            }
        }

        return CalendarData(
            id: calendar.calendarIdentifier,
            title: calendar.title,
            color: colorHex,
            isDefault: calendar.calendarIdentifier == defaultCalendar?.calendarIdentifier
        )
    }

    return successResponse(calendarDataList)
}

/// Free a string allocated by this library
@_cdecl("ekb_free_string")
public func ekb_free_string(_ ptr: UnsafeMutablePointer<CChar>?) {
    if let ptr = ptr {
        free(ptr)
    }
}

// MARK: - SQLite Tag Support

/// Find the Reminders SQLite database path dynamically
/// Searches multiple possible locations as the path varies by macOS version
private func findRemindersDatabasePath() -> String? {
    let homeDir = FileManager.default.homeDirectoryForCurrentUser

    // Possible locations for the Reminders database (varies by macOS version)
    let possiblePaths = [
        // macOS Sonoma+ / Group Containers
        homeDir.appendingPathComponent(
            "Library/Group Containers/group.com.apple.reminders/Container_v1/Stores"),
        // Older location
        homeDir.appendingPathComponent("Library/Reminders/Container_v1/Stores"),
        // Another possible location
        homeDir.appendingPathComponent("Library/Group Containers/group.com.apple.reminders"),
    ]

    for storesDir in possiblePaths {
        guard
            let contents = try? FileManager.default.contentsOfDirectory(
                at: storesDir,
                includingPropertiesForKeys: nil
            )
        else {
            continue
        }

        // Find Data-*.sqlite file
        for url in contents {
            let filename = url.lastPathComponent
            if filename.hasPrefix("Data-") && filename.hasSuffix(".sqlite") {
                return url.path
            }
            // Also check for Container.sqlite which is used in some versions
            if filename == "Container.sqlite" {
                return url.path
            }
        }
    }

    return nil
}

/// Read-only access to Reminders SQLite database for tag queries
private class RemindersDatabase {
    private var db: OpaquePointer?

    init?(path: String) {
        // CRITICAL: Open in READ-ONLY mode to prevent any corruption
        let flags = SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(path, &db, flags, nil) == SQLITE_OK else {
            if let db = db {
                sqlite3_close(db)
            }
            return nil
        }
    }

    deinit {
        if let db = db {
            sqlite3_close(db)
        }
    }

    /// List all unique tags with reminder counts
    func listTags() -> [(name: String, count: Int)] {
        var tags: [(String, Int)] = []

        // Query tags from ZREMCDHASHTAGLABEL table
        // Join with ZREMCDOBJECT to count reminders per tag
        let query = """
                SELECT
                    hl.ZNAME as tag_name,
                    COUNT(DISTINCT ho.ZREMINDER) as reminder_count
                FROM ZREMCDHASHTAGLABEL hl
                LEFT JOIN ZREMCDOBJECT ho ON ho.ZHASHTAG = hl.Z_PK
                WHERE hl.ZNAME IS NOT NULL
                GROUP BY hl.ZNAME
                ORDER BY hl.ZNAME COLLATE NOCASE
            """

        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
            while sqlite3_step(statement) == SQLITE_ROW {
                if let namePtr = sqlite3_column_text(statement, 0) {
                    let name = String(cString: namePtr)
                    let count = Int(sqlite3_column_int(statement, 1))
                    tags.append((name: name, count: count))
                }
            }
        }

        sqlite3_finalize(statement)
        return tags
    }

    /// Find reminder IDs (CloudKit identifiers) that have a specific tag
    func getReminderIdsWithTag(_ tagName: String) -> [String] {
        var ids: [String] = []

        // Query to find reminders with a specific tag
        // ZCKIDENTIFIER correlates with EventKit's calendarItemIdentifier
        let query = """
                SELECT DISTINCT r.ZCKIDENTIFIER
                FROM ZREMCDOBJECT r
                INNER JOIN ZREMCDOBJECT ho ON ho.ZREMINDER = r.Z_PK
                INNER JOIN ZREMCDHASHTAGLABEL hl ON hl.Z_PK = ho.ZHASHTAG
                WHERE hl.ZNAME = ? COLLATE NOCASE
                AND r.ZCKIDENTIFIER IS NOT NULL
            """

        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
            // Bind tag name parameter (prevents SQL injection)
            sqlite3_bind_text(statement, 1, tagName, -1, nil)

            while sqlite3_step(statement) == SQLITE_ROW {
                if let idPtr = sqlite3_column_text(statement, 0) {
                    ids.append(String(cString: idPtr))
                }
            }
        }

        sqlite3_finalize(statement)
        return ids
    }
}

// MARK: - Tag Data Model

private struct TagData: Codable {
    let name: String
    let reminderCount: Int
}

// MARK: - Tag FFI Exports

/// List all unique tags from the Reminders SQLite database
/// Returns: JSON {"success": true, "data": [{"name": "tag", "reminderCount": 5}, ...]}
@_cdecl("ekb_list_tags")
public func ekb_list_tags() -> UnsafeMutablePointer<CChar>? {
    // Find database path
    guard let dbPath = findRemindersDatabasePath() else {
        return errorResponse(
            "Reminders database not found. " + "This feature requires Full Disk Access permission. "
                + "Go to System Settings > Privacy & Security > Full Disk Access and add your terminal app."
        )
    }

    // Open database in read-only mode
    guard let db = RemindersDatabase(path: dbPath) else {
        return errorResponse(
            "Failed to open Reminders database at: \(dbPath). "
                + "Ensure Full Disk Access is granted in System Settings > Privacy & Security > Full Disk Access."
        )
    }

    let tagTuples = db.listTags()
    let tags = tagTuples.map { TagData(name: $0.name, reminderCount: $0.count) }

    return successResponse(tags)
}

/// Get reminder IDs that have a specific tag
/// Parameters:
///   - tagNamePtr: Tag name to search for (without # prefix)
/// Returns: JSON array of reminder IDs
@_cdecl("ekb_get_reminders_by_tag")
public func ekb_get_reminders_by_tag(_ tagNamePtr: UnsafePointer<CChar>?) -> UnsafeMutablePointer<
    CChar
>? {
    guard let tagNamePtr = tagNamePtr else {
        return errorResponse("Invalid input: null pointer")
    }

    let tagName = String(cString: tagNamePtr)

    // Find database
    guard let dbPath = findRemindersDatabasePath() else {
        return errorResponse(
            "Reminders database not found. Full Disk Access required. "
                + "Go to System Settings > Privacy & Security > Full Disk Access."
        )
    }

    // Open database
    guard let db = RemindersDatabase(path: dbPath) else {
        return errorResponse(
            "Failed to open Reminders database. Full Disk Access required."
        )
    }

    let reminderIds = db.getReminderIdsWithTag(tagName)
    return successResponse(reminderIds)
}

// MARK: - Calendar Event Model

private struct CalendarEventData: Codable {
    let id: String
    let title: String
    let notes: String?
    let startDate: Date
    let endDate: Date
    let isAllDay: Bool
    let location: String?
    let url: String?
    let hasAlarms: Bool
    let hasRecurrenceRules: Bool
    let calendarId: String
    let calendarTitle: String
    let availability: String
    let status: String
}

/// Convert EKEvent to our data model
private func eventToData(_ event: EKEvent) -> CalendarEventData {
    let availability: String
    switch event.availability {
    case .notSupported: availability = "notSupported"
    case .busy: availability = "busy"
    case .free: availability = "free"
    case .tentative: availability = "tentative"
    case .unavailable: availability = "unavailable"
    @unknown default: availability = "unknown"
    }

    let status: String
    switch event.status {
    case .none: status = "none"
    case .confirmed: status = "confirmed"
    case .tentative: status = "tentative"
    case .canceled: status = "canceled"
    @unknown default: status = "unknown"
    }

    return CalendarEventData(
        id: event.eventIdentifier ?? "",
        title: event.title ?? "",
        notes: event.notes,
        startDate: event.startDate,
        endDate: event.endDate,
        isAllDay: event.isAllDay,
        location: event.location,
        url: event.url?.absoluteString,
        hasAlarms: event.hasAlarms,
        hasRecurrenceRules: event.hasRecurrenceRules,
        calendarId: event.calendar?.calendarIdentifier ?? "",
        calendarTitle: event.calendar?.title ?? "",
        availability: availability,
        status: status
    )
}

private struct EventCalendarData: Codable {
    let id: String
    let title: String
    let color: String
    let isSubscribed: Bool
    let isImmutable: Bool
    let allowsContentModifications: Bool
    let source: String
}

// MARK: - Calendar Access

private var hasCalendarAccess = false

/// Request access to calendar events
@_cdecl("ekb_request_calendar_access")
public func ekb_request_calendar_access() -> UnsafeMutablePointer<CChar>? {
    let semaphore = DispatchSemaphore(value: 0)
    var accessGranted = false
    var accessError: Error? = nil

    if #available(macOS 14.0, *) {
        eventStore.requestFullAccessToEvents { granted, error in
            accessGranted = granted
            accessError = error
            semaphore.signal()
        }
    } else {
        eventStore.requestAccess(to: .event) { granted, error in
            accessGranted = granted
            accessError = error
            semaphore.signal()
        }
    }

    semaphore.wait()

    if let error = accessError {
        return errorResponse("Calendar access denied: \(error.localizedDescription)")
    }

    hasCalendarAccess = accessGranted

    if accessGranted {
        return successResponse(true)
    } else {
        return errorResponse(
            "Access to Calendar was denied. Please grant access in System Preferences > Privacy & Security > Calendars"
        )
    }
}

// MARK: - List Event Calendars

@_cdecl("ekb_list_event_calendars")
public func ekb_list_event_calendars() -> UnsafeMutablePointer<CChar>? {
    let calendars = eventStore.calendars(for: .event)

    let calendarDataList = calendars.map { cal -> EventCalendarData in
        // Convert color to hex string
        let color: String
        if let cgColor = cal.cgColor, let components = cgColor.components {
            if components.count >= 3 {
                let r = Int(components[0] * 255)
                let g = Int(components[1] * 255)
                let b = Int(components[2] * 255)
                color = String(format: "#%02X%02X%02X", r, g, b)
            } else {
                color = "#808080"
            }
        } else {
            color = "#808080"
        }

        return EventCalendarData(
            id: cal.calendarIdentifier,
            title: cal.title,
            color: color,
            isSubscribed: cal.isSubscribed,
            isImmutable: cal.isImmutable,
            allowsContentModifications: cal.allowsContentModifications,
            source: cal.source?.title ?? ""
        )
    }

    return successResponse(calendarDataList)
}

// MARK: - List Calendar Events

private struct ListEventsInput: Codable {
    let startDate: Date
    let endDate: Date
    let calendarIds: [String]?
}

@_cdecl("ekb_list_calendar_events")
public func ekb_list_calendar_events(_ inputPtr: UnsafePointer<CChar>?) -> UnsafeMutablePointer<
    CChar
>? {
    guard let inputPtr = inputPtr else {
        return errorResponse("Invalid input: null pointer")
    }

    let inputString = String(cString: inputPtr)
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601

    guard let inputData = inputString.data(using: .utf8),
        let input = try? decoder.decode(ListEventsInput.self, from: inputData)
    else {
        return errorResponse("Invalid input: failed to parse JSON")
    }

    // Get calendars to search
    var calendars: [EKCalendar]?
    if let calendarIds = input.calendarIds, !calendarIds.isEmpty {
        calendars = eventStore.calendars(for: .event).filter {
            calendarIds.contains($0.calendarIdentifier)
        }
    }

    // Create predicate for events
    let predicate = eventStore.predicateForEvents(
        withStart: input.startDate,
        end: input.endDate,
        calendars: calendars
    )

    let events = eventStore.events(matching: predicate)
    let eventDataList = events.map { eventToData($0) }

    return successResponse(eventDataList)
}

// MARK: - Create Calendar Event

private struct CreateEventInput: Codable {
    let title: String
    let startDate: Date
    let endDate: Date
    let calendarId: String?
    let notes: String?
    let location: String?
    let url: String?
    let isAllDay: Bool?
}

@_cdecl("ekb_create_calendar_event")
public func ekb_create_calendar_event(_ inputPtr: UnsafePointer<CChar>?) -> UnsafeMutablePointer<
    CChar
>? {
    guard let inputPtr = inputPtr else {
        return errorResponse("Invalid input: null pointer")
    }

    let inputString = String(cString: inputPtr)
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601

    guard let inputData = inputString.data(using: .utf8),
        let input = try? decoder.decode(CreateEventInput.self, from: inputData)
    else {
        return errorResponse("Invalid input: failed to parse JSON")
    }

    let event = EKEvent(eventStore: eventStore)
    event.title = input.title
    event.startDate = input.startDate
    event.endDate = input.endDate
    event.notes = input.notes
    event.location = input.location
    event.isAllDay = input.isAllDay ?? false

    if let urlString = input.url, let url = URL(string: urlString) {
        event.url = url
    }

    // Set calendar
    if let calendarId = input.calendarId,
        let calendar = eventStore.calendars(for: .event).first(where: {
            $0.calendarIdentifier == calendarId
        })
    {
        event.calendar = calendar
    } else {
        event.calendar = eventStore.defaultCalendarForNewEvents
    }

    do {
        try eventStore.save(event, span: .thisEvent)
        return successResponse(eventToData(event))
    } catch {
        return errorResponse("Failed to create event: \(error.localizedDescription)")
    }
}

// MARK: - Update Calendar Event

private struct UpdateEventInput: Codable {
    let id: String
    let title: String?
    let startDate: Date?
    let endDate: Date?
    let notes: String?
    let location: String?
    let url: String?
    let isAllDay: Bool?
    let calendarId: String?
}

@_cdecl("ekb_update_calendar_event")
public func ekb_update_calendar_event(_ inputPtr: UnsafePointer<CChar>?) -> UnsafeMutablePointer<
    CChar
>? {
    guard let inputPtr = inputPtr else {
        return errorResponse("Invalid input: null pointer")
    }

    let inputString = String(cString: inputPtr)
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601

    guard let inputData = inputString.data(using: .utf8),
        let input = try? decoder.decode(UpdateEventInput.self, from: inputData)
    else {
        return errorResponse("Invalid input: failed to parse JSON")
    }

    guard let event = eventStore.event(withIdentifier: input.id) else {
        return errorResponse("Event not found with ID: \(input.id)")
    }

    // Update fields if provided
    if let title = input.title { event.title = title }
    if let startDate = input.startDate { event.startDate = startDate }
    if let endDate = input.endDate { event.endDate = endDate }
    if let notes = input.notes { event.notes = notes }
    if let location = input.location { event.location = location }
    if let isAllDay = input.isAllDay { event.isAllDay = isAllDay }

    if let urlString = input.url {
        event.url = urlString.isEmpty ? nil : URL(string: urlString)
    }

    if let calendarId = input.calendarId,
        let calendar = eventStore.calendars(for: .event).first(where: {
            $0.calendarIdentifier == calendarId
        })
    {
        event.calendar = calendar
    }

    do {
        try eventStore.save(event, span: .thisEvent)
        return successResponse(eventToData(event))
    } catch {
        return errorResponse("Failed to update event: \(error.localizedDescription)")
    }
}

// MARK: - Delete Calendar Event

@_cdecl("ekb_delete_calendar_event")
public func ekb_delete_calendar_event(_ eventIdPtr: UnsafePointer<CChar>?) -> UnsafeMutablePointer<
    CChar
>? {
    guard let eventIdPtr = eventIdPtr else {
        return errorResponse("Invalid input: null pointer")
    }

    let eventId = String(cString: eventIdPtr)

    guard let event = eventStore.event(withIdentifier: eventId) else {
        return errorResponse("Event not found with ID: \(eventId)")
    }

    do {
        try eventStore.remove(event, span: .thisEvent)
        return successResponse(true)
    } catch {
        return errorResponse("Failed to delete event: \(error.localizedDescription)")
    }
}

// MARK: - Permission Status

private struct PermissionStatus: Codable {
    let calendars: String
    let reminders: String
    let calendarsGranted: Bool
    let remindersGranted: Bool
}

/// Check authorization status without requesting
/// Returns: JSON with permission status for calendars and reminders
@_cdecl("ekb_check_permissions")
public func ekb_check_permissions() -> UnsafeMutablePointer<CChar>? {
    let calendarStatus = EKEventStore.authorizationStatus(for: .event)
    let reminderStatus = EKEventStore.authorizationStatus(for: .reminder)

    func statusToString(_ status: EKAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .fullAccess: return "fullAccess"
        case .writeOnly: return "writeOnly"
        @unknown default: return "unknown"
        }
    }

    func isGranted(_ status: EKAuthorizationStatus) -> Bool {
        switch status {
        case .authorized, .fullAccess: return true
        default: return false
        }
    }

    let status = PermissionStatus(
        calendars: statusToString(calendarStatus),
        reminders: statusToString(reminderStatus),
        calendarsGranted: isGranted(calendarStatus),
        remindersGranted: isGranted(reminderStatus)
    )

    return successResponse(status)
}
