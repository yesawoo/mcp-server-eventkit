#!/usr/bin/env bun

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { eventKitBridge } from "./swift-bridge/eventkit-bridge.js";
import { spawn } from "child_process";
import { existsSync } from "fs";

const SETUP_APP_PATH = "/Applications/MCP EventKit Setup.app";

/**
 * Check if we have the necessary permissions and open Setup app if not
 */
function checkAndRequestPermissions(): void {
  try {
    const status = eventKitBridge.checkPermissions();

    if (!status.calendarsGranted || !status.remindersGranted) {
      console.error(
        `[eventkit] Permissions not granted - Calendars: ${status.calendars}, Reminders: ${status.reminders}`
      );

      // Open the Setup app to request permissions
      if (existsSync(SETUP_APP_PATH)) {
        console.error(
          `[eventkit] Opening MCP EventKit Setup to request permissions...`
        );
        spawn("open", [SETUP_APP_PATH], {
          detached: true,
          stdio: "ignore",
        }).unref();
      } else {
        console.error(
          `[eventkit] Setup app not found. Please grant permissions manually in System Settings > Privacy & Security`
        );
      }
    } else {
      console.error(
        `[eventkit] Permissions OK - Calendars: ${status.calendars}, Reminders: ${status.reminders}`
      );
    }
  } catch (error) {
    console.error(`[eventkit] Error checking permissions:`, error);
  }
}

async function main() {
  // Check permissions on startup
  checkAndRequestPermissions();

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr (stdout is used for MCP communication)
  console.error("EventKit MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
