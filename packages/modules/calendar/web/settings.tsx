import { Link } from "wouter";
import type { SettingRow } from "@kit/lib/settings";
import { m } from "./messages";
import { CALENDAR_PATH } from "./paths";

/** The "Günlük hedefler" row of the business category (goals are managed on the calendar page) */
export const dailyGoalsRows = (): SettingRow[] => [{
  id: "daily-goals",
  name: m.settings.dailyGoals,
  hint: m.settings.dailyGoalsHint,
  keywords: m.settings.dailyGoalsKeywords.split(" "),
  control: <Link href={CALENDAR_PATH} className="set-btn">{m.settings.goToCalendar}</Link>,
}];
