#!/bin/bash
# Build the MCP EventKit Setup app

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="MCP EventKit Setup.app"
APP_DIR="$SCRIPT_DIR/$APP_NAME"
ENTITLEMENTS="$SCRIPT_DIR/../entitlements.plist"

# Code signing identity (set this environment variable or modify here)
APP_SIGN_IDENTITY="${APP_SIGN_IDENTITY:-Developer ID Application: Alejandro Sanchez Rodriguez (8J6557H8MJ)}"

echo "Building MCP EventKit Setup..."

# Create app bundle structure
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Copy Info.plist
cp "$SCRIPT_DIR/Info.plist" "$APP_DIR/Contents/"

# Compile Swift code with SwiftUI support
swiftc -O \
    -o "$APP_DIR/Contents/MacOS/MCP EventKit Setup" \
    -framework Cocoa \
    -framework EventKit \
    -framework SwiftUI \
    -parse-as-library \
    "$SCRIPT_DIR/main.swift"

# Sign the app with entitlements
echo "Signing app with entitlements..."
if [ -f "$ENTITLEMENTS" ]; then
    codesign --force --options runtime --timestamp \
        --entitlements "$ENTITLEMENTS" \
        --sign "$APP_SIGN_IDENTITY" \
        "$APP_DIR"

    codesign --verify --deep --strict "$APP_DIR"
    echo "✅ App signed with entitlements"
else
    echo "⚠️  Entitlements not found at $ENTITLEMENTS, skipping code signing"
fi

echo "✅ Built: $APP_DIR"
