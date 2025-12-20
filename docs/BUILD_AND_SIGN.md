# Build, Sign, and Notarize Guide

This document describes the complete process to build, sign, notarize, and distribute the MCP EventKit Server installer package.

## Overview

```mermaid
flowchart TD
    A[Source Code] --> B[Build Swift Bridge]
    A --> C[Build Bun Binary]
    B --> D[Create App Bundles]
    C --> D
    D --> E[Code Sign Apps]
    E --> F[Build PKG Installer]
    F --> G[Sign PKG]
    G --> H[Notarize with Apple]
    H --> I[Staple Ticket]
    I --> J[Distribute]
```

## Prerequisites

### Required Tools
- **Xcode Command Line Tools**: `xcode-select --install`
- **Bun**: JavaScript runtime for building the server
- **Swift**: For compiling the EventKit bridge and SwiftUI apps
- **Apple Developer Account**: For code signing and notarization

### Required Certificates
You need these certificates installed in your Keychain:

| Certificate | Purpose |
|-------------|---------|
| Developer ID Application | Signs app bundles (.app) |
| Developer ID Installer | Signs installer packages (.pkg) |

### Required Entitlements
The `installer/entitlements.plist` file contains:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <!-- Code execution permissions -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    
    <!-- EventKit permissions (required for calendar/reminders access) -->
    <key>com.apple.security.personal-information.calendars</key>
    <true/>
    <key>com.apple.security.personal-information.reminders</key>
    <true/>
</dict>
</plist>
```

## Build Process

### Architecture

```mermaid
graph TB
    subgraph "Source Files"
        TS[TypeScript Source<br/>src/]
        SWIFT[Swift Bridge<br/>src/swift-bridge/]
        UI[SwiftUI App<br/>installer/PermissionHelper/]
    end
    
    subgraph "Build Outputs"
        BIN[mcp-eventkit<br/>Bun compiled binary]
        DYLIB[libEventKitBridge.dylib<br/>Swift dynamic library]
        SETUP[MCP EventKit Setup.app<br/>Permission helper]
    end
    
    subgraph "App Bundles"
        MAIN[MCP EventKit.app<br/>Main server bundle]
        HELPER[MCP EventKit Setup.app<br/>UI for permissions]
        UNINSTALL[Uninstall MCP EventKit.app]
    end
    
    TS --> BIN
    SWIFT --> DYLIB
    UI --> SETUP
    
    BIN --> MAIN
    DYLIB --> MAIN
    SETUP --> HELPER
```

### Step 1: Build Swift Bridge

```bash
./src/swift-bridge/build.sh
```

This compiles `EventKitBridge.swift` into `libEventKitBridge.dylib`:

```mermaid
flowchart LR
    A[EventKitBridge.swift] --> B[swiftc compiler]
    B --> C[libEventKitBridge.dylib]
    
    B --> |flags| D["-emit-library"]
    B --> |frameworks| E["EventKit, Foundation"]
```

### Step 2: Build Bun Binary

```bash
bun build --compile --outfile build/mcp-eventkit src/index.ts
```

Creates a standalone executable that includes the Bun runtime.

### Step 3: Build Permission Helper App

```bash
./installer/PermissionHelper/build.sh
```

Process:

```mermaid
flowchart TD
    A[main.swift<br/>SwiftUI Code] --> B[swiftc compiler]
    B --> C[MCP EventKit Setup executable]
    C --> D[Create .app bundle structure]
    D --> E[Copy Info.plist]
    E --> F[Code sign with entitlements]
    
    F --> G{Signing Identity?}
    G --> |Found| H[codesign --force --options runtime]
    G --> |Not Found| I[Skip signing]
    
    H --> J[Verify signature]
    J --> K[MCP EventKit Setup.app]
```

### Step 4: Build Complete Installer

```bash
./installer/build-pkg.sh 0.1.2
```

This orchestrates the entire build:

```mermaid
sequenceDiagram
    participant S as build-pkg.sh
    participant PH as PermissionHelper
    participant CS as codesign
    participant PB as pkgbuild
    participant PR as productbuild
    participant PS as productsign
    
    S->>S: Verify binaries exist
    S->>PH: Build Permission Helper
    PH-->>S: MCP EventKit Setup.app
    
    S->>S: Create MCP EventKit.app bundle
    S->>S: Copy binary + dylib
    
    S->>CS: Sign dylib
    S->>CS: Sign binary
    S->>CS: Sign main app bundle
    S->>CS: Sign setup app
    
    S->>S: Create payload directory
    S->>PB: Create component.pkg
    S->>PR: Create distribution pkg
    S->>PS: Sign final pkg
    
    S-->>S: MCP-EventKit-Server-X.X.X.pkg
```

## Code Signing

### Signing Identity

Set via environment variable or hardcoded in scripts:

```bash
export APP_SIGN_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
export PKG_SIGN_IDENTITY="Developer ID Installer: Your Name (TEAM_ID)"
```

### Signing Order

Components must be signed from inside out:

```mermaid
flowchart TD
    subgraph "MCP EventKit.app"
        A[Contents/Frameworks/libEventKitBridge.dylib] --> B[Contents/MacOS/mcp-eventkit]
        B --> C[MCP EventKit.app bundle]
    end
    
    subgraph "Setup App"
        D[MCP EventKit Setup.app bundle]
    end
    
    C --> E[PKG contains both apps]
    D --> E
    E --> F[Sign PKG with Installer identity]
