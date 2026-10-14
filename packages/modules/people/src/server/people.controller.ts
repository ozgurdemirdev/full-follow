import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";

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

  /** Kişi kartı tek istekte (temaslar, notlar, yorumlar mesajlarıyla, referans ağı ve değeri) */
  @Get(":id/card")
  card(@Param("id") id: string) {
    return this.people.card(this.app.resolveRef("person", intId(id)));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("person", intId(id), withList(w), 50);
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
