import { z } from "zod";

/**
 * Schema for creating a new reminder
 */
export const CreateReminderSchema = z.object({
  title: z.string().min(1).describe("The title of the reminder"),
  notes: z.string().optional().describe("Optional notes for the reminder"),
  due_date: z
    .string()
    .optional()
    .describe(
      "Optional due date in ISO 8601 format (e.g., 2025-12-20T10:00:00Z)"
    ),
  list_id: z
    .string()
    .optional()
    .describe(
      "Optional ID of the Reminders list to create in. Use list_reminder_lists to find IDs. Defaults to the user's default list."
    ),
  url: z
    .string()
    .url()
    .optional()
    .describe("Optional URL to associate with the reminder"),
});

export type CreateReminderInput = z.infer<typeof CreateReminderSchema>;

/**
 * Schema for listing reminders
 */
export const ListRemindersSchema = z.object({
  completed: z
    .boolean()
    .default(false)
    .describe(
      "If true, list completed reminders; if false, list incomplete reminders"
    ),
});

export type ListRemindersInput = z.infer<typeof ListRemindersSchema>;

/**
 * Schema for completing a reminder
 */
export const CompleteReminderSchema = z.object({
  reminder_id: z
    .string()
    .min(1)
    .describe("The ID of the reminder to mark as completed"),
});

export type CompleteReminderInput = z.infer<typeof CompleteReminderSchema>;

/**
 * Schema for deleting a reminder
 */
export const DeleteReminderSchema = z.object({
  reminder_id: z.string().min(1).describe("The ID of the reminder to delete"),
});

export type DeleteReminderInput = z.infer<typeof DeleteReminderSchema>;

/**
 * Schema for updating an existing reminder
 */
export const UpdateReminderSchema = z.object({
  reminder_id: z.string().min(1).describe("The ID of the reminder to update"),
  title: z.string().optional().describe("New title for the reminder"),
  notes: z.string().optional().describe("New notes for the reminder"),
  due_date: z
    .string()
    .optional()
    .describe(
      "New due date in ISO 8601 format (e.g., 2025-12-20T10:00:00Z). Use empty string to clear."
    ),
  priority: z
    .number()
    .min(0)
    .max(9)
    .optional()
    .describe("Priority (0 = none, 1-4 = high, 5 = medium, 6-9 = low)"),
});

export type UpdateReminderInput = z.infer<typeof UpdateReminderSchema>;

/**
 * Schema for searching reminders with advanced filters
 */
export const SearchRemindersSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Text to search for in reminder titles and/or notes"),
  completed: z
    .boolean()
    .optional()
    .describe(
      "Filter by completion status (true = completed, false = incomplete, omit = all)"
    ),
  flagged: z.boolean().optional().describe("Filter by flagged status"),
  priority_min: z
    .number()
    .min(0)
    .max(9)
    .optional()
    .describe("Minimum priority (0 = none, 1-4 = high, 5 = medium, 6-9 = low)"),
  priority_max: z
    .number()
    .min(0)
    .max(9)
    .optional()
    .describe("Maximum priority"),
  calendar_id: z.string().optional().describe("Filter by calendar/list ID"),
  due_before: z
    .string()
    .optional()
    .describe("Only include reminders due before this date (ISO 8601)"),
  due_after: z
    .string()
    .optional()
    .describe("Only include reminders due after this date (ISO 8601)"),
  has_due_date: z
    .boolean()
    .optional()
    .describe("Filter by whether reminder has a due date"),
  search_in: z
    .enum(["title", "notes", "both"])
    .optional()
    .describe("Where to search: 'title', 'notes', or 'both' (default)"),
  tag: z
    .string()
    .optional()
    .describe(
      "Filter by tag name (without # prefix). Only reminders with this tag will be returned."
    ),
});

export type SearchRemindersInput = z.infer<typeof SearchRemindersSchema>;

/**
 * Schema for listing reminders with advanced filters
 */
export const ListRemindersFilteredSchema = z.object({
  completed: z.boolean().optional().describe("Filter by completion status"),
  flagged: z.boolean().optional().describe("Filter by flagged status"),
  priority_min: z
    .number()
    .min(0)
    .max(9)
    .optional()
    .describe("Minimum priority (0 = none, 1-4 = high, 5 = medium, 6-9 = low)"),
  priority_max: z
    .number()
    .min(0)
    .max(9)
    .optional()
    .describe("Maximum priority"),
  calendar_id: z.string().optional().describe("Filter by calendar/list ID"),
});

export type ListRemindersFilteredInput = z.infer<
  typeof ListRemindersFilteredSchema
>;

/**
 * Schema for toggling flag on a reminder
 */
export const ToggleFlagSchema = z.object({
  reminder_id: z
    .string()
    .min(1)
    .describe("The ID of the reminder to toggle flag"),
});

export type ToggleFlagInput = z.infer<typeof ToggleFlagSchema>;
