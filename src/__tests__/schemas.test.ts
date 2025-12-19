import { describe, expect, test } from "bun:test";
import {
  CreateReminderSchema,
  ListRemindersSchema,
  CompleteReminderSchema,
  UpdateReminderSchema,
  SearchRemindersSchema,
  ListRemindersFilteredSchema,
  ToggleFlagSchema,
} from "../schemas/reminder-schema";
import {
  ListCalendarEventsSchema,
  CreateCalendarEventSchema,
  UpdateCalendarEventSchema,
  DeleteCalendarEventSchema,
} from "../schemas/calendar-schema";

describe("Reminder Schemas", () => {
  describe("CreateReminderSchema", () => {
    test("accepts valid reminder with title only", () => {
      const result = CreateReminderSchema.safeParse({ title: "Buy groceries" });
      expect(result.success).toBe(true);
    });

    test("accepts reminder with all fields", () => {
      const result = CreateReminderSchema.safeParse({
        title: "Meeting",
        notes: "Discuss project",
        due_date: "2025-12-20T10:00:00Z",
      });
      expect(result.success).toBe(true);
    });

    test("rejects empty title", () => {
      const result = CreateReminderSchema.safeParse({ title: "" });
      expect(result.success).toBe(false);
    });

    test("rejects missing title", () => {
      const result = CreateReminderSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("ListRemindersSchema", () => {
    test("defaults completed to false", () => {
      const result = ListRemindersSchema.parse({});
      expect(result.completed).toBe(false);
    });

    test("accepts completed true", () => {
      const result = ListRemindersSchema.parse({ completed: true });
      expect(result.completed).toBe(true);
    });
  });

  describe("CompleteReminderSchema", () => {
    test("accepts valid reminder_id", () => {
      const result = CompleteReminderSchema.safeParse({
        reminder_id: "abc123",
      });
      expect(result.success).toBe(true);
    });

    test("rejects empty reminder_id", () => {
      const result = CompleteReminderSchema.safeParse({ reminder_id: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("UpdateReminderSchema", () => {
    test("accepts reminder_id with optional fields", () => {
      const result = UpdateReminderSchema.safeParse({
        reminder_id: "abc123",
        title: "Updated title",
        priority: 5,
      });
      expect(result.success).toBe(true);
    });

    test("validates priority range", () => {
      const tooHigh = UpdateReminderSchema.safeParse({
        reminder_id: "abc123",
        priority: 10,
      });
      expect(tooHigh.success).toBe(false);

      const tooLow = UpdateReminderSchema.safeParse({
        reminder_id: "abc123",
        priority: -1,
      });
      expect(tooLow.success).toBe(false);

      const valid = UpdateReminderSchema.safeParse({
        reminder_id: "abc123",
        priority: 0,
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("SearchRemindersSchema", () => {
    test("accepts query with filters", () => {
      const result = SearchRemindersSchema.safeParse({
        query: "groceries",
        completed: false,
        flagged: true,
        search_in: "both",
      });
      expect(result.success).toBe(true);
    });

    test("validates search_in enum", () => {
      const valid = SearchRemindersSchema.safeParse({
        query: "test",
        search_in: "title",
      });
      expect(valid.success).toBe(true);

      const invalid = SearchRemindersSchema.safeParse({
        query: "test",
        search_in: "invalid",
      });
      expect(invalid.success).toBe(false);
    });

    test("rejects empty query", () => {
      const result = SearchRemindersSchema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("ListRemindersFilteredSchema", () => {
    test("accepts empty object", () => {
      const result = ListRemindersFilteredSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test("accepts all filter options", () => {
      const result = ListRemindersFilteredSchema.safeParse({
        completed: true,
        flagged: false,
        priority_min: 1,
        priority_max: 4,
        calendar_id: "cal123",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("ToggleFlagSchema", () => {
    test("accepts valid reminder_id", () => {
      const result = ToggleFlagSchema.safeParse({ reminder_id: "abc123" });
      expect(result.success).toBe(true);
    });

    test("rejects empty reminder_id", () => {
      const result = ToggleFlagSchema.safeParse({ reminder_id: "" });
      expect(result.success).toBe(false);
    });
  });
});

describe("Calendar Schemas", () => {
  describe("ListCalendarEventsSchema", () => {
    test("accepts valid date range", () => {
      const result = ListCalendarEventsSchema.safeParse({
        start_date: "2024-01-15T09:00:00Z",
        end_date: "2024-01-15T17:00:00Z",
      });
      expect(result.success).toBe(true);
    });

    test("accepts with calendar_ids filter", () => {
      const result = ListCalendarEventsSchema.safeParse({
        start_date: "2024-01-15T09:00:00Z",
        end_date: "2024-01-15T17:00:00Z",
        calendar_ids: ["cal1", "cal2"],
      });
      expect(result.success).toBe(true);
    });

    test("rejects missing dates", () => {
      const result = ListCalendarEventsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("CreateCalendarEventSchema", () => {
    test("accepts valid event", () => {
      const result = CreateCalendarEventSchema.safeParse({
        title: "Team Meeting",
        start_date: "2024-01-15T09:00:00Z",
        end_date: "2024-01-15T10:00:00Z",
      });
      expect(result.success).toBe(true);
    });

    test("accepts event with all fields", () => {
      const result = CreateCalendarEventSchema.safeParse({
        title: "Conference",
        start_date: "2024-01-15T09:00:00Z",
        end_date: "2024-01-15T17:00:00Z",
        calendar_id: "cal123",
        notes: "Annual conference",
        location: "Convention Center",
        url: "https://example.com",
        is_all_day: false,
      });
      expect(result.success).toBe(true);
    });

    test("rejects missing required fields", () => {
      const noTitle = CreateCalendarEventSchema.safeParse({
        start_date: "2024-01-15T09:00:00Z",
        end_date: "2024-01-15T10:00:00Z",
      });
      expect(noTitle.success).toBe(false);

      const noStart = CreateCalendarEventSchema.safeParse({
        title: "Meeting",
        end_date: "2024-01-15T10:00:00Z",
      });
      expect(noStart.success).toBe(false);
    });
  });

  describe("UpdateCalendarEventSchema", () => {
    test("accepts id with optional updates", () => {
      const result = UpdateCalendarEventSchema.safeParse({
        id: "event123",
        title: "Updated Meeting",
        location: "Room 101",
      });
      expect(result.success).toBe(true);
    });

    test("rejects missing id", () => {
      const result = UpdateCalendarEventSchema.safeParse({
        title: "Updated",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("DeleteCalendarEventSchema", () => {
    test("accepts valid id", () => {
      const result = DeleteCalendarEventSchema.safeParse({ id: "event123" });
      expect(result.success).toBe(true);
    });

    test("rejects missing id", () => {
      const result = DeleteCalendarEventSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