```

### Signing Commands

```bash
# Sign dynamic library
codesign --force --options runtime --timestamp \
    --entitlements entitlements.plist \
    --sign "$APP_SIGN_IDENTITY" \
    "MCP EventKit.app/Contents/Frameworks/libEventKitBridge.dylib"

# Sign main executable
codesign --force --options runtime --timestamp \
    --entitlements entitlements.plist \
    --sign "$APP_SIGN_IDENTITY" \
    "MCP EventKit.app/Contents/MacOS/mcp-eventkit"

# Sign app bundle
codesign --force --options runtime --timestamp \
    --entitlements entitlements.plist \
    --sign "$APP_SIGN_IDENTITY" \
    "MCP EventKit.app"

# Verify signature
codesign --verify --deep --strict "MCP EventKit.app"
```

## Notarization

### Process Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant NT as notarytool
    participant Apple as Apple Notary Service
    participant ST as stapler
    
    Dev->>NT: Submit PKG
    NT->>Apple: Upload package
    Apple-->>NT: Submission ID
    
    loop Check Status
        NT->>Apple: Query status
        Apple-->>NT: In Progress / Accepted / Rejected
    end
    
    Apple-->>NT: Status: Accepted
    NT-->>Dev: Notarization complete
    
    Dev->>ST: Staple ticket
    ST->>Apple: Fetch ticket
    Apple-->>ST: Notarization ticket
    ST->>ST: Attach to PKG
    ST-->>Dev: Stapled PKG
```

### Notarization Commands

```bash
# Submit for notarization
xcrun notarytool submit dist/MCP-EventKit-Server-0.1.2.pkg \
    --apple-id "your@email.com" \
    --team-id "TEAM_ID" \
    --password "app-specific-password" \
    --wait

# Staple the notarization ticket
xcrun stapler staple dist/MCP-EventKit-Server-0.1.2.pkg
```

### Store Credentials (Optional)

Save credentials to Keychain for convenience:

```bash
xcrun notarytool store-credentials "notary-profile" \
    --apple-id "your@email.com" \
    --team-id "TEAM_ID" \
    --password "app-specific-password"

# Then use:
xcrun notarytool submit dist/package.pkg \
    --keychain-profile "notary-profile" \
    --wait
```

## Package Structure

### Final PKG Contents

```
MCP-EventKit-Server-0.1.2.pkg
├── Distribution (XML manifest)
├── Resources/
│   ├── welcome.html
│   └── conclusion.html
└── component.pkg
    └── Payload/
        ├── Applications/
        │   ├── MCP EventKit.app/
        │   │   ├── Contents/
        │   │   │   ├── Info.plist
        │   │   │   ├── MacOS/
        │   │   │   │   └── mcp-eventkit
        │   │   │   ├── Frameworks/
        │   │   │   │   └── libEventKitBridge.dylib
        │   │   │   └── _CodeSignature/
        │   │   └── ...
        │   ├── MCP EventKit Setup.app/
        │   └── Uninstall MCP EventKit.app/
        └── Scripts/
            └── postinstall
```

### App Bundle Structure

```mermaid
graph TD
    subgraph "MCP EventKit.app"
        A[Contents/]
        A --> B[Info.plist<br/>Bundle metadata]
        A --> C[MacOS/]
        C --> D[mcp-eventkit<br/>Main executable]
        A --> E[Frameworks/]
        E --> F[libEventKitBridge.dylib]
        A --> G[_CodeSignature/]
        G --> H[CodeResources]
    end
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "code signature invalid" | Signing order wrong | Sign from inside out (dylib → binary → bundle) |
| Notarization rejected | Missing entitlements | Add required entitlements to plist |
| "No Keychain password item" | Credentials not stored | Use `notarytool store-credentials` |
| Calendar permissions fail | Missing entitlement | Add `com.apple.security.personal-information.calendars` |
| Hardened Runtime issues | JIT/memory flags | Add cs.allow-jit and related entitlements |

### Verify Signatures

```bash
# Check entitlements
codesign -d --entitlements - "App.app"

# Verify signature chain
codesign -dvvv "App.app"

# Check notarization
spctl -a -vvv -t install package.pkg
```

## Quick Reference

### Full Build Command

```bash
# Build everything and create signed, notarized installer
./src/swift-bridge/build.sh && \
bun build --compile --outfile build/mcp-eventkit src/index.ts && \
./installer/build-pkg.sh 0.1.2 && \
xcrun notarytool submit dist/MCP-EventKit-Server-0.1.2.pkg \
    --apple-id "email" --team-id "ID" --password "pass" --wait && \
xcrun stapler staple dist/MCP-EventKit-Server-0.1.2.pkg
```

### Environment Variables

```bash
export APP_SIGN_IDENTITY="Developer ID Application: Name (TEAM_ID)"
export PKG_SIGN_IDENTITY="Developer ID Installer: Name (TEAM_ID)"
```

## Version Checklist

When releasing a new version, update these files:

- [ ] `package.json` - `version` field
- [ ] `src/server.ts` - McpServer version
- [ ] `installer/MCP EventKit.app/Contents/Info.plist` - CFBundleShortVersionString
- [ ] `installer/PermissionHelper/Info.plist` - CFBundleShortVersionString (if changed)
