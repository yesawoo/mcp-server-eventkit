import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { CreateReminderSchema } from "../schemas/reminder-schema.js";

export function registerCreateReminderTool(server: McpServer) {
  server.tool(
    "create_reminder",
    "Create a new reminder in the macOS Reminders app. Optionally specify a list_id to create in a specific list (use list_reminder_lists to find IDs), otherwise uses the default list. Syncs via iCloud.",
    CreateReminderSchema.shape,
    async (args) => {
      try {
        const params = CreateReminderSchema.parse(args);
        const reminder = eventKitBridge.createReminder(params);

        let response = `Created reminder: "${reminder.title}"`;
        if (reminder.dueDate) {
          response += `\nDue: ${reminder.dueDate}`;
        }
        if (reminder.notes) {
          response += `\nNotes: ${reminder.notes}`;
        }
        response += `\nID: ${reminder.id}`;

        return {
          content: [
            {
              type: "text" as const,
              text: response,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating reminder: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
