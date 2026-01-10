/**
 * EventKit Bridge - FFI interface to Swift EventKit module
 *
 * Uses Bun's FFI with 'as const' for proper TypeScript type inference.
 * @see https://bun.sh/docs/api/ffi
 */
import { dlopen, FFIType, ptr, CString } from "bun:ffi";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

// =============================================================================
// Types for the bridge responses
// =============================================================================

export interface Reminder {
  id: string;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  completionDate: string | null;
  dueDate: string | null;
  priority: number;
  creationDate: string | null;
  lastModifiedDate: string | null;
  isFlagged: boolean;
  hasRecurrenceRules: boolean;
  calendarId: string;
  calendarTitle: string;
}

export interface ReminderCalendar {
  id: string;
  title: string;
  color: string;
  isDefault: boolean;
}

export interface Tag {
  name: string;
  reminderCount: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  notes: string | null;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  location: string | null;
  url: string | null;
  hasAlarms: boolean;
  hasRecurrenceRules: boolean;
  calendarId: string;
  calendarTitle: string;
  availability: string;
  status: string;
}

export interface EventCalendar {
  id: string;
  title: string;
  color: string;
  isSubscribed: boolean;
  isImmutable: boolean;
  allowsContentModifications: boolean;
  source: string;
}

export interface PermissionStatus {
  calendars: string;
  reminders: string;
  calendarsGranted: boolean;
  remindersGranted: boolean;
}

// =============================================================================
// Parameter types for bridge methods
// =============================================================================

export interface ListCalendarEventsParams {
  startDate: string;
  endDate: string;
  calendarIds?: string[];
}

export interface CreateCalendarEventParams {
  title: string;
  startDate: string;
  endDate: string;
  calendarId?: string;
  notes?: string;
  location?: string;
  url?: string;
  isAllDay?: boolean;
}

export interface UpdateCalendarEventParams {
  id: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  location?: string;
  url?: string;
  isAllDay?: boolean;
  calendarId?: string;
}

export interface ListRemindersFilterParams {
  completed?: boolean;
  flagged?: boolean;
  priority_min?: number;
  priority_max?: number;
  calendar_id?: string;
}

export interface SearchRemindersParams {
  query: string;
  completed?: boolean;
  flagged?: boolean;
  priority_min?: number;
  priority_max?: number;
  calendar_id?: string;
  due_before?: string;
  due_after?: string;
  has_due_date?: boolean;
  search_in?: "title" | "notes" | "both";
}

export interface CreateReminderParams {
  title: string;
  notes?: string;
  due_date?: string;
}

export interface UpdateReminderParams {
  title?: string;
  notes?: string;
  due_date?: string;
  priority?: number;
}

interface BridgeResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// Library loading
// =============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Find the native library in possible locations
 */
function findLibrary(): string {
  const possiblePaths = [
    // App bundle Frameworks directory (installed via .pkg)
    "/Applications/MCP EventKit.app/Contents/Frameworks/libEventKitBridge.dylib",
    // Relative to executable in app bundle (Contents/MacOS/../Frameworks)
    join(process.execPath, "../Frameworks/libEventKitBridge.dylib"),
    // Legacy installed location
    "/usr/local/lib/mcp-eventkit/libEventKitBridge.dylib",
    // Development location
    join(__dirname, "../../build/libEventKitBridge.dylib"),
    // Same directory as binary (for compiled standalone)
    join(__dirname, "libEventKitBridge.dylib"),
    // Relative to executable (legacy)
    join(process.execPath, "../libEventKitBridge.dylib"),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  // Fallback to installed path
  return possiblePaths[0];
}

const libPath = findLibrary();
console.error(`[eventkit-bridge] Loading library from: ${libPath}`);

// =============================================================================
// FFI Symbol definitions with 'as const' for type inference
// =============================================================================

const ffiSymbols = {
  // Reminder functions
  ekb_request_access: {
    args: [],
    returns: FFIType.ptr,
  },
  ekb_list_reminders: {
    args: [FFIType.bool],
    returns: FFIType.ptr,
  },
  ekb_create_reminder: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  ekb_complete_reminder: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  ekb_update_reminder: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.ptr,
  },
  ekb_search_reminders: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  ekb_list_reminders_filtered: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  ekb_toggle_flag: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  ekb_delete_reminder: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  ekb_list_calendars: {
    args: [],
    returns: FFIType.ptr,
  },
  ekb_list_tags: {
    args: [],
    returns: FFIType.ptr,
  },
  ekb_get_reminders_by_tag: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  // Calendar functions
  ekb_request_calendar_access: {
    args: [],
    returns: FFIType.ptr,
  },
  ekb_list_event_calendars: {
    args: [],
    returns: FFIType.ptr,
  },
  ekb_list_calendar_events: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  ekb_create_calendar_event: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  ekb_update_calendar_event: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  ekb_delete_calendar_event: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  // Permission check
  ekb_check_permissions: {
    args: [],
    returns: FFIType.ptr,
  },
  // Memory management
  ekb_free_string: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
} as const;

