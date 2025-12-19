import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { CompleteReminderSchema } from "../schemas/reminder-schema.js";

export function registerCompleteReminderTool(server: McpServer) {
  server.tool(
    "complete_reminder",
    "Mark a reminder as completed in the macOS Reminders app. The reminder will be moved to the completed list.",
    CompleteReminderSchema.shape,
    async (args) => {
      try {
        const { reminder_id } = CompleteReminderSchema.parse(args);
        const reminder = eventKitBridge.completeReminder(reminder_id);

        return {
          content: [
            {
              type: "text" as const,
              text: `Completed reminder: "${reminder.title}"\nCompleted at: ${reminder.completionDate}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error completing reminder: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
