import EventKit
import SwiftUI

// MARK: - App Entry Point
@main
struct MCPEventKitSetupApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            PermissionView()
                .frame(width: 500, height: 540)
                .background(.background)
        }
        .windowStyle(.automatic)
        .windowResizability(.contentSize)
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)

        if let window = NSApp.windows.first {
            window.center()
            window.isMovableByWindowBackground = true
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

// MARK: - Permission Status Model
class PermissionManager: ObservableObject {
    @Published var calendarStatus: EKAuthorizationStatus = .notDetermined
    @Published var reminderStatus: EKAuthorizationStatus = .notDetermined
    @Published var isRequestingCalendar = false
    @Published var isRequestingReminder = false

    private let eventStore = EKEventStore()

    init() {
        updateStatus()
    }

    func updateStatus() {
        calendarStatus = EKEventStore.authorizationStatus(for: .event)
        reminderStatus = EKEventStore.authorizationStatus(for: .reminder)
    }

    func requestCalendarAccess() {
        isRequestingCalendar = true
        eventStore.requestFullAccessToEvents { [weak self] granted, error in
            DispatchQueue.main.async {
                self?.isRequestingCalendar = false
                self?.updateStatus()
            }
        }
    }

    func requestReminderAccess() {
        isRequestingReminder = true
        eventStore.requestFullAccessToReminders { [weak self] granted, error in
            DispatchQueue.main.async {
                self?.isRequestingReminder = false
                self?.updateStatus()
            }
        }
    }

    func openSystemSettings() {
        if let url = URL(
            string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars")
        {
            NSWorkspace.shared.open(url)
        }
    }

    var allPermissionsGranted: Bool {
        calendarStatus == .fullAccess && reminderStatus == .fullAccess
    }
}

// MARK: - Main Permission View
struct PermissionView: View {
    @StateObject private var permissionManager = PermissionManager()
    @State private var isAppearing = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            // Header
            headerSection

            // Permission rows
            permissionSection

            Spacer()

            // Done button
            doneButton
                .padding(.bottom, 16)
        }
        .padding(.horizontal, 40)
        .padding(.vertical, 20)
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                isAppearing = true
            }
        }
    }

    // MARK: - Header Section
    private var headerSection: some View {
        VStack(spacing: 16) {
            // Icon with Liquid Glass
            Image(systemName: "calendar.badge.checkmark")
                .font(.system(size: 48, weight: .medium))
                .foregroundStyle(.blue)
                .frame(width: 100, height: 100)
                .glassEffect()
                .scaleEffect(isAppearing ? 1 : 0.5)
                .opacity(isAppearing ? 1 : 0)

            // Title
            Text("Configurar Permisos")
                .font(.largeTitle.bold())
                .opacity(isAppearing ? 1 : 0)
                .offset(y: isAppearing ? 0 : 20)

            // Description
            Text(
                "MCP EventKit necesita acceso a tus calendarios y recordatorios para funcionar con Claude y otros asistentes de IA."
            )
            .font(.body)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .opacity(isAppearing ? 1 : 0)
            .offset(y: isAppearing ? 0 : 20)
        }
    }

    // MARK: - Permission Section
    private var permissionSection: some View {
        VStack(spacing: 12) {
            PermissionRow(
                icon: "calendar",
                iconColor: .red,
                title: "Calendarios",
                status: permissionManager.calendarStatus,
                isRequesting: permissionManager.isRequestingCalendar,
                onRequest: { permissionManager.requestCalendarAccess() },
                onOpenSettings: { permissionManager.openSystemSettings() }
            )
            .opacity(isAppearing ? 1 : 0)
            .offset(x: isAppearing ? 0 : -30)
            .animation(.spring(response: 0.6, dampingFraction: 0.8).delay(0.1), value: isAppearing)

            PermissionRow(
                icon: "checklist",
                iconColor: .orange,
                title: "Recordatorios",
                status: permissionManager.reminderStatus,
                isRequesting: permissionManager.isRequestingReminder,
                onRequest: { permissionManager.requestReminderAccess() },
                onOpenSettings: { permissionManager.openSystemSettings() }
            )
            .opacity(isAppearing ? 1 : 0)
            .offset(x: isAppearing ? 0 : -30)
            .animation(.spring(response: 0.6, dampingFraction: 0.8).delay(0.2), value: isAppearing)
        }
    }

    // MARK: - Done Button
    private var doneButton: some View {
        Button(action: {
            NSApplication.shared.terminate(nil)
        }) {
            HStack(spacing: 8) {
                if permissionManager.allPermissionsGranted {
                    Image(systemName: "checkmark.circle.fill")
                }
                Text("Listo")
            }
            .font(.headline)
            .frame(width: 160, height: 44)
        }
        .buttonStyle(.borderedProminent)
        .tint(permissionManager.allPermissionsGranted ? .green : .blue)
        .controlSize(.large)
        .opacity(isAppearing ? 1 : 0)
        .offset(y: isAppearing ? 0 : 30)
        .animation(.spring(response: 0.6, dampingFraction: 0.8).delay(0.3), value: isAppearing)
    }
}

// MARK: - Permission Row Component
struct PermissionRow: View {
    let icon: String
    let iconColor: Color
    let title: String
    let status: EKAuthorizationStatus
    let isRequesting: Bool
    let onRequest: () -> Void
    let onOpenSettings: () -> Void

    private var isGranted: Bool {
        status == .fullAccess
    }

    private var isDenied: Bool {
        status == .denied || status == .restricted
    }

    private var statusText: String {
        switch status {
        case .fullAccess: return "Permitido"
        case .denied, .restricted: return "Denegado"
        case .writeOnly: return "Parcial"
        default: return "No configurado"
        }
    }

    private var statusColor: Color {
        switch status {
        case .fullAccess: return .green
        case .denied, .restricted: return .red
        default: return .orange
        }
    }

    var body: some View {
        HStack(spacing: 16) {
            // Icon
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(iconColor)
                .frame(width: 44, height: 44)
                .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 10))

            // Title and status
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)

                HStack(spacing: 4) {
                    if isGranted {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption)
                    } else if isDenied {
                        Image(systemName: "xmark.circle.fill")
                            .font(.caption)
                    }
                    Text(statusText)
                        .font(.subheadline)
                }
                .foregroundStyle(statusColor)
            }

            Spacer()

            // Action button
            actionButton
        }
        .padding(16)
        .background(.fill.quaternary, in: RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private var actionButton: some View {
        if isRequesting {
            ProgressView()
                .controlSize(.small)
                .frame(width: 100)
        } else if isGranted {
            HStack(spacing: 4) {
                Image(systemName: "checkmark")
                    .font(.caption.bold())
                Text("Listo")
                    .font(.subheadline.weight(.medium))
            }
            .foregroundStyle(.green)
            .frame(width: 100, height: 32)
            .background(.green.opacity(0.15), in: Capsule())
        } else if isDenied {
            Button("Abrir Ajustes", action: onOpenSettings)
                .buttonStyle(.bordered)
                .controlSize(.small)
        } else {
            Button("Permitir", action: onRequest)
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
        }
    }
}

// MARK: - Preview
#Preview {
    PermissionView()
        .frame(width: 500, height: 540)
}
