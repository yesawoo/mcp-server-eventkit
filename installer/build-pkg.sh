#!/bin/bash
# Build the .pkg installer for MCP EventKit Server

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION="${1:-1.0.0}"
IDENTIFIER="com.mcp.eventkit-server"
PKG_NAME="MCP-EventKit-Server-${VERSION}.pkg"

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

# Update payload
echo "Updating payload..."
mkdir -p "$SCRIPT_DIR/payload/usr/local/lib/mcp-eventkit"
cp "$PROJECT_DIR/build/mcp-eventkit" "$SCRIPT_DIR/payload/usr/local/lib/mcp-eventkit/"
cp "$PROJECT_DIR/build/libEventKitBridge.dylib" "$SCRIPT_DIR/payload/usr/local/lib/mcp-eventkit/"

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
productbuild \
    --distribution "$SCRIPT_DIR/distribution.xml" \
    --resources "$SCRIPT_DIR/resources" \
    --package-path "$SCRIPT_DIR" \
    "$PROJECT_DIR/dist/$PKG_NAME"

# Cleanup
rm -f "$SCRIPT_DIR/component.pkg"
rm -f "$SCRIPT_DIR/distribution.xml"

echo ""
echo "============================================"
echo "  Installer created successfully!"
echo "  $PROJECT_DIR/dist/$PKG_NAME"
echo "============================================"
echo ""
echo "To install: double-click the .pkg file"
echo "To sign (optional): productsign --sign 'Developer ID Installer' dist/$PKG_NAME dist/$PKG_NAME.signed"
