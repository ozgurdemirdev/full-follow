import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts, withList } from "../http";

@Controller("api/companies")
export class CompaniesController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("company", listOpts(query));
  }

  /** Firma kartı tek istekte: çalışanlar, temaslar (firmaya ve çalışanlarına), fırsatlar, taslaklar, yorumlar */
  @Get(":id/card")
  card(@Param("id") id: string) {
    return this.core.companyCard(intId(id));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.core.get("company", intId(id), withList(w), 50);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.companies.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.companies.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("company", intId(id));
  }
}
