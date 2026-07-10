import type { ComponentType } from "react";
import { template as deadlineReminder } from "./deadline-reminder";
import { template as dailySummary } from "./daily-summary";
import { template as weeklySummary } from "./weekly-summary";
import { template as verifyReminderEmail } from "./verify-reminder-email";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  "deadline-reminder": deadlineReminder,
  "daily-summary": dailySummary,
  "weekly-summary": weeklySummary,
  "verify-reminder-email": verifyReminderEmail,
};
