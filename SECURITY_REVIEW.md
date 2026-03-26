# Security Review: MCP EventKit Server

**Date:** 2026-03-25
**Reviewer:** Frontend Security Specialist
**Scope:** Full codebase review of mcp-server-eventkit (v0.1.3)
**Repository:** https://github.com/yesawoo/mcp-server-eventkit

---

## Executive Summary

This MCP server bridges Apple EventKit (Calendars and Reminders) to Claude Desktop via the Model Context Protocol over stdio. The application uses Bun FFI to call a Swift dynamic library that interfaces with macOS EventKit and reads the Reminders SQLite database directly. Overall, the codebase demonstrates several good security practices (Zod schema validation, parameterized SQL queries, read-only database access), but has notable findings in the areas of entitlement scope, supply chain integrity, information disclosure, and input validation gaps.

---

## Findings

### CRITICAL

*No critical findings.*

---

### HIGH

#### H-1: Overly Permissive Code Signing Entitlements

**File:** `installer/entitlements.plist` (lines 6-10)
**Description:** The entitlements grant three dangerous security exceptions:

```xml
<key>com.apple.security.cs.allow-jit</key>
<true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key>
<true/>
<key>com.apple.security.cs.disable-library-validation</key>
<true/>
```

- `allow-jit` permits JIT compilation, expanding the attack surface for memory corruption.
- `allow-unsigned-executable-memory` disables W^X protections, allowing writable memory pages to become executable. This is the most dangerous entitlement here.
- `disable-library-validation` allows the process to load any dylib, not just those signed by the same team or Apple. An attacker who can place a malicious dylib in one of the library search paths could achieve arbitrary code execution.

These entitlements are likely required by the Bun runtime, but they significantly weaken the application's hardened runtime protections.

**Impact:** If an attacker can influence the dylib search path or place a malicious library in a searched location, they can execute arbitrary code with the user's calendar and reminder permissions.
**Recommendation:** Document why each entitlement is required. Investigate whether Bun can operate with a subset. Consider applying entitlements only to the main binary, not the Setup helper app (which also gets the same entitlements via `build-pkg.sh` line 74).

---

#### H-2: Compiled Binaries Committed to Git Repository

**Files:**
- `installer/MCP EventKit.app/Contents/MacOS/mcp-eventkit` (Mach-O arm64 binary)
- `installer/MCP EventKit.app/Contents/Frameworks/libEventKitBridge.dylib` (Mach-O arm64 dylib)
- `installer/PermissionHelper/MCP EventKit Setup.app/Contents/MacOS/MCP EventKit Setup` (compiled binary)

**Description:** Pre-compiled binaries are checked into the git repository. These binaries cannot be audited or verified against the source code by anyone cloning the repository. A compromised binary could contain malicious code that would not be visible in source review. The binaries have full access to the user's calendars, reminders, and (if Full Disk Access is granted) the Reminders SQLite database.

**Impact:** Supply chain risk. A contributor or compromised account could replace binaries with trojaned versions that exfiltrate calendar data, and this would not be apparent from a source code review.
**Recommendation:** Remove compiled binaries from version control. Build all binaries in CI/CD and distribute as signed release artifacts. Add `.app` contents to `.gitignore`. Use GitHub Releases (already partially implemented via `release.yml`) as the sole distribution channel for binaries.

---

#### H-3: Dynamic Library Search Path Allows Hijacking

**File:** `src/swift-bridge/eventkit-bridge.ts` (lines 161-183)
**Description:** The `findLibrary()` function searches multiple paths for `libEventKitBridge.dylib`:

```typescript
const possiblePaths = [
    "/Applications/MCP EventKit.app/Contents/Frameworks/libEventKitBridge.dylib",
    join(process.execPath, "../Frameworks/libEventKitBridge.dylib"),
    "/usr/local/lib/mcp-eventkit/libEventKitBridge.dylib",
    join(__dirname, "../../build/libEventKitBridge.dylib"),
    join(__dirname, "libEventKitBridge.dylib"),
    join(process.execPath, "../libEventKitBridge.dylib"),
];
```

