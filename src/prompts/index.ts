import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateTaskPrompt } from "./create-task.js";
import { registerDailyPlanningPrompt } from "./daily-planning.js";
import { registerWeeklyReviewPrompt } from "./weekly-review.js";
import { registerQuickCapturePrompt } from "./quick-capture.js";

/**
 * Register all prompt templates with the MCP server
 *
 * Prompts provide structured templates for common task management workflows:
 * - create-task: Guide for creating well-structured reminders
 * - daily-planning: Morning planning session to prioritize the day
 * - weekly-review: GTD-style weekly review process
 * - quick-capture: Batch process a brain dump into reminders
 */
export function registerPrompts(server: McpServer) {
  registerCreateTaskPrompt(server);
  registerDailyPlanningPrompt(server);
  registerWeeklyReviewPrompt(server);
  registerQuickCapturePrompt(server);
}
