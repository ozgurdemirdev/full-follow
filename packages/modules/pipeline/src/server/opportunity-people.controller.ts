import { Body, Controller, Delete, Inject, Param, Patch, Post } from "@nestjs/common";
import { APP_TOKEN, intId, type Core } from "@fullfollow/core";

/** Extra people on an opportunity (listed through GET /api/opportunities/:id?with=people) */
@Controller("api/opportunity-people")
export class OpportunityPeopleController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get team() {
    return this.app.mod("pipeline")!.team;
  }

  /** { opportunity_id, person_id, role, note }: adds a member, or changes the role of one already on the team */
  @Post()
  add(@Body() b: { opportunity_id?: number } & Record<string, unknown>) {
    const { opportunity_id, ...rest } = b ?? {};
    return this.team.add(intId(String(opportunity_id)), rest);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.team.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.team.remove(intId(id));
  }
}
