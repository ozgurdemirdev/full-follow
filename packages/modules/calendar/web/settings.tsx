import { Link } from "wouter";
import type { SettingRow } from "@kit/lib/settings";
import { CALENDAR_PATH } from "./paths";

/** The "Günlük hedefler" row of the business category (goals are managed on the calendar page) */
export const dailyGoalsRows = (): SettingRow[] => [{
  id: "daily-goals",
  name: "Günlük hedefler",
  hint: "Hedefler Takvim’de eklenir, düzenlenir ve silinir",
  keywords: ["hedef", "plan", "takvim"],
  control: <Link href={CALENDAR_PATH} className="set-btn">Takvim’e git</Link>,
}];
