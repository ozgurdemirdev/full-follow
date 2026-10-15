// Dashboard cards of the drafts module (wrappers: the card components still live in the kit and take their data as props)
import type { Today } from "@kit/api/types";
import { DraftsCard } from "@kit/components/dash/DraftsCard";
import { FollowupsDueCard, QuotaCard } from "@kit/components/dash/ExtraCards";

export const DraftsDashCard = ({ today }: { today: Today }) => <DraftsCard list={today.drafts!} />;
export const FollowupsDueDashCard = ({ today }: { today: Today }) => <FollowupsDueCard list={today.followups!} />;
export const QuotaDashCard = ({ today }: { today: Today }) => <QuotaCard quota={today.quota!} />;
