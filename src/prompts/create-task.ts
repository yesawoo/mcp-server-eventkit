import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Prompt template for creating well-structured reminders
 * Follows best practices:
 * - Actionable title starting with a verb
 * - Clear context in notes
 * - Realistic due date
 * - Appropriate priority
 */
export function registerCreateTaskPrompt(server: McpServer) {
  server.registerPrompt(
    "create-task",
    {
      title: "Create Task",
      description:
        "Guide for creating a well-structured reminder following productivity best practices. " +
        "Helps ensure tasks are actionable, have clear context, and appropriate deadlines.",
      argsSchema: {
        task_description: z
          .string()
          .describe("Brief description of what you want to accomplish"),
        context: z
          .string()
          .optional()
          .describe("Additional context: project, person involved, or reason"),
        urgency: z
          .enum(["today", "this_week", "this_month", "someday"])
          .optional()
          .describe("When should this be completed?"),
      },
    },
    async ({ task_description, context, urgency }) => {
      const urgencyGuidelines: Record<string, string> = {
        today: "Set due date to today. This is high priority.",
        this_week: "Set due date within the next 7 days.",
        this_month: "Set due date within the next 30 days.",
        someday: "No due date needed. Low priority.",
      };

      const urgencyText = urgency
        ? urgencyGuidelines[urgency]
        : "Determine appropriate deadline based on the task.";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Help me create a well-structured reminder for this task.

## Task Description
${task_description}

${context ? `## Context\n${context}\n` : ""}
## Urgency
${urgencyText}

## Instructions
Please create a reminder following these best practices:

1. **Title**: Start with an action verb (e.g., "Call", "Review", "Send", "Complete", "Research")
   - Keep it concise but specific
   - Include key identifiers (names, project codes)
   - Example: "Call Dr. Smith about test results" not "Doctor appointment"

2. **Notes**: Add helpful context that your future self will need:
   - Why is this task important?
   - Any relevant phone numbers, links, or reference info
   - Dependencies or prerequisites
   - Expected outcome

3. **Due Date**:
   - ${urgencyText}
   - Use ISO 8601 format (YYYY-MM-DDTHH:MM:SS)
   - Consider realistic time to complete

4. **Priority** (0-9 scale):
   - 0: No priority (default)
   - 1-3: Low priority (nice to have)
   - 4-6: Medium priority (should do)
   - 7-9: High priority (must do, urgent)

After analyzing the task, use the \`create_reminder\` tool to create it with the appropriate values.`,
            },
          },
        ],
      };
    }
  );
}
