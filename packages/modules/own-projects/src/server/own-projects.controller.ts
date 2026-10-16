import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";

/** Kendi projelerim: kullanıcının kendi ürünleri (satılabilirlik, sektörler, projeye bağlı fikirler) */
@Controller("api/own-projects")
export class OwnProjectsController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get projects() {
    return this.app.mod("own-projects")!;
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.app.find("own_project", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("own_project", intId(id), withList(w), 200);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.projects.create(b);
  }

  /** "Projeye dönüştür": genel fikir projeye çevrilir */
  @Post("from-idea/:ideaId")
  fromIdea(@Param("ideaId") ideaId: string) {
    return this.projects.fromIdea(intId(ideaId));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.projects.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("own_project", intId(id));
  }
}
