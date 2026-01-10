import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { DeleteReminderSchema } from "../schemas/reminder-schema.js";

export function registerDeleteReminderTool(server: McpServer) {
  server.tool(
    "delete_reminder",
    "Delete a reminder permanently from the macOS Reminders app. This action cannot be undone.",
    DeleteReminderSchema.shape,
    async (args) => {
      try {
        const { reminder_id } = DeleteReminderSchema.parse(args);
        eventKitBridge.deleteReminder(reminder_id);

        return {
          content: [
            {
              type: "text" as const,
              text: `Reminder deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error deleting reminder: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
