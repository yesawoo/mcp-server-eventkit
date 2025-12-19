import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { CreateCalendarEventSchema } from "../schemas/calendar-schema.js";

/**
 * Register the create_calendar_event tool
 */
export function registerCreateCalendarEventTool(server: McpServer) {
  server.tool(
    "create_calendar_event",
    "Create a new calendar event. Requires title, start_date, and end_date in ISO 8601 format.",
    CreateCalendarEventSchema.shape,
    async (params) => {
      try {
        // Request calendar access first
        eventKitBridge.requestCalendarAccess();

        const event = eventKitBridge.createCalendarEvent({
          title: params.title,
          startDate: params.start_date,
          endDate: params.end_date,
          calendarId: params.calendar_id,
          notes: params.notes,
          location: params.location,
          url: params.url,
          isAllDay: params.is_all_day,
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
              text: `Created event: **${event.title}**\n${dateStr}\n\n${details.join("\n")}`,
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
              text: `Failed to create event: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