Combined with the `disable-library-validation` entitlement (H-1), an attacker who can write to any of these paths (particularly the development paths like `build/` or relative to `__dirname`) could plant a malicious dylib. The function uses the first path that `existsSync` returns true for, so a planted file in an earlier search position wins.

Additionally, `manifest.json` sets `DYLD_LIBRARY_PATH` to `${__dirname}/server`, adding another search location.

**Impact:** Arbitrary code execution under the identity and permissions of the MCP server.
**Recommendation:** In production builds, hardcode the expected library path (e.g., the app bundle Frameworks directory). Remove development fallback paths from release builds. Validate the dylib's code signature before loading it.

---

### MEDIUM

#### M-1: Postinstall Script Modifies Claude Desktop Config with Root Privileges

**File:** `installer/scripts/postinstall` (lines 28-67)
**Description:** The postinstall script runs as root during `.pkg` installation and modifies the user's Claude Desktop configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json`). It uses an embedded Python script to parse and modify the JSON. If the config file is malformed or contains unexpected content, the script could silently corrupt it. The script creates a new config if one doesn't exist, potentially overwriting a user's existing MCP server configuration.

Furthermore, the script creates a symlink at `/usr/local/bin/mcp-eventkit` (line 22) pointing to the app bundle binary, which is writable by any admin user. This creates a persistent binary trust relationship.

**Impact:** Configuration corruption risk. The created symlink could be replaced by a malicious binary if an attacker gains admin access.
**Recommendation:** Add error handling and backup for config modification. Validate JSON structure before and after modification. Consider using `jq` or a more robust approach. Remove the `/usr/local/bin` symlink in favor of direct app bundle execution.

---

#### M-2: No Input Length or Size Limits on String Fields

**Files:**
- `src/schemas/reminder-schema.ts` (line 7): `title: z.string().min(1)` -- no max length
- `src/schemas/calendar-schema.ts` (line 29): `title: z.string()` -- no min or max
- `src/schemas/reminder-schema.ts` (lines 8, 59, 60): `notes: z.string().optional()` -- unbounded
- `src/schemas/calendar-schema.ts` (lines 46-48): `notes`, `location`, `url` -- unbounded

**Description:** While Zod schemas validate the presence and type of inputs, there are no maximum length constraints on string fields. A malicious or misconfigured MCP client could send extremely large strings (megabytes or gigabytes) for titles, notes, or other fields. These strings are serialized to JSON, converted to C strings via FFI, and passed to EventKit.

**Impact:** Potential memory exhaustion or denial of service. Large strings passed through FFI could cause buffer-related issues in the Swift bridge.
**Recommendation:** Add `.max()` constraints to all string fields in Zod schemas. Reasonable limits: titles (500 chars), notes (10,000 chars), URLs (2,048 chars), IDs (256 chars).

---

#### M-3: Calendar Event `url` Field Not Validated as URL

**File:** `src/schemas/calendar-schema.ts` (line 48)
**Description:** The `url` field in `CreateCalendarEventSchema` and `UpdateCalendarEventSchema` is defined as `z.string().optional()` with no URL validation. This value is passed directly to EventKit, which stores it as the event's URL. A malicious value could contain a `javascript:` URI, a `file:///` path, or other scheme that might be rendered as a clickable link in Calendar.app.

**Impact:** If Calendar.app renders the URL as clickable, a crafted `javascript:` or custom scheme URI could trigger unintended actions when clicked.
**Recommendation:** Use `z.string().url().optional()` or add a custom validator that enforces `https://` or `http://` schemes only.

---

#### M-4: Date Strings Not Validated as ISO 8601 Before FFI

**Files:**
- `src/schemas/calendar-schema.ts` (lines 8-9, 14-15): `start_date` and `end_date` accept any string
- `src/schemas/reminder-schema.ts` (lines 9-14, 62-66): `due_date`, `due_before`, `due_after` accept any string

**Description:** Date fields are documented as ISO 8601 format but only validated as `z.string()`. Invalid date strings are passed through to the Swift bridge where they silently fail to parse (the ISO8601DateFormatter returns nil). For reminders, this means a due date can be silently dropped. For calendar events, the `try? decoder.decode` call will fail entirely, returning a generic error.