// Load the dynamic library with type inference from 'as const'
const lib = dlopen(libPath, ffiSymbols);
console.error(`[eventkit-bridge] Library loaded successfully`);

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Read a C string from a pointer and free it
 */
function readAndFreeString(
  pointer: ReturnType<typeof lib.symbols.ekb_request_access>
): string {
  if (!pointer) {
    throw new Error("Received null pointer from Swift bridge");
  }

  try {
    const cstring = new CString(pointer);
    return cstring.toString();
  } finally {
    lib.symbols.ekb_free_string(pointer);
  }
}

/**
 * Parse a JSON response from the Swift bridge
 */
function parseResponse<T>(jsonString: string): T {
  const response: BridgeResponse<T> = JSON.parse(jsonString);

  if (!response.success) {
    throw new Error(response.error || "Unknown error from EventKit bridge");
  }

  return response.data as T;
}

/**
 * Convert a string to a null-terminated buffer for FFI
 */
function toCString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  const buffer = new Uint8Array(encoded.length + 1);
  buffer.set(encoded);
  buffer[encoded.length] = 0; // null terminator
  return buffer;
}

// =============================================================================
// EventKit Bridge Class
// =============================================================================

/**
 * EventKit Bridge - TypeScript interface to the Swift EventKit module
 */
export class EventKitBridge {
  // ===========================================================================
  // Reminder Methods
  // ===========================================================================

  /**
   * Request access to the user's reminders
   * @returns true if access was granted
   * @throws Error if access was denied
   */
  requestAccess(): boolean {
    const resultPtr = lib.symbols.ekb_request_access();
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<boolean>(jsonString);
  }

  /**
   * List reminders
   * @param completedOnly - if true, only return completed reminders
   * @returns Array of reminders
   */
  listReminders(completedOnly = false): Reminder[] {
    const resultPtr = lib.symbols.ekb_list_reminders(completedOnly);
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<Reminder[]>(jsonString);
  }

  /**
   * Create a new reminder
   * @param params - The reminder parameters
   * @returns The created reminder
   */
  createReminder(params: CreateReminderParams): Reminder {
    const jsonParams = JSON.stringify(params);
    const cstring = toCString(jsonParams);
    const resultPtr = lib.symbols.ekb_create_reminder(ptr(cstring));
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<Reminder>(jsonString);
  }

  /**
   * Mark a reminder as completed
   * @param reminderId - The ID of the reminder to complete
   * @returns The updated reminder
   */
  completeReminder(reminderId: string): Reminder {
    const cstring = toCString(reminderId);
    const resultPtr = lib.symbols.ekb_complete_reminder(ptr(cstring));
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<Reminder>(jsonString);
  }

  /**
   * Delete a reminder permanently
   * @param reminderId - The ID of the reminder to delete
   * @returns true if deleted successfully
   */
  deleteReminder(reminderId: string): boolean {
    const cstring = toCString(reminderId);
    const resultPtr = lib.symbols.ekb_delete_reminder(ptr(cstring));
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<boolean>(jsonString);
  }

  /**
   * Update an existing reminder
   * @param reminderId - The ID of the reminder to update
   * @param params - The fields to update
   * @returns The updated reminder
   */
  updateReminder(reminderId: string, params: UpdateReminderParams): Reminder {
    const idCstring = toCString(reminderId);
    const jsonParams = JSON.stringify(params);
    const paramsCstring = toCString(jsonParams);
    const resultPtr = lib.symbols.ekb_update_reminder(
      ptr(idCstring),
      ptr(paramsCstring)
    );
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<Reminder>(jsonString);
  }

  /**
   * Search reminders by text with optional filters
   * @param params - Search parameters including query and filters
   * @returns Array of matching reminders
   */
  searchReminders(params: SearchRemindersParams): Reminder[] {
    const jsonParams = JSON.stringify(params);
    const paramsCstring = toCString(jsonParams);
    const resultPtr = lib.symbols.ekb_search_reminders(ptr(paramsCstring));
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<Reminder[]>(jsonString);
  }

