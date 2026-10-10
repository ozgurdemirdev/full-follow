import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts, withList } from "../http";

@Controller("api/opportunities")
export class OpportunitiesController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("opportunity", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.core.get("opportunity", intId(id), withList(w), 50);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.opportunities.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.opportunities.update(intId(id), b);
  }

  /** Kanban: aşama (ve sıra) değiştirir; kazanıldı/kaybedildi kuralları core'da */
  @Post(":id/move")
  move(@Param("id") id: string, @Body() b: { stage: string; reason?: string; position?: number }) {
    return this.core.opportunities.move(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("opportunity", intId(id));
  }
}
