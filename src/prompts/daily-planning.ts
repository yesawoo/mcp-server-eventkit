import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Prompt template for daily planning session
 * Helps users review and prioritize their tasks for the day
 */
export function registerDailyPlanningPrompt(server: McpServer) {
  server.registerPrompt(
    "daily-planning",
    {
      title: "Daily Planning",
      description:
        "Start your day with a structured planning session. " +
        "Reviews pending reminders, helps prioritize tasks, and identifies what to focus on today.",
      argsSchema: {
        focus_area: z
          .string()
          .optional()
          .describe("Optional: specific project or area to focus on today"),
        available_hours: z
          .number()
          .optional()
          .describe(
            "Optional: how many hours you have available for tasks today"
          ),
      },
    },
    async ({ focus_area, available_hours }) => {
      const focusText = focus_area
        ? `\n## Focus Area\nToday I want to focus on: ${focus_area}\n`
        : "";

      const hoursText = available_hours
        ? `\n## Available Time\nI have approximately ${available_hours} hours available for tasks today.\n`
        : "";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Help me plan my day effectively.
${focusText}${hoursText}
## Instructions

Please help me with my daily planning by following these steps:

### Step 1: Review Current Tasks
Use \`list_reminders\` to get all incomplete reminders. Then use \`list_reminders_filtered\` with \`flagged: true\` to see high-priority items.

### Step 2: Categorize by Urgency
Group the tasks into:
- **Overdue**: Past due date - need immediate attention
- **Due Today**: Must be completed today
- **Due This Week**: Can be scheduled for later
- **No Due Date**: Need to decide if they should be scheduled

### Step 3: Identify Top 3 Priorities
Based on due dates and importance, recommend my top 3 tasks to focus on today. Consider:
- Deadlines
- Flagged status (high priority)
- Dependencies (does something else depend on this?)
- Energy required vs time available

### Step 4: Quick Wins
Identify 2-3 small tasks (under 15 minutes) that I could do between larger tasks.

### Step 5: Defer or Delegate
Suggest any tasks that could be:
- Moved to a later date
- Broken down into smaller steps
- Potentially removed if no longer relevant

### Output Format

Please provide:
1. A summary of my task landscape (total pending, overdue, due today)
2. My recommended TOP 3 priorities for today
3. Quick wins I can tackle in spare moments
4. Any suggestions for task management (defer, break down, or remove)

After the analysis, offer to help me:
- Flag important tasks using \`toggle_flag\`
- Update due dates using \`update_reminder\`
- Complete tasks that are done using \`complete_reminder\``,
            },
          },
        ],
      };
    }
  );
}
