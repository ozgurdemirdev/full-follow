// Dashboard cards of the people module (wrappers: the card components still live in the kit and take their data as props)
import type { Today } from "@kit/api/types";
import { FollowUpsCard } from "@kit/components/dash/ExtraCards";

export const FollowUpsDashCard = ({ today }: { today: Today }) => <FollowUpsCard data={today} />;