  /**
   * List reminders with advanced filters
   * @param filters - Filter parameters
   * @returns Array of reminders matching filters
   */
  listRemindersFiltered(filters: ListRemindersFilterParams): Reminder[] {
    const jsonParams = JSON.stringify(filters);
    const paramsCstring = toCString(jsonParams);
    const resultPtr = lib.symbols.ekb_list_reminders_filtered(
      ptr(paramsCstring)
    );
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<Reminder[]>(jsonString);
  }

  /**
   * Toggle the flagged status of a reminder
   * @param reminderId - The ID of the reminder
   * @returns The updated reminder
   */
  toggleFlag(reminderId: string): Reminder {
    const cstring = toCString(reminderId);
    const resultPtr = lib.symbols.ekb_toggle_flag(ptr(cstring));
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<Reminder>(jsonString);
  }

  /**
   * List all reminder calendars/lists
   * @returns Array of calendars
   */
  listCalendars(): ReminderCalendar[] {
    const resultPtr = lib.symbols.ekb_list_calendars();
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<ReminderCalendar[]>(jsonString);
  }

  /**
   * List all unique tags from the Reminders SQLite database
   * @returns Array of tags with reminder counts
   */
  listTags(): Tag[] {
    const resultPtr = lib.symbols.ekb_list_tags();
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<Tag[]>(jsonString);
  }

  /**
   * Get reminder IDs that have a specific tag
   * @param tagName - The tag name to search for (without # prefix)
   * @returns Array of reminder IDs
   */
  getReminderIdsByTag(tagName: string): string[] {
    const cstring = toCString(tagName);
    const resultPtr = lib.symbols.ekb_get_reminders_by_tag(ptr(cstring));
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<string[]>(jsonString);
  }

  // ===========================================================================
  // Calendar Event Methods
  // ===========================================================================

  /**
   * Request access to the user's calendar
   * @returns true if access was granted
   * @throws Error if access was denied
   */
  requestCalendarAccess(): boolean {
    const resultPtr = lib.symbols.ekb_request_calendar_access();
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<boolean>(jsonString);
  }

  /**
   * List all event calendars
   * @returns Array of event calendars
   */
  listEventCalendars(): EventCalendar[] {
    const resultPtr = lib.symbols.ekb_list_event_calendars();
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<EventCalendar[]>(jsonString);
  }

  /**
   * List calendar events within a date range
   * @param params - Start date, end date, and optional calendar IDs
   * @returns Array of calendar events
   */
  listCalendarEvents(params: ListCalendarEventsParams): CalendarEvent[] {
    const jsonParams = JSON.stringify(params);
    const cstring = toCString(jsonParams);
    const resultPtr = lib.symbols.ekb_list_calendar_events(ptr(cstring));
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<CalendarEvent[]>(jsonString);
  }

  /**
   * Create a new calendar event
   * @param params - Event parameters
   * @returns The created event
   */
  createCalendarEvent(params: CreateCalendarEventParams): CalendarEvent {
    const jsonParams = JSON.stringify(params);
    const cstring = toCString(jsonParams);
    const resultPtr = lib.symbols.ekb_create_calendar_event(ptr(cstring));
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<CalendarEvent>(jsonString);
  }

  /**
   * Update an existing calendar event
   * @param params - Event ID and fields to update
   * @returns The updated event
   */
  updateCalendarEvent(params: UpdateCalendarEventParams): CalendarEvent {
    const jsonParams = JSON.stringify(params);
    const cstring = toCString(jsonParams);
    const resultPtr = lib.symbols.ekb_update_calendar_event(ptr(cstring));
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<CalendarEvent>(jsonString);
  }

  /**
   * Delete a calendar event
   * @param eventId - The ID of the event to delete
   * @returns true if deleted successfully
   */
  deleteCalendarEvent(eventId: string): boolean {
    const cstring = toCString(eventId);
    const resultPtr = lib.symbols.ekb_delete_calendar_event(ptr(cstring));
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<boolean>(jsonString);
  }

  // ===========================================================================
  // Permission Methods
  // ===========================================================================

  /**
   * Check current permission status without requesting
   * @returns Permission status for calendars and reminders
   */
  checkPermissions(): PermissionStatus {
    const resultPtr = lib.symbols.ekb_check_permissions();
    const jsonString = readAndFreeString(resultPtr);
    return parseResponse<PermissionStatus>(jsonString);
  }
}

// Export a singleton instance
export const eventKitBridge = new EventKitBridge();
