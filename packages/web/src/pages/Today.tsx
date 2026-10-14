import { K } from "../api/keys";
import { useQuery } from "../api/store";
import type { Today as TodayData } from "../api/types";
import { Page } from "../app/Page";
import { Masonry } from "../components/layout";
import { Asks } from "../components/dash/Asks";
import { CommentsCard } from "../components/dash/CommentsCard";
import { DashTools } from "../components/dash/DashTools";
import { DraftsCard } from "../components/dash/DraftsCard";
import { ActivityCard } from "../components/dash/ActivityCard";
import { FollowUpsCard, FollowupsDueCard, PostsDueCard, QuotaCard, ReviewCard } from "../components/dash/ExtraCards";
import { FunnelCard } from "../components/dash/FunnelCard";
import { GoalMeters } from "../components/dash/GoalMeters";
import { AwaitingCard, CoolingCard } from "../components/dash/PeopleCards";
import { PaymentsCard } from "../components/dash/PaymentsCard";
import { PlanCard } from "../components/dash/PlanCard";
import { ProjectsCard } from "../components/dash/ProjectsCard";
import { ErrorBox, PageSkeleton } from "../components/ui";
import { fmtToday } from "../lib/format";

const DASH_COLUMNS = 3;

/** Dashboard: goal strip, questions waiting for Özgür, then the cards in independent masonry columns (order of the board on a phone) */
export default function Today() {
  const today = useQuery<TodayData>(K.today);
  const d = today.data;
  const followUps = d ? d.follow_ups.people.total + d.follow_ups.opportunities.total : 0;
  const sub = d ? `${fmtToday(d.date)} · ${d.network.awaiting.total} kişiden cevap bekleniyor, ${followUps} takip ve ${d.drafts.total} taslak seni bekliyor` : "";

  return (
    <Page title="Merhaba, Özgür" sub={sub} right={<DashTools />} gap="tight" className="flex flex-col gap-9">
      {today.error && !d ? <ErrorBox error={today.error} retry={today.reload} /> : null}
      {!d ? (
        !today.error && <PageSkeleton />
      ) : (
        <>
          <GoalMeters plan={d.plan} sent={d.week.sent} target={d.network.settings.weekly_target} />
          <Asks />
          <Masonry columns={DASH_COLUMNS}>
            {d.review.ready ? <ReviewCard key="review" /> : null}
            <PlanCard key="plan" plan={d.plan} />
            <DraftsCard key="drafts" list={d.drafts} />
            <AwaitingCard key="awaiting" list={d.network.awaiting} waitDays={d.network.settings.reply_wait_days} />
            {d.followups.total ? <FollowupsDueCard key="followups-due" list={d.followups} /> : null}
            {followUps ? <FollowUpsCard key="follow-ups" data={d} /> : null}
            <PaymentsCard key="payments" />
            <ActivityCard key="activity" />
            {d.quota.channels.length || d.quota.email_warmup.active ? <QuotaCard key="quota" quota={d.quota} /> : null}
            <ProjectsCard key="projects" />
            <FunnelCard key="funnel" />
            {d.network.cooling.rows.length ? <CoolingCard key="cooling" list={d.network.cooling} coolingDays={d.network.settings.cooling_days} /> : null}
            {d.posts_due.total ? <PostsDueCard key="posts-due" list={d.posts_due} /> : null}
            <CommentsCard key="comments" />
          </Masonry>
        </>
      )}
    </Page>
  );
}
