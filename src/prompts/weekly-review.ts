import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Prompt template for weekly review session
 * Based on GTD (Getting Things Done) methodology
 */
export function registerWeeklyReviewPrompt(server: McpServer) {
  server.registerPrompt(
    "weekly-review",
    {
      title: "Weekly Review",
      description:
        "Conduct a comprehensive weekly review of your reminders. " +
        "Clean up completed tasks, review progress, and plan ahead for next week.",
      argsSchema: {
        include_completed: z
          .boolean()
          .optional()
          .describe(
            "Include completed tasks from this week in the review (default: true)"
          ),
      },
    },
    async ({ include_completed }) => {
      const showCompleted = include_completed !== false;

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Help me conduct my weekly review.

## Instructions

Guide me through a comprehensive weekly review following these steps:

### Step 1: Celebrate Wins
${showCompleted ? "Use `list_reminders` with `completed: true` to show tasks I completed this week." : ""}
Acknowledge what was accomplished - this builds momentum and motivation.

### Step 2: Process Incomplete Tasks
Use \`list_reminders\` with \`completed: false\` to review all pending tasks.

For each task, help me decide:
- **Do it**: Still relevant and actionable? Keep it.
- **Defer it**: Not the right time? Update the due date.
- **Delegate it**: Should someone else handle this? Add a note.
- **Delete it**: No longer relevant? Mark as complete or remove.

### Step 3: Review by Calendar/List
Use \`list_calendars\` to see all my reminder lists.
Check if tasks are in the right lists/categories.

### Step 4: Check for Stuck Projects
Identify tasks that have been pending for more than 2 weeks.
These might need:
- Breaking down into smaller steps
- A different approach
- To be reconsidered

### Step 5: Identify Gaps
Ask me about areas of my life/work that might need new reminders:
- Are there any commitments I made this week that need follow-up?
- Any upcoming events or deadlines I should prepare for?
- Projects that need next actions defined?

### Step 6: Prioritize Next Week
Help me flag the most important tasks for next week using \`toggle_flag\`.

### Output Format

Please provide:
1. **Accomplishments**: Summary of completed tasks (if showing)
2. **Current State**: Total pending, overdue, and flagged counts
3. **Stuck Items**: Tasks pending too long that need attention
4. **Recommendations**: Specific actions to clean up my task list
5. **Focus for Next Week**: Top priorities to flag

After each section, offer to take action:
- Complete outdated tasks
- Update due dates
- Toggle flags for priorities
- Search for specific items if I mention them`,
            },
          },
        ],
      };
    }
  );
}
