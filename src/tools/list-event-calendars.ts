import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";

/**
 * Register the list_event_calendars tool
 */
export function registerListEventCalendarsTool(server: McpServer) {
  server.tool(
    "list_event_calendars",
    "List all available calendars for events (not reminders). Returns calendar ID, title, color, and permissions.",
    {},
    async () => {
      try {
        // Request calendar access first
        eventKitBridge.requestCalendarAccess();

        const calendars = eventKitBridge.listEventCalendars();

        if (calendars.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No calendars found. Make sure you have at least one calendar configured in the Calendar app.",
              },
            ],
          };
        }

        const calendarList = calendars
          .map((cal) => {
            const permissions = [];
            if (cal.isSubscribed) {
              permissions.push("subscribed");
            }
            if (cal.isImmutable) {
              permissions.push("read-only");
            }
            if (cal.allowsContentModifications) {
              permissions.push("editable");
            }

            return `- ${cal.title} (${cal.source})
    ID: ${cal.id}
    Color: ${cal.color}
    ${permissions.join(", ")}`;
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${calendars.length} calendar(s):\n\n${calendarList}`,
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
              text: `Failed to list calendars: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
