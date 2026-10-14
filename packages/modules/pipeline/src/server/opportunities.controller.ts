import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";

@Controller("api/opportunities")
export class OpportunitiesController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get opportunities() {
    return this.app.mod("pipeline")!.opportunities;
  }

  /** The list plus `meta`: the stage rules (probability, stale days) and the stage to stage rates of the last 90 days */
  @Get()
  list(@Query() query: Record<string, any>) {
    return { ...this.app.find("opportunity", listOpts(query)), meta: this.app.mod("pipeline")!.meta() };
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("opportunity", intId(id), withList(w), 50);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.opportunities.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.opportunities.update(intId(id), b);
  }

  /** Kanban: aşama (ve sıra) değiştirir; kazanıldı/kaybedildi kuralları pipeline modülünde */
  @Post(":id/move")
  move(@Param("id") id: string, @Body() b: { stage: string; reason?: string; position?: number }) {
    return this.opportunities.move(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("opportunity", intId(id));
  }
}
