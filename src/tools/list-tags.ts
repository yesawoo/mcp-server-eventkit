import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { eventKitBridge } from "../swift-bridge/eventkit-bridge.js";
import { z } from "zod";

const ListTagsSchema = z.object({
  include_empty: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include tags with zero reminders (orphaned tags)"),
});

export function registerListTagsTool(server: McpServer) {
  server.tool(
    "list_tags",
    "List all unique tags from Apple Reminders with the count of reminders using each tag. " +
      "Tags are read directly from the Reminders SQLite database (read-only). " +
      "Requires Full Disk Access permission in System Preferences.",
    ListTagsSchema.shape,
    async (args) => {
      try {
        const params = ListTagsSchema.parse(args);
        const tags = eventKitBridge.listTags();

        // Filter out empty tags unless requested
        const filtered = params.include_empty
          ? tags
          : tags.filter((t) => t.reminderCount > 0);

        const totalTags = filtered.length;
        const totalUsage = filtered.reduce(
          (sum, t) => sum + t.reminderCount,
          0
        );

        const summary = `Found ${totalTags} tag(s) used across ${totalUsage} reminder(s)`;

        // Format output as a nice list
        const tagList =
          filtered.length > 0
            ? filtered
                .map(
                  (t) =>
                    `  #${t.name} (${t.reminderCount} reminder${t.reminderCount !== 1 ? "s" : ""})`
                )
                .join("\n")
            : "  (no tags found)";

        return {
          content: [
            {
              type: "text" as const,
              text: `${summary}\n\nTags:\n${tagList}\n\nRaw data:\n${JSON.stringify(filtered, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing tags: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
