import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";
import { RELATED_ROWS } from "../service/constants";

@Controller("api/people")
export class PeopleController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get people() {
    return this.app.mod("people")!;
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.app.find("person", listOpts(query));
  }

  /** The people screen's page: the list filters plus state, has_channel, ids, company_ids, post_ids; with the count of each state */
  @Get("overview")
  overview(@Query() query: Record<string, any>) {
    return this.people.overview(listOpts(query));
  }

  /** What the whole book holds, whatever the filters (the people screen's subtitle) */
  @Get("summary")
  summary() {
    return this.people.summary();
  }

  /** The people to reach out to first (the "Bugün dokun" cards, the template recipients) */
  @Get("touch-queue")
  touchQueue(@Query("limit") limit?: string, @Query("exclude") exclude?: string, @Query("all") all?: string) {
    const skip = (exclude ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    return { rows: this.people.touchQueue({ limit: limit ? Number(limit) : undefined, exclude: skip, all: all === "true" }) };
  }

  /** Kişi kartı tek istekte (temaslar, notlar, yorumlar mesajlarıyla, referans ağı ve değeri) */
  @Get(":id/card")
  card(@Param("id") id: string) {
    return this.people.card(this.app.resolveRef("person", intId(id)));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("person", intId(id), withList(w), RELATED_ROWS);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.people.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.people.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("person", intId(id));
  }
}
