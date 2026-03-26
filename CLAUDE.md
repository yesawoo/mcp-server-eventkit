# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP server providing native macOS EventKit integration (Reminders + Calendar) via Bun FFI to a Swift dynamic library. Distributed as a Claude Desktop Extension (.mcpb).

## Commands

```bash
bun install              # Install dependencies
bun run build            # Build Swift bridge + standalone binary
bun run build:swift      # Build only libEventKitBridge.dylib
bun run build:binary     # Build only the standalone bun binary
bun run dev              # Run with hot reload
bun run start            # Run server (stdio transport)
bun test                 # Run tests
bun run lint             # ESLint
bun run lint:fix         # ESLint with auto-fix
bun run format:check     # Prettier check
bun run typecheck        # TypeScript type checking
just check               # Run lint + format:check + typecheck
just pack                # Build + validate manifest + pack .mcpb
just release patch       # Bump version, commit, tag, push (triggers CI release)
```

## Architecture

Three-layer architecture: **MCP (TypeScript) → FFI Bridge (Bun FFI) → Native (Swift/EventKit)**

- `src/index.ts` — Entry point. Creates stdio transport, checks macOS permissions on startup.
- `src/server.ts` — Creates `McpServer` instance, registers tools and prompts.
- `src/swift-bridge/EventKitBridge.swift` — Swift native module compiled to `libEventKitBridge.dylib`. Exports C-compatible `ekb_*` functions using `@_cdecl`. Communicates via JSON strings over FFI pointers.
- `src/swift-bridge/eventkit-bridge.ts` — TypeScript FFI bindings using `bun:ffi` `dlopen`. The `EventKitBridge` class wraps each `ekb_*` symbol, handling pointer/string conversion and JSON parsing. Exported as singleton `eventKitBridge`.
- `src/tools/` — One file per MCP tool. Each exports a `register*Tool(server)` function that calls `server.tool()` with a Zod schema and handler that delegates to `eventKitBridge`.
- `src/schemas/` — Zod schemas for tool input validation (`reminder-schema.ts`, `calendar-schema.ts`).
- `src/prompts/` — MCP prompt templates (daily planning, weekly review, quick capture, create task).
- `manifest.json` — Claude Desktop Extension manifest for .mcpb packaging.

### Adding a new tool

1. Add Zod schema in `src/schemas/`
2. Add Swift function with `@_cdecl("ekb_...")` in `EventKitBridge.swift`
3. Add FFI symbol + TypeScript method in `eventkit-bridge.ts`
4. Create tool file in `src/tools/` following existing pattern
5. Register in `src/tools/index.ts`

### Key conventions

- All FFI communication uses JSON strings: TypeScript serializes params to JSON → passes as C string pointer → Swift parses, processes, returns JSON → TypeScript reads and frees pointer.
- stdout is reserved for MCP protocol; all logging goes to stderr via `console.error`.
- Version is tracked in three places: `package.json`, `manifest.json`, `src/server.ts`. Use `just release` to bump all three.
- Commit messages follow conventional commits: `feat(scope):`, `fix(scope):`, `chore:`, etc.
