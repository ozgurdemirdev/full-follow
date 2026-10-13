import { Body, Controller, Delete, Inject, Param, Patch, Post } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId } from "../http";

/** Extra people on an opportunity (listed through GET /api/opportunities/:id?with=people) */
@Controller("api/opportunity-people")
export class OpportunityPeopleController {
  constructor(@Inject(CORE) private core: Core) {}

  /** { opportunity_id, person_id, role, note }: adds a member, or changes the role of one already on the team */
  @Post()
  add(@Body() b: { opportunity_id?: number } & Record<string, unknown>) {
    const { opportunity_id, ...rest } = b ?? {};
    return this.core.oppPeople.add(Number(opportunity_id), rest);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.oppPeople.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.oppPeople.remove(intId(id));
  }
}
