import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Prompt template for quick brain dump / capture
 * Helps users quickly capture multiple tasks from a brain dump
 */
export function registerQuickCapturePrompt(server: McpServer) {
  server.registerPrompt(
    "quick-capture",
    {
      title: "Quick Capture",
      description:
        "Quickly capture multiple tasks from a brain dump. " +
        "Paste a list of things on your mind and convert them into well-structured reminders.",
      argsSchema: {
        brain_dump: z
          .string()
          .describe(
            "Your brain dump - list of tasks, ideas, or things you need to remember. " +
              "Can be messy, unstructured, bullet points, or stream of consciousness."
          ),
        default_list: z
          .string()
          .optional()
          .describe("Optional: calendar/list ID to add all tasks to"),
      },
    },
    async ({ brain_dump, default_list }) => {
      const listNote = default_list
        ? `\nAdd all tasks to the list with ID: ${default_list}`
        : "";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Help me process this brain dump into actionable reminders.

## Brain Dump
${brain_dump}
${listNote}

## Instructions

Parse the brain dump above and help me create reminders for each actionable item.

### Step 1: Identify Actionable Items
Extract each distinct task or reminder from the brain dump. Ignore:
- General observations or notes without action
- Duplicate items
- Already completed items (if mentioned)

### Step 2: Transform into Actions
For each item, create a proper task with:
- **Title**: Action verb + specific outcome
  - Bad: "Meeting"
  - Good: "Schedule meeting with design team"
- **Notes**: Any relevant context from the brain dump
- **Due Date**: Only if explicitly mentioned or clearly urgent
- **Priority**: Default to 0 unless urgency is indicated

### Step 3: Batch Create
Create each reminder using the \`create_reminder\` tool.

### Step 4: Summary
After creating all reminders, provide:
- Number of tasks created
- Any items that were skipped and why
- Suggestions for items that might need more clarification

### Guidelines
- Better to capture imperfectly than to lose the thought
- When in doubt, create the reminder - it can be refined later
- Group related items if they're clearly part of the same project
- If something is vague, create it anyway with a note to clarify

Let's process this brain dump now.`,
            },
          },
        ],
      };
    }
  );
}
