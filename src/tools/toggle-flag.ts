import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { ToggleFlagSchema } from "../schemas/reminder-schema.js";

export function registerToggleFlagTool(server: McpServer) {
  server.tool(
    "toggle_flag",
    "Toggle the flagged status of a reminder. If the reminder is flagged, it will be unflagged, and vice versa.",
    ToggleFlagSchema.shape,
    async (args) => {
      try {
        const { reminder_id } = ToggleFlagSchema.parse(args);
        const reminder = eventKitBridge.toggleFlag(reminder_id);

        const flagStatus = reminder.isFlagged ? "flagged" : "unflagged";
        const summary = `Reminder "${reminder.title}" is now ${flagStatus}`;

        return {
          content: [
            {
              type: "text" as const,
              text: `${summary}\n\n${JSON.stringify(reminder, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error toggling flag: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
