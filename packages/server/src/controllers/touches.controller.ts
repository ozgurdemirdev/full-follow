import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts, withList } from "../http";

@Controller("api/touches")
export class TouchesController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("touch", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.core.get("touch", intId(id), withList(w));
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.touches.create(b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("touch", intId(id));
  }
}
