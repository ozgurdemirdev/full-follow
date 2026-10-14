import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";

/** Ürün fikirleri ve ilgi ölçümü (kime anlatıldı, kim ilgilendi) */
@Controller("api/ideas")
export class IdeasController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get ideas() {
    return this.app.mod("ideas")!;
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.app.find("idea", listOpts(query));
  }

  /** Fikre bağlı kişiler (ilgisiyle); ?idea_id= ya da ?person_id= */
  @Get("people")
  people(@Query() query: Record<string, any>) {
    return this.app.find("interest", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("idea", intId(id), withList(w), 200);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.ideas.create(b);
  }

  /** Kişiyi fikre bağla ya da ilgisini güncelle: { person_id, interest?, note? } */
  @Post(":id/people")
  link(@Param("id") id: string, @Body() b: Record<string, unknown>) {
    return this.ideas.saveInterest({ ...(b ?? {}), idea_id: intId(id) });
  }

  @Patch("people/:linkId")
  updateLink(@Param("linkId") linkId: string, @Body() b: unknown) {
    return this.ideas.updateInterest(intId(linkId), b);
  }

  @Delete("people/:linkId")
  unlink(@Param("linkId") linkId: string) {
    return this.app.remove("interest", intId(linkId));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.ideas.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("idea", intId(id));
  }
}
