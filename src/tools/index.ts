import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// Reminder tools
import { registerListRemindersTool } from "./list-reminders.js";
import { registerCreateReminderTool } from "./create-reminder.js";
import { registerCompleteReminderTool } from "./complete-reminder.js";
import { registerDeleteReminderTool } from "./delete-reminder.js";
import { registerUpdateReminderTool } from "./update-reminder.js";
import { registerSearchRemindersTool } from "./search-reminders.js";
import { registerListRemindersFilteredTool } from "./list-reminders-filtered.js";
import { registerToggleFlagTool } from "./toggle-flag.js";
import { registerListCalendarsTool } from "./list-calendars.js";
import { registerListTagsTool } from "./list-tags.js";
// Calendar event tools
import { registerListEventCalendarsTool } from "./list-event-calendars.js";
import { registerListCalendarEventsTool } from "./list-calendar-events.js";
import { registerCreateCalendarEventTool } from "./create-calendar-event.js";
import { registerUpdateCalendarEventTool } from "./update-calendar-event.js";
import { registerDeleteCalendarEventTool } from "./delete-calendar-event.js";

/**
 * Register all tools with the MCP server
 */
export function registerTools(server: McpServer) {
  // Reminder tools
  registerListRemindersTool(server);
  registerCreateReminderTool(server);
  registerCompleteReminderTool(server);
  registerDeleteReminderTool(server);
  registerUpdateReminderTool(server);
  registerSearchRemindersTool(server);
  registerListRemindersFilteredTool(server);
  registerToggleFlagTool(server);
  registerListCalendarsTool(server);
  registerListTagsTool(server);
  // Calendar event tools
  registerListEventCalendarsTool(server);
  registerListCalendarEventsTool(server);
  registerCreateCalendarEventTool(server);
  registerUpdateCalendarEventTool(server);
  registerDeleteCalendarEventTool(server);
}