**Impact:** Silent data loss -- a reminder could be created without the intended due date. Poor error messages for invalid input.
**Recommendation:** Add Zod refinement to validate ISO 8601 format on the TypeScript side: `z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)` or use `z.string().datetime()`.

---

#### M-5: Developer ID and Team ID Hardcoded in Build Scripts

**Files:**
- `installer/build-pkg.sh` (lines 15-16):
  ```bash
  APP_SIGN_IDENTITY="${APP_SIGN_IDENTITY:-Developer ID Application: Alejandro Sanchez Rodriguez (8J6557H8MJ)}"
  PKG_SIGN_IDENTITY="${PKG_SIGN_IDENTITY:-Developer ID Installer: Alejandro Sanchez Rodriguez (8J6557H8MJ)}"
  ```
- `installer/PermissionHelper/build.sh` (line 12): Same pattern

**Description:** While these are overridable via environment variables, the developer's real name and Apple Team ID (`8J6557H8MJ`) are hardcoded as defaults. This is personal information exposure and could be used for targeted social engineering against the developer's Apple Developer account.

**Impact:** Information disclosure of developer identity and Apple Team ID.
**Recommendation:** Use placeholder values in the committed code (e.g., `"Your Developer ID Application: YOUR_NAME (YOUR_TEAM_ID)"`) and document the required environment variables. Move real identities to a local `.env` file that is gitignored.

---

#### M-6: No Date Range Validation for Calendar Event Queries

**File:** `src/swift-bridge/EventKitBridge.swift` (lines 1129-1166)
**Description:** The `ekb_list_calendar_events` function accepts arbitrary start and end dates with no range validation. A request for events spanning decades could cause EventKit to scan an enormous amount of data, causing performance degradation or memory pressure. Apple's documentation recommends limiting date range queries to 4 years.

**Impact:** Denial of service via resource-intensive queries.
**Recommendation:** Add a maximum date range limit (e.g., 365 days) in the TypeScript schema or Swift bridge. Return an error if the range exceeds the limit.

---

### LOW

#### L-1: Error Messages Expose Internal Implementation Details

**Files:**
- `src/swift-bridge/EventKitBridge.swift` (line 931): Error includes database path: `"Failed to open Reminders database at: \(dbPath)"`
- `src/swift-bridge/eventkit-bridge.ts` (line 187): Library load path logged to stderr: `"Loading library from: ${libPath}"`
- `src/index.ts` (line 43): Error objects logged directly: `console.error(..., error)`
- `src/swift-bridge/EventKitBridge.swift` (lines 223, 389, 486): JSON parse errors include `error.localizedDescription`

**Description:** Error messages reveal internal file paths, library locations, and system-specific details. While MCP communication happens over stdio and these go to stderr, the information could be useful to an attacker with access to logs.

**Impact:** Information disclosure that aids reconnaissance.
**Recommendation:** Use generic error messages in responses. Log detailed errors to stderr only in debug mode. Consider adding a debug flag that controls error verbosity.

---

#### L-2: `@types/bun` Pinned to `latest` Tag

**File:** `package.json` (line 26)
```json
"@types/bun": "latest"
```

**Description:** Using `latest` as a version specifier for a devDependency means every `bun install` could pull a different version. While `bun.lock` provides reproducibility for exact installs, anyone running `bun install` without the lockfile could get a compromised or broken version.

**Impact:** Build reproducibility risk. A compromised `@types/bun` package could inject malicious type definitions.
**Recommendation:** Pin to a specific version (e.g., `"@types/bun": "^1.2.0"`).

---

#### L-3: No Integrity Checks on `npx` Invocations in CI

**Files:**
- `.github/workflows/ci.yml` (lines 77, 80): `npx @anthropic-ai/mcpb@latest validate` and `npx @anthropic-ai/mcpb@latest pack`
- `.github/workflows/release.yml` (lines 37, 40): Same

**Description:** CI pipelines use `npx @anthropic-ai/mcpb@latest` which downloads and executes the latest version of the package on every run. A compromised npm package or registry could inject malicious code into the build pipeline.

**Impact:** Supply chain attack vector in CI/CD. An attacker who compromises the `@anthropic-ai/mcpb` package could tamper with release artifacts.
**Recommendation:** Pin `@anthropic-ai/mcpb` to a specific version. Consider adding it as a devDependency with a pinned version instead of using `npx @latest`.

