# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Data Access

This project accesses sensitive macOS user data through Apple's EventKit framework:

- **Reminders** — reads and writes to Reminders.app data
- **Calendar events** — reads and writes to Calendar.app data
- **Tags** — reads the Reminders SQLite database (requires Full Disk Access)

All data stays local to your machine and syncs only through Apple's iCloud infrastructure. This MCP server does not transmit data to any third-party services.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately via
[GitHub Security Advisories](https://github.com/yesawoo/mcp-server-eventkit/security/advisories/new).

Please do **not** open a public issue for security vulnerabilities.

### What to expect

- Acknowledgment within 48 hours
- Assessment and fix timeline within 1 week
- Credit in the release notes (unless you prefer anonymity)
