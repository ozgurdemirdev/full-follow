import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts, withList } from "../http";

@Controller("api/tasks")
export class TasksController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("task", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.core.get("task", intId(id), withList(w));
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.tasks.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.tasks.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("task", intId(id));
  }
}
