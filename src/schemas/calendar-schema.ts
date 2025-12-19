import { z } from "zod";

/**
 * Schema for listing calendar events
 */
export const ListCalendarEventsSchema = z.object({
  start_date: z
    .string()
    .describe(
      "Start date/time in ISO 8601 format (e.g., 2024-01-15T09:00:00Z). Required."
    ),
  end_date: z
    .string()
    .describe(
      "End date/time in ISO 8601 format (e.g., 2024-01-15T17:00:00Z). Required."
    ),
  calendar_ids: z
    .array(z.string())
    .optional()
    .describe(
      "Filter by specific calendar IDs. If not provided, searches all calendars."
    ),
});

/**
 * Schema for creating a calendar event
 */
export const CreateCalendarEventSchema = z.object({
  title: z.string().describe("The title/name of the event. Required."),
  start_date: z
    .string()
    .describe(
      "Start date/time in ISO 8601 format (e.g., 2024-01-15T09:00:00Z). Required."
    ),
  end_date: z
    .string()
    .describe(
      "End date/time in ISO 8601 format (e.g., 2024-01-15T10:00:00Z). Required."
    ),
  calendar_id: z
    .string()
    .optional()
    .describe(
      "The calendar ID to create the event in. Uses default calendar if not specified."
    ),
  notes: z.string().optional().describe("Additional notes for the event."),
  location: z.string().optional().describe("Location of the event."),
  url: z.string().optional().describe("URL associated with the event."),
  is_all_day: z
    .boolean()
    .optional()
    .describe("Whether this is an all-day event. Defaults to false."),
});

/**
 * Schema for updating a calendar event
 */
export const UpdateCalendarEventSchema = z.object({
  id: z.string().describe("The ID of the event to update. Required."),
  title: z.string().optional().describe("New title for the event."),
  start_date: z
    .string()
    .optional()
    .describe("New start date/time in ISO 8601 format."),
  end_date: z
    .string()
    .optional()
    .describe("New end date/time in ISO 8601 format."),
  notes: z.string().optional().describe("New notes for the event."),
  location: z.string().optional().describe("New location for the event."),
  url: z.string().optional().describe("New URL for the event."),
  is_all_day: z.boolean().optional().describe("Change all-day status."),
  calendar_id: z
    .string()
    .optional()
    .describe("Move event to a different calendar."),
});

/**
 * Schema for deleting a calendar event
 */
export const DeleteCalendarEventSchema = z.object({
  id: z.string().describe("The ID of the event to delete. Required."),
});

export type ListCalendarEventsParams = z.infer<typeof ListCalendarEventsSchema>;
export type CreateCalendarEventParams = z.infer<
  typeof CreateCalendarEventSchema
>;
export type UpdateCalendarEventParams = z.infer<
  typeof UpdateCalendarEventSchema
>;
export type DeleteCalendarEventParams = z.infer<
  typeof DeleteCalendarEventSchema
>;
