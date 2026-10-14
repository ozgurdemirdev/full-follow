import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { addDays, APP_TOKEN, intId, listOpts, type Core } from "@fullfollow/core";

/** Daily work plan: repeating goals, their day progress, the day's plan and the calendar */
@Controller("api")
export class GoalsController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get cal() {
    return this.app.mod("calendar")!;
  }

  @Get("goals")
  list(@Query() query: Record<string, any>) {
    return this.app.find("goal", listOpts(query));
  }

  @Get("goals/:id")
  one(@Param("id") id: string) {
    return this.app.get("goal", intId(id));
  }

  @Post("goals")
  create(@Body() b: unknown) {
    return this.cal.goals.create(b);
  }

  @Patch("goals/:id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.cal.goals.update(intId(id), b);
  }

  @Delete("goals/:id")
  remove(@Param("id") id: string) {
    return this.app.remove("goal", intId(id));
  }

  /** Body: { date?, add? | count?, note? } */
  @Post("goals/:id/log")
  log(@Param("id") id: string, @Body() b: Record<string, unknown>) {
    return this.cal.goals.log({ ...b, goal_id: intId(id) });
  }

  @Get("plan")
  plan(@Query("date") date?: string) {
    return this.cal.plan(date);
  }

  /** ?from=&to= (default: the week of today, Monday to Sunday) */
  @Get("calendar")
  calendar(@Query("from") from?: string, @Query("to") to?: string) {
    const { date, weekday } = this.cal.plan();
    const monday = addDays(date, -(weekday - 1));
    return this.cal.calendar(from ?? monday, to ?? addDays(from ?? monday, 6));
  }
}
