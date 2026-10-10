import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { addDays } from "@fullfollow/core";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts } from "../http";

/** Daily work plan: repeating goals, their day progress, the day's plan and the calendar */
@Controller("api")
export class GoalsController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get("goals")
  list(@Query() query: Record<string, any>) {
    return this.core.find("goal", listOpts(query));
  }

  @Post("goals")
  create(@Body() b: unknown) {
    return this.core.goals.create(b);
  }

  @Patch("goals/:id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.goals.update(intId(id), b);
  }

  @Delete("goals/:id")
  remove(@Param("id") id: string) {
    return this.core.remove("goal", intId(id));
  }

  /** Body: { date?, add? | count?, note? } */
  @Post("goals/:id/log")
  log(@Param("id") id: string, @Body() b: Record<string, unknown>) {
    return this.core.goals.log({ ...b, goal_id: intId(id) });
  }

  @Get("plan")
  plan(@Query("date") date?: string) {
    return this.core.goals.plan(date);
  }

  /** ?from=&to= (default: the week of today, Monday to Sunday) */
  @Get("calendar")
  calendar(@Query("from") from?: string, @Query("to") to?: string) {
    const { date, weekday } = this.core.goals.plan();
    const monday = addDays(date, -(weekday - 1));
    return this.core.goals.calendar(from ?? monday, to ?? addDays(from ?? monday, 6));
  }
}
