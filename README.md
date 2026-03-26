# MCP Server EventKit

[![CI](https://github.com/yesawoo/mcp-server-eventkit/actions/workflows/ci.yml/badge.svg)](https://github.com/yesawoo/mcp-server-eventkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)]()

A Model Context Protocol (MCP) server that provides native integration with Apple's EventKit framework, allowing Claude to manage **Reminders** and **Calendar events** directly in macOS.

## Features

### Reminders
- **Create reminders** that appear instantly in Reminders.app
- **List and search reminders** with filters (completed, flagged, priority, date range)
- **Complete reminders** with a single command
- **Update reminders** (title, notes, due date, priority)
- **List tags** from your reminders (requires Full Disk Access)

### Calendar Events
- **List calendars** available for events
- **List events** within a date range
- **Create events** with title, dates, location, notes
- **Update events** 
- **Delete events**

### Sync
- **iCloud sync** - changes sync automatically to all your Apple devices

## Installation

### Option 1: Claude Desktop Extension (Recommended)

Install the `.mcpb` extension directly in Claude Desktop. Pre-built releases are available on the [GitHub Releases](https://github.com/yesawoo/mcp-server-eventkit/releases) page.

### Option 2: Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/yesawoo/mcp-server-eventkit.git
cd mcp-server-eventkit
```

2. Install dependencies:
```bash
bun install
```

3. Build the Swift bridge:
```bash
bun run build
```

4. Grant permissions when prompted (or manually in System Settings > Privacy & Security)

## Requirements

- macOS 13.0 (Ventura) or later
- [Bun](https://bun.sh) runtime (for development only)
- Xcode Command Line Tools (for building from source)

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "eventkit": {
      "command": "/usr/local/bin/mcp-eventkit"
    }
  }
}
```

Or for development:
```json
{
  "mcpServers": {
    "eventkit": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/mcp-server-eventkit/src/index.ts"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport stdio --scope user eventkit -- /usr/local/bin/mcp-eventkit
```

## Available Tools

### Reminder Tools

| Tool | Description |
|------|-------------|
| `list_reminders` | List incomplete or completed reminders |
| `create_reminder` | Create a new reminder |
| `complete_reminder` | Mark a reminder as completed |
| `delete_reminder` | Delete a reminder permanently |
| `update_reminder` | Update reminder title, notes, due date, priority |
| `search_reminders` | Search reminders with text query and filters |
| `list_reminders_filtered` | List reminders with advanced filters |
| `toggle_flag` | Toggle the flagged status of a reminder |
| `list_calendars` | List all reminder lists/calendars |
| `list_tags` | List all tags from reminders (requires Full Disk Access) |

### Calendar Event Tools

| Tool | Description |
|------|-------------|
| `list_event_calendars` | List all calendars available for events |
| `list_calendar_events` | List events within a date range |
| `create_calendar_event` | Create a new calendar event |
| `update_calendar_event` | Update an existing event |
| `delete_calendar_event` | Delete a calendar event |

## Building from Source

### Claude Desktop Extension (.mcpb)

```bash
bun install
just pack
```

This builds the Swift bridge, compiles the standalone binary, validates the manifest, and packs the `.mcpb` extension.

### Installer Package (.pkg)

To create a distributable `.pkg` installer:

### Prerequisites

- macOS with Xcode Command Line Tools
- [Bun](https://bun.sh) runtime

### Build Steps

```bash
# 1. Install dependencies
bun install

# 2. Build the Swift bridge (creates libEventKitBridge.dylib)
bun run build:swift

# 3. Compile standalone binary (bundles TypeScript into single executable)
bun run build:binary

# 4. Build the .pkg installer
bun run build:pkg
```

### Installer Contents

The `.pkg` installs:

| Component | Location |
|-----------|----------|
| Server binary | `/usr/local/lib/mcp-eventkit/mcp-eventkit` |
| Swift library | `/usr/local/lib/mcp-eventkit/libEventKitBridge.dylib` |
| Symlink | `/usr/local/bin/mcp-eventkit` |
| Uninstaller | `/Applications/Uninstall MCP EventKit.app` |

### Signing (Optional)

To sign the package for distribution:

```bash
productsign --sign "Developer ID Installer: Your Name" \
  dist/MCP-EventKit-Server-<version>.pkg \
  dist/MCP-EventKit-Server-<version>-signed.pkg
```

## Development

### Project Structure

```
mcp-server-eventkit/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── server.ts                # Server configuration
│   ├── swift-bridge/
│   │   ├── EventKitBridge.swift # Native Swift module
│   │   ├── eventkit-bridge.ts   # TypeScript FFI bindings
│   │   └── build.sh             # Swift compilation script
│   ├── tools/                   # MCP tool implementations
│   ├── schemas/                 # Zod validation schemas
│   └── prompts/                 # MCP prompts
├── installer/
│   ├── build-pkg.sh             # Installer build script
│   ├── scripts/                 # Pre/post install scripts
│   ├── resources/               # Installer UI resources
│   └── payload/                 # Files to install
├── build/
│   ├── mcp-eventkit             # Compiled binary
│   └── libEventKitBridge.dylib  # Compiled Swift library
├── dist/                        # Generated installers
└── docs/                        # Documentation
    ├── adr/                     # Architecture Decision Records
    └── prd/                     # Product Requirements Documents
```

### Running in Development

```bash
# Build Swift bridge
bun run build

# Run server (for testing)
bun run start

# Run with hot reload
bun run dev
```

### Architecture

The server uses a three-layer architecture:

1. **MCP Layer** (TypeScript): Handles MCP protocol, tool registration, and validation
2. **FFI Bridge** (Bun FFI): Connects TypeScript to Swift via C-compatible functions
3. **Native Layer** (Swift): Interacts with EventKit framework

See [Architecture Decision Records](./docs/adr/) for detailed design decisions.

## Permissions

### Reminders Access
Required for all reminder operations. Grant in:
- **System Settings** > **Privacy & Security** > **Reminders**

### Calendar Access
Required for calendar event operations. Grant in:
- **System Settings** > **Privacy & Security** > **Calendars**

### Full Disk Access (Optional)
Required only for `list_tags` tool. Grant in:
- **System Settings** > **Privacy & Security** > **Full Disk Access**
- Add `/usr/local/bin/mcp-eventkit` (or your terminal app for development)

## Troubleshooting

### "No access to Reminders" error

The app doesn't have permission to access Reminders. Grant access in System Settings > Privacy & Security > Reminders.

### "No default calendar for reminders" error

You don't have any Reminders lists. Open the Reminders app and create at least one list.

### Tags not working

The `list_tags` feature requires Full Disk Access because it reads directly from the Reminders SQLite database. Grant access in System Settings > Privacy & Security > Full Disk Access.

### Build fails with Swift errors

Ensure you have Xcode Command Line Tools installed:
```bash
xcode-select --install
```

### Calendar events not showing

Make sure you've granted Calendar access in System Settings > Privacy & Security > Calendars.

## Uninstalling

### If installed via .pkg

1. Open **Applications** in Finder
2. Double-click **Uninstall MCP EventKit**
3. Confirm and enter admin password

### Manual uninstall

```bash
sudo rm -rf /usr/local/lib/mcp-eventkit
sudo rm -f /usr/local/bin/mcp-eventkit
rm -rf "/Applications/Uninstall MCP EventKit.app"
```

Then remove the `eventkit` entry from your Claude Desktop config.

## License

MIT
