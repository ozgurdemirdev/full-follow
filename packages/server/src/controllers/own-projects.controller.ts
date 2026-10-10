import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts, withList } from "../http";

/** Kendi projelerim: Özgür'ün kendi ürünleri (satılabilirlik, sektörler, projeye bağlı fikirler) */
@Controller("api/own-projects")
export class OwnProjectsController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("own_project", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.core.get("own_project", intId(id), withList(w), 200);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.ownProjects.create(b);
  }

  /** "Projeye dönüştür": genel fikir projeye çevrilir */
  @Post("from-idea/:ideaId")
  fromIdea(@Param("ideaId") ideaId: string) {
    return this.core.ownProjects.fromIdea(intId(ideaId));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.ownProjects.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("own_project", intId(id));
  }
}
