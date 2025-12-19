import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { UpdateReminderSchema } from "../schemas/reminder-schema.js";

export function registerUpdateReminderTool(server: McpServer) {
  server.tool(
    "update_reminder",
    "Update an existing reminder in the macOS Reminders app. You can change the title, notes, due date, or priority.",
    UpdateReminderSchema.shape,
    async (args) => {
      try {
        const { reminder_id, ...updateFields } =
          UpdateReminderSchema.parse(args);
        const reminder = eventKitBridge.updateReminder(
          reminder_id,
          updateFields
        );

        let response = `Updated reminder: "${reminder.title}"`;
        if (reminder.dueDate) {
          response += `\nDue: ${reminder.dueDate}`;
        }
        if (reminder.notes) {
          response += `\nNotes: ${reminder.notes}`;
        }
        response += `\nPriority: ${reminder.priority}`;
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
              text: `Error updating reminder: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
