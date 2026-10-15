import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";
import { RELATED_ROWS } from "../service/constants";

@Controller("api/companies")
export class CompaniesController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get companies() {
    return this.app.mod("companies")!;
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.app.find("company", listOpts(query));
  }

  /** The companies screen's page: the list filters plus segment, sort and ids; with the count of each segment */
  @Get("overview")
  overview(@Query() query: Record<string, any>) {
    return this.companies.overview(listOpts(query));
  }

  /** Money and decision makers of the whole book, whatever the filters (the numbers on top of the screen) */
  @Get("totals")
  totals() {
    return this.companies.totals();
  }

  /** Firma kartı tek istekte: çalışanlar, temaslar (firmaya ve çalışanlarına), fırsatlar, taslaklar, yorumlar */
  @Get(":id/card")
  card(@Param("id") id: string) {
    return this.companies.card(this.app.resolveRef("company", intId(id)));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("company", intId(id), withList(w), RELATED_ROWS);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.companies.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.companies.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("company", intId(id));
  }
}
