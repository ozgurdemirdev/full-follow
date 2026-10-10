import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts, withList } from "../http";

/** Ürün fikirleri ve ilgi ölçümü (kime anlatıldı, kim ilgilendi) */
@Controller("api/ideas")
export class IdeasController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("idea", listOpts(query));
  }

  /** Fikre bağlı kişiler (ilgisiyle); ?idea_id= ya da ?person_id= */
  @Get("people")
  people(@Query() query: Record<string, any>) {
    return this.core.find("interest", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.core.get("idea", intId(id), withList(w), 200);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.ideas.create(b);
  }

  /** Kişiyi fikre bağla ya da ilgisini güncelle: { person_id, interest?, note? } */
  @Post(":id/people")
  link(@Param("id") id: string, @Body() b: Record<string, unknown>) {
    return this.core.ideas.saveInterest({ ...(b ?? {}), idea_id: intId(id) });
  }

  @Patch("people/:linkId")
  updateLink(@Param("linkId") linkId: string, @Body() b: unknown) {
    return this.core.ideas.updateInterest(intId(linkId), b);
  }

  @Delete("people/:linkId")
  unlink(@Param("linkId") linkId: string) {
    return this.core.remove("interest", intId(linkId));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.ideas.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("idea", intId(id));
  }
}
