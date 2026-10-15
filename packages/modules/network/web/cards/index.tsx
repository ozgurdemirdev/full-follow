// Dashboard cards of the network module (wrappers: the card components take their data as props)
import type { Today } from "@kit/api/types";
import { AwaitingCard, CoolingCard } from "./PeopleCards";

export const AwaitingDashCard = ({ today }: { today: Today }) => (
  <AwaitingCard list={today.network!.awaiting} waitDays={today.network!.settings.reply_wait_days} />
);

export const CoolingDashCard = ({ today }: { today: Today }) => (
  <CoolingCard list={today.network!.cooling} coolingDays={today.network!.settings.cooling_days} />
);