---

#### L-4: Uninstaller Uses Bare `except:` in Python

**Files:**
- `installer/scripts/uninstall.sh` (line 49): `except Exception as e:`
- `installer/Uninstall MCP EventKit.app/Contents/MacOS/uninstall` (line 43): `except: pass`

**Description:** The uninstaller's embedded Python script catches all exceptions silently with `except: pass`. If the config file contains malicious JSON (e.g., a JSON bomb), the error is silently swallowed. More importantly, if the config is partially written before an error, data corruption could occur silently.

**Impact:** Silent failure during uninstallation could leave a corrupted config.
**Recommendation:** Catch specific exceptions, log errors, and create a backup of the config file before modification.

---

#### L-5: SQLite `sqlite3_bind_text` Uses `nil` Destructor

**File:** `src/swift-bridge/EventKitBridge.swift` (line 893)
```swift
sqlite3_bind_text(statement, 1, tagName, -1, nil)
```

**Description:** The `sqlite3_bind_text` call passes `nil` as the destructor parameter. With `nil`, SQLite assumes the string pointer remains valid for the lifetime of the statement. Since `tagName` is a Swift `String`, the Swift runtime manages its memory and could theoretically deallocate or move the backing buffer while SQLite is still using it. Using `SQLITE_TRANSIENT` (value `-1` cast to the destructor type) would be safer, as it tells SQLite to make its own copy.

**Impact:** Potential use-after-free in edge cases if Swift optimizes memory during the query execution.
**Recommendation:** Pass `unsafeBitCast(-1, to: sqlite3_destructor_type.self)` (i.e., `SQLITE_TRANSIENT`) instead of `nil` to ensure SQLite copies the string.

---

### INFORMATIONAL

#### I-1: MCP Protocol Has No Authentication Layer

**Description:** The MCP server communicates over stdio with no authentication. Any process that can spawn the binary and communicate over its stdin/stdout has full access to all calendar and reminder operations, including creation, deletion, and modification. This is by design in the MCP protocol (the host application, e.g., Claude Desktop, is the trust boundary), but it means security depends entirely on the host application's access controls.

**Impact:** No defense-in-depth at the MCP layer. A compromised host or any process that can exec the binary gains full EventKit access.
**Recommendation:** Document this trust model clearly. Consider adding an optional shared secret or token mechanism for environments where the binary might be accessible to multiple processes.

---

#### I-2: Full Disk Access Required for Tag Feature

**File:** `src/swift-bridge/EventKitBridge.swift` (lines 780-818)
**Description:** The tag listing feature directly reads the Reminders SQLite database file from `~/Library/Group Containers/group.com.apple.reminders/`. This requires Full Disk Access permission, which grants the application read access to virtually all user files, far exceeding the EventKit permissions needed for the core functionality.

**Impact:** Excessive permission scope for a supplementary feature.
**Recommendation:** Document this clearly as an optional feature with elevated permissions. Consider making it a separate opt-in capability. Explore whether Apple's EventKit API provides tag access in newer macOS versions.

---

#### I-3: Singleton Bridge Instance Has No Thread Safety

**File:** `src/swift-bridge/eventkit-bridge.ts` (line 584)
```typescript
export const eventKitBridge = new EventKitBridge();
```

**File:** `src/swift-bridge/EventKitBridge.swift` (lines 8, 11, 1045)
```swift
private let eventStore = EKEventStore()
private var hasAccess = false
private var hasCalendarAccess = false
```

**Description:** The Swift bridge uses global mutable state (`hasAccess`, `hasCalendarAccess`) without synchronization. While the MCP server processes requests sequentially via stdio, if the architecture ever changes to support concurrent requests, these global variables would create race conditions.

**Impact:** No immediate risk given the current serial request processing. Future risk if concurrency is added.
**Recommendation:** Document the single-threaded assumption. Consider using `DispatchQueue`-protected access for the global state variables.

---

#### I-4: Reminders Database Path Discovery via Directory Enumeration

