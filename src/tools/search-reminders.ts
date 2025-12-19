import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { SearchRemindersSchema } from "../schemas/reminder-schema.js";

export function registerSearchRemindersTool(server: McpServer) {
  server.tool(
    "search_reminders",
    "Search reminders by text with optional filters. " +
      "Combine text search with filters for completion status, flagged, priority, calendar, and due dates.",
    SearchRemindersSchema.shape,
    async (args) => {
      try {
        const params = SearchRemindersSchema.parse(args);
        let reminders = eventKitBridge.searchReminders(params);

        // Filter by tag if specified (uses SQLite database)
        if (params.tag) {
          const taggedIds = eventKitBridge.getReminderIdsByTag(params.tag);
          reminders = reminders.filter((r) => taggedIds.includes(r.id));
        }

        // Build filter description
        const filterParts: string[] = [`query: "${params.query}"`];
        if (params.completed !== undefined) {
          filterParts.push(params.completed ? "completed" : "incomplete");
        }
        if (params.flagged !== undefined) {
          filterParts.push(params.flagged ? "flagged" : "not flagged");
        }
        if (
          params.priority_min !== undefined ||
          params.priority_max !== undefined
        ) {
          const min = params.priority_min ?? 0;
          const max = params.priority_max ?? 9;
          filterParts.push(`priority ${min}-${max}`);
        }
        if (params.calendar_id) {
          filterParts.push(`calendar: ${params.calendar_id}`);
        }
        if (params.due_before) {
          filterParts.push(`due before: ${params.due_before}`);
        }
        if (params.due_after) {
          filterParts.push(`due after: ${params.due_after}`);
        }
        if (params.has_due_date !== undefined) {
          filterParts.push(
            params.has_due_date ? "has due date" : "no due date"
          );
        }
        if (params.search_in) {
          filterParts.push(`search in: ${params.search_in}`);
        }
        if (params.tag) {
          filterParts.push(`tag: #${params.tag}`);
        }

        const filterDesc = filterParts.join(", ");
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
              text: `Error searching reminders: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
