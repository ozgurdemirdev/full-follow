import type { Ctx, ReportsApi } from "@fullfollow/core";
import { marketingReport } from "./service/marketing";
import { priceFloor } from "./service/floor";
import { reportsService } from "./service/report";
import { weeklyReview } from "./service/review";
import { REPORT_MONTHS_DEFAULT } from "./constants";

/** The reports module's implementation of its contract (`ReportsApi` in core's contracts) */
export function reportsApi(ctx: Ctx): ReportsApi {
  const reports = reportsService(ctx);
  return {
    priceFloor: () => priceFloor(ctx),
    bySource: reports.bySource,
    sourceFunnel: reports.sourceFunnel,
    month: reports.month,
    months: (count = REPORT_MONTHS_DEFAULT, until) => reports.months(count, until),
    report: reports.report,
    marketing: () => marketingReport(ctx),
    review: (week) => weeklyReview(ctx, week),
  };
}
