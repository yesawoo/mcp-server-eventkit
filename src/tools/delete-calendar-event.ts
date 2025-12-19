import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { DeleteCalendarEventSchema } from "../schemas/calendar-schema.js";

/**
 * Register the delete_calendar_event tool
 */
export function registerDeleteCalendarEventTool(server: McpServer) {
  server.tool(
    "delete_calendar_event",
    "Delete a calendar event by its ID. This action cannot be undone.",
    DeleteCalendarEventSchema.shape,
    async (params) => {
      try {
        // Request calendar access first
        eventKitBridge.requestCalendarAccess();

        eventKitBridge.deleteCalendarEvent(params.id);

        return {
          content: [
            {
              type: "text",
              text: `Successfully deleted event with ID: ${params.id}`,
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Failed to delete event: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
