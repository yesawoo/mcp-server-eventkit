import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { ListRemindersSchema } from "../schemas/reminder-schema.js";

export function registerListRemindersTool(server: McpServer) {
  server.tool(
    "list_reminders",
    "List reminders from the macOS Reminders app. Returns either completed or incomplete reminders based on the 'completed' parameter.",
    ListRemindersSchema.shape,
    async (args) => {
      try {
        const { completed } = ListRemindersSchema.parse(args);
        const reminders = eventKitBridge.listReminders(completed);

        const statusText = completed ? "completed" : "incomplete";
        const summary = `Found ${reminders.length} ${statusText} reminder(s)`;

        return {
          content: [
            {
              type: "text" as const,
              text: `${summary}\n\n${JSON.stringify(reminders, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing reminders: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