**File:** `src/swift-bridge/EventKitBridge.swift` (lines 780-818)
**Description:** The `findRemindersDatabasePath()` function enumerates directories under the user's home to find SQLite files. It iterates `contentsOfDirectory` looking for files matching `Data-*.sqlite` or `Container.sqlite`. This approach is fragile (depends on undocumented file naming conventions) and could theoretically match a planted file if an attacker can write to the Group Containers directory.

**Impact:** Minimal in practice, as writing to the Group Containers directory would require prior compromise.
**Recommendation:** Consider validating the SQLite database schema before querying to ensure it is a genuine Reminders database.

---

#### I-5: No Rate Limiting on Destructive Operations

**Description:** Tools like `delete_reminder`, `delete_calendar_event`, `complete_reminder` have no rate limiting or batch size controls. A malicious or malfunctioning MCP client could rapidly delete all reminders or calendar events.

**Impact:** Data destruction risk from a compromised MCP client.
**Recommendation:** Consider adding confirmation mechanisms for bulk operations, or implementing a configurable rate limit for destructive operations.

---

#### I-6: Good Practices Observed

The following security-positive patterns were noted:

- **Input validation via Zod schemas:** All MCP tool inputs are validated through Zod schemas before processing (`src/schemas/`).
- **Parameterized SQL queries:** The SQLite tag query uses `sqlite3_bind_text` for parameter binding rather than string interpolation (`EventKitBridge.swift` line 892-893).
- **Read-only database access:** The SQLite database is opened with `SQLITE_OPEN_READONLY` (`EventKitBridge.swift` line 826).
- **Memory management:** FFI strings are properly freed via `ekb_free_string` with a `try/finally` pattern (`eventkit-bridge.ts` lines 298-303).
- **No `eval()` or dynamic code execution:** No use of `eval`, `Function()`, or similar patterns in the TypeScript code.
- **No secrets in source:** No API keys, tokens, or credentials are hardcoded in the source.
- **Proper `.gitignore`:** Environment files, secrets, and build artifacts are gitignored.
- **Null pointer checks:** All FFI functions validate input pointers before use.
- **macOS permission model:** The application properly requests EventKit permissions through the OS permission system.
- **Stderr for logging:** Diagnostic output goes to stderr, keeping stdout clean for MCP protocol communication.

---

## Summary Table

| ID   | Severity      | Finding                                              |
|------|---------------|------------------------------------------------------|
| H-1  | High          | Overly permissive code signing entitlements           |
| H-2  | High          | Compiled binaries committed to git repository         |
| H-3  | High          | Dynamic library search path allows hijacking          |
| M-1  | Medium        | Postinstall script modifies config with root privs    |
| M-2  | Medium        | No input length limits on string fields               |
| M-3  | Medium        | Calendar event URL field not validated as URL          |
| M-4  | Medium        | Date strings not validated as ISO 8601 before FFI     |
| M-5  | Medium        | Developer ID and Team ID hardcoded in build scripts   |
| M-6  | Medium        | No date range validation for calendar event queries   |
| L-1  | Low           | Error messages expose internal implementation details |
| L-2  | Low           | @types/bun pinned to latest tag                       |
| L-3  | Low           | No integrity checks on npx invocations in CI          |
| L-4  | Low           | Uninstaller uses bare except in Python                |
| L-5  | Low           | SQLite bind_text uses nil destructor                  |
| I-1  | Informational | MCP protocol has no authentication layer              |
| I-2  | Informational | Full Disk Access required for tag feature             |
| I-3  | Informational | Singleton bridge instance has no thread safety        |
| I-4  | Informational | Database path discovery via directory enumeration     |
| I-5  | Informational | No rate limiting on destructive operations            |
| I-6  | Informational | Good practices observed                               |

---

## Recommended Priority Actions

1. **Remove compiled binaries from git** and build exclusively in CI (H-2).
2. **Evaluate and minimize entitlements** -- apply only necessary entitlements to each binary (H-1).
3. **Restrict library search paths** in production builds and validate dylib signatures (H-3).
4. **Add `.max()` length constraints** to all Zod string schemas (M-2).
5. **Validate URL and date formats** in schemas before passing to FFI (M-3, M-4).
6. **Pin CI dependencies** to specific versions instead of `@latest` (L-3).
7. **Remove hardcoded developer identity** from build scripts (M-5).
