#!/bin/bash
# MCP EventKit Server - Uninstaller

set -e

echo "=========================================="
echo "  MCP EventKit Server - Desinstalador"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Este script requiere permisos de administrador."
    echo "Ejecuta: sudo $0"
    exit 1
fi

echo "Eliminando archivos..."

# Remove installed files
rm -rf /usr/local/lib/mcp-eventkit
rm -f /usr/local/bin/mcp-eventkit

echo "  - Binarios eliminados"

# Remove from Claude Desktop config
CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
if [ -f "$CLAUDE_CONFIG" ]; then
    # Use Python to safely remove the eventkit entry
    python3 << 'PYTHON'
import json
import os

config_path = os.path.expanduser("~/Library/Application Support/Claude/claude_desktop_config.json")

try:
    with open(config_path, 'r') as f:
        config = json.load(f)

    if 'mcpServers' in config and 'eventkit' in config['mcpServers']:
        del config['mcpServers']['eventkit']

        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)

        print("  - Configuracion de Claude Desktop actualizada")
    else:
        print("  - No se encontro configuracion de eventkit en Claude Desktop")
except Exception as e:
    print(f"  - No se pudo actualizar config de Claude Desktop: {e}")
PYTHON
fi

echo ""
echo "=========================================="
echo "  Desinstalacion completada"
echo "=========================================="
echo ""
echo "Reinicia Claude Desktop para aplicar los cambios."
echo ""
