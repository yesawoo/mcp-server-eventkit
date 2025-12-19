#!/bin/bash

# Build script for EventKitBridge dynamic library

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
SWIFT_FILE="$SCRIPT_DIR/EventKitBridge.swift"
OUTPUT="$BUILD_DIR/libEventKitBridge.dylib"

# Create build directory
mkdir -p "$BUILD_DIR"

echo "Building EventKitBridge..."
echo "  Source: $SWIFT_FILE"
echo "  Output: $OUTPUT"

# Compile Swift to dynamic library
# -lsqlite3 links the SQLite3 library (included in macOS)
swiftc \
    -emit-library \
    -o "$OUTPUT" \
    "$SWIFT_FILE" \
    -module-name EventKitBridge \
    -Xlinker -install_name -Xlinker @rpath/libEventKitBridge.dylib \
    -lsqlite3 \
    -O

echo "✅ Built successfully: $OUTPUT"

# Show library info
echo ""
echo "Library info:"
file "$OUTPUT"
echo ""
echo "Exported symbols:"
nm -gU "$OUTPUT" | grep "ekb_" || echo "  (no ekb_ symbols found)"
