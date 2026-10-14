import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";

@Controller("api/touches")
export class TouchesController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get touches() {
    return this.app.mod("network")!.touches;
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.app.find("touch", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("touch", intId(id), withList(w), 50);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.touches.create(b);
  }

  /** Özet, sonuç, kanal, tarih ve cevap bekleme bayrağı */
  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.touches.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("touch", intId(id));
  }
}
