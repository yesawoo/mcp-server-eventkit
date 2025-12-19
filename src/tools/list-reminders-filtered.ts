import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { ListRemindersFilteredSchema } from "../schemas/reminder-schema.js";

export function registerListRemindersFilteredTool(server: McpServer) {
  server.tool(
    "list_reminders_filtered",
    "List reminders with advanced filters. You can filter by completion status, flagged status, priority range, and calendar/list.",
    ListRemindersFilteredSchema.shape,
    async (args) => {
      try {
        const filters = ListRemindersFilteredSchema.parse(args);
        const reminders = eventKitBridge.listRemindersFiltered(filters);

        // Build filter description
        const filterParts: string[] = [];
        if (filters.completed !== undefined) {
          filterParts.push(filters.completed ? "completed" : "incomplete");
        }
        if (filters.flagged !== undefined) {
          filterParts.push(filters.flagged ? "flagged" : "not flagged");
        }
        if (
          filters.priority_min !== undefined ||
          filters.priority_max !== undefined
        ) {
          const min = filters.priority_min ?? 0;
          const max = filters.priority_max ?? 9;
          filterParts.push(`priority ${min}-${max}`);
        }
        if (filters.calendar_id) {
          filterParts.push(`calendar: ${filters.calendar_id}`);
        }

        const filterDesc =
          filterParts.length > 0 ? filterParts.join(", ") : "no filters";
        const summary = `Found ${reminders.length} reminder(s) with filters: ${filterDesc}`;

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
