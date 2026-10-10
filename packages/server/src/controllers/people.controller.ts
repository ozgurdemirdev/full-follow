import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts, withList } from "../http";

@Controller("api/people")
export class PeopleController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("person", listOpts(query));
  }

  /** Kişi kartı tek istekte (temaslar, notlar, yorumlar mesajlarıyla, referans ağı ve değeri) */
  @Get(":id/card")
  card(@Param("id") id: string) {
    return this.core.personCard(intId(id));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.core.get("person", intId(id), withList(w), 50);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.people.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.people.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("person", intId(id));
  }
}
