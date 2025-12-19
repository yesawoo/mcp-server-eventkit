import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { UpdateCalendarEventSchema } from "../schemas/calendar-schema.js";

/**
 * Register the update_calendar_event tool
 */
export function registerUpdateCalendarEventTool(server: McpServer) {
  server.tool(
    "update_calendar_event",
    "Update an existing calendar event. Requires the event ID. Only provided fields will be updated.",
    UpdateCalendarEventSchema.shape,
    async (params) => {
      try {
        // Request calendar access first
        eventKitBridge.requestCalendarAccess();

        const event = eventKitBridge.updateCalendarEvent({
          id: params.id,
          title: params.title,
          startDate: params.start_date,
          endDate: params.end_date,
          notes: params.notes,
          location: params.location,
          url: params.url,
          isAllDay: params.is_all_day,
          calendarId: params.calendar_id,
        });

        const start = new Date(event.startDate);
        const end = new Date(event.endDate);

        let dateStr: string;
        if (event.isAllDay) {
          dateStr = `${start.toLocaleDateString()} (all day)`;
        } else {
          dateStr = `${start.toLocaleString()} - ${end.toLocaleTimeString()}`;
        }

        const details = [`Calendar: ${event.calendarTitle}`, `ID: ${event.id}`];
        if (event.location) {
          details.push(`Location: ${event.location}`);
        }
        if (event.notes) {
          details.push(`Notes: ${event.notes}`);
        }
        if (event.url) {
          details.push(`URL: ${event.url}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `Updated event: **${event.title}**\n${dateStr}\n\n${details.join("\n")}`,
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
              text: `Failed to update event: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
