import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { ListCalendarEventsSchema } from "../schemas/calendar-schema.js";

/**
 * Register the list_calendar_events tool
 */
export function registerListCalendarEventsTool(server: McpServer) {
  server.tool(
    "list_calendar_events",
    "List calendar events within a date range. Use ISO 8601 format for dates (e.g., 2024-01-15T09:00:00Z).",
    ListCalendarEventsSchema.shape,
    async (params) => {
      try {
        // Request calendar access first
        eventKitBridge.requestCalendarAccess();

        const events = eventKitBridge.listCalendarEvents({
          startDate: params.start_date,
          endDate: params.end_date,
          calendarIds: params.calendar_ids,
        });

        if (events.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No events found between ${params.start_date} and ${params.end_date}.`,
              },
            ],
          };
        }

        // Sort events by start date
        events.sort(
          (a, b) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );

        const eventList = events
          .map((event) => {
            const start = new Date(event.startDate);
            const end = new Date(event.endDate);

            let dateStr: string;
            if (event.isAllDay) {
              dateStr = `${start.toLocaleDateString()} (all day)`;
            } else {
              dateStr = `${start.toLocaleString()} - ${end.toLocaleTimeString()}`;
            }

            const details = [];
            if (event.location) {
              details.push(`Location: ${event.location}`);
            }
            if (event.notes) {
              details.push(`Notes: ${event.notes}`);
            }
            if (event.url) {
              details.push(`URL: ${event.url}`);
            }

            return `- **${event.title}**
    ${dateStr}
    Calendar: ${event.calendarTitle}
    ID: ${event.id}
    ${details.length > 0 ? details.join("\n    ") : ""}`;
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${events.length} event(s):\n\n${eventList}`,
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
              text: `Failed to list events: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
