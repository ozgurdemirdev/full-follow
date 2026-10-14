import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, bool, intId, listOpts, withList, type Core } from "@fullfollow/core";

@Controller("api/tasks")
export class TasksController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get cal() {
    return this.app.mod("calendar")!;
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.app.find("task", listOpts(query));
  }

  /** Görevler projeye göre gruplu: project_ids = virgülle id listesi (yoksa görevi olan her proje), done=true bitenleri de getirir */
  @Get("by-project")
  byProject(@Query("project_ids") ids?: string, @Query("done") done?: string) {
    return { rows: this.cal.tasks.byProject({ project_ids: ids ? ids.split(",").map(intId) : undefined, done: bool(done) }) };
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("task", intId(id), withList(w), 50);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.cal.tasks.create(b);
  }

  /** Body: { text, due_date? }; "14:00 Elif ile görüşme" gives due_time 14:00 and kind gorusme */
  @Post("quick")
  quick(@Body() b: unknown) {
    return this.cal.tasks.quick(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.cal.tasks.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("task", intId(id));
  }
}
