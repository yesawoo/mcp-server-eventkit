import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";

export function registerListCalendarsTool(server: McpServer) {
  server.tool(
    "list_calendars",
    "List all available reminder calendars/lists. Returns the calendar ID and title for each. Use the calendar ID when filtering reminders by list.",
    {},
    async () => {
      try {
        const calendars = eventKitBridge.listCalendars();

        const summary = `Found ${calendars.length} reminder calendar(s)/list(s)`;

        return {
          content: [
            {
              type: "text" as const,
              text: `${summary}\n\n${JSON.stringify(calendars, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing calendars: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
