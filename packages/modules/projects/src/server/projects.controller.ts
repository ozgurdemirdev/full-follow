import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";

@Controller("api/projects")
export class ProjectsController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get projects() {
    return this.app.mod("projects")!.projects;
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.app.find("project", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("project", intId(id), withList(w), 50);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.projects.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.projects.update(intId(id), b);
  }

  @Post(":id/move")
  move(@Param("id") id: string, @Body() b: { stage: string }) {
    return this.projects.move(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("project", intId(id));
  }
}
