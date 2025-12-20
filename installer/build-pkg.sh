#!/bin/bash
# Build the .pkg installer for MCP EventKit Server

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION="${1:-1.0.0}"
IDENTIFIER="com.mcp.eventkit-server"
PKG_NAME="MCP-EventKit-Server-${VERSION}.pkg"
APP_NAME="MCP EventKit.app"
SETUP_APP_NAME="MCP EventKit Setup.app"

# Code signing identities (set these environment variables or modify here)
APP_SIGN_IDENTITY="${APP_SIGN_IDENTITY:-Developer ID Application: Alejandro Sanchez Rodriguez (8J6557H8MJ)}"
PKG_SIGN_IDENTITY="${PKG_SIGN_IDENTITY:-Developer ID Installer: Alejandro Sanchez Rodriguez (8J6557H8MJ)}"
ENTITLEMENTS="$SCRIPT_DIR/entitlements.plist"

echo "Building MCP EventKit Server installer v${VERSION}..."

# Ensure binaries are built
if [ ! -f "$PROJECT_DIR/build/mcp-eventkit" ]; then
    echo "Error: Binary not found. Run 'bun build --compile --outfile build/mcp-eventkit src/index.ts' first"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/build/libEventKitBridge.dylib" ]; then
    echo "Error: Swift library not found. Run './src/swift-bridge/build.sh' first"
    exit 1
fi

# Build Permission Helper app
echo "Building Permission Helper app..."
"$SCRIPT_DIR/PermissionHelper/build.sh"

# Build main app bundle
echo "Building main app bundle..."
APP_DIR="$SCRIPT_DIR/$APP_NAME"
rm -rf "$APP_DIR/Contents/MacOS/"*
rm -rf "$APP_DIR/Contents/Frameworks/"*

# Copy binary and library into app bundle
cp "$PROJECT_DIR/build/mcp-eventkit" "$APP_DIR/Contents/MacOS/"
cp "$PROJECT_DIR/build/libEventKitBridge.dylib" "$APP_DIR/Contents/Frameworks/"

# Update version in Info.plist
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$APP_DIR/Contents/Info.plist"

# Sign app bundles
echo "Signing app bundles..."
if [ -f "$ENTITLEMENTS" ]; then
    # Sign main app bundle
    codesign --force --options runtime --timestamp \
        --entitlements "$ENTITLEMENTS" \
        --sign "$APP_SIGN_IDENTITY" \
        "$APP_DIR/Contents/Frameworks/libEventKitBridge.dylib"

    codesign --force --options runtime --timestamp \
        --entitlements "$ENTITLEMENTS" \
        --sign "$APP_SIGN_IDENTITY" \
        "$APP_DIR/Contents/MacOS/mcp-eventkit"

    codesign --force --options runtime --timestamp \
        --entitlements "$ENTITLEMENTS" \
        --sign "$APP_SIGN_IDENTITY" \
        "$APP_DIR"

    codesign --verify --deep --strict "$APP_DIR"
    echo "✅ Main app bundle signed"

    # Sign Setup app with entitlements
    SETUP_APP="$SCRIPT_DIR/PermissionHelper/$SETUP_APP_NAME"
    codesign --force --options runtime --timestamp \
        --entitlements "$ENTITLEMENTS" \
        --sign "$APP_SIGN_IDENTITY" \
        "$SETUP_APP"

    codesign --verify --deep --strict "$SETUP_APP"
    echo "✅ Setup app signed"
else
    echo "⚠️  Entitlements not found, skipping code signing"
fi

# Update payload
echo "Updating payload..."
rm -rf "$SCRIPT_DIR/payload"
mkdir -p "$SCRIPT_DIR/payload/Applications"
mkdir -p "$SCRIPT_DIR/payload/usr/local/bin"

# Copy app bundles to payload
cp -R "$APP_DIR" "$SCRIPT_DIR/payload/Applications/"
cp -R "$SCRIPT_DIR/PermissionHelper/$SETUP_APP_NAME" "$SCRIPT_DIR/payload/Applications/"
cp -R "$SCRIPT_DIR/Uninstall MCP EventKit.app" "$SCRIPT_DIR/payload/Applications/"

# Create component package
echo "Creating component package..."
pkgbuild \
    --root "$SCRIPT_DIR/payload" \
    --scripts "$SCRIPT_DIR/scripts" \
    --identifier "$IDENTIFIER" \
    --version "$VERSION" \
    --install-location "/" \
    "$SCRIPT_DIR/component.pkg"

# Create distribution.xml
cat > "$SCRIPT_DIR/distribution.xml" << EOF
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
    <title>MCP EventKit Server</title>
    <organization>com.mcp</organization>
    <domains enable_localSystem="true"/>
    <options customize="never" require-scripts="true" rootVolumeOnly="true"/>

    <welcome file="welcome.html"/>
    <conclusion file="conclusion.html"/>

    <choices-outline>
        <line choice="default">
            <line choice="com.mcp.eventkit-server"/>
        </line>
    </choices-outline>

    <choice id="default"/>
    <choice id="com.mcp.eventkit-server" visible="false">
        <pkg-ref id="com.mcp.eventkit-server"/>
    </choice>

    <pkg-ref id="com.mcp.eventkit-server" version="$VERSION" onConclusion="none">component.pkg</pkg-ref>
</installer-gui-script>
EOF

# Create product archive
echo "Creating installer package..."
mkdir -p "$PROJECT_DIR/dist"
productbuild \
    --distribution "$SCRIPT_DIR/distribution.xml" \
    --resources "$SCRIPT_DIR/resources" \
    --package-path "$SCRIPT_DIR" \
    "$PROJECT_DIR/dist/$PKG_NAME"

# Sign the pkg
echo "Signing installer package..."
productsign --sign "$PKG_SIGN_IDENTITY" \
    "$PROJECT_DIR/dist/$PKG_NAME" \
    "$PROJECT_DIR/dist/${PKG_NAME%.pkg}-signed.pkg"

# Replace unsigned with signed
mv "$PROJECT_DIR/dist/${PKG_NAME%.pkg}-signed.pkg" "$PROJECT_DIR/dist/$PKG_NAME"
echo "✅ Installer package signed"

# Cleanup
rm -f "$SCRIPT_DIR/component.pkg"
rm -f "$SCRIPT_DIR/distribution.xml"
rm -rf "$SCRIPT_DIR/payload"

echo ""
echo "============================================"
echo "  Installer created and signed!"
echo "  $PROJECT_DIR/dist/$PKG_NAME"
echo "============================================"
echo ""
echo "To notarize:"
echo "  xcrun notarytool submit dist/$PKG_NAME --apple-id YOUR_APPLE_ID --team-id YOUR_TEAM_ID --password YOUR_APP_SPECIFIC_PASSWORD --wait"
echo ""
echo "To staple after notarization:"
echo "  xcrun stapler staple dist/$PKG_NAME"
