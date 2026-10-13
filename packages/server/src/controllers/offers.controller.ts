import { Body, Controller, Delete, Inject, Param, Patch, Post } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId } from "../http";

/** Offer versions of an opportunity (listed through GET /api/opportunities/:id?with=offers) */
@Controller("api/offers")
export class OffersController {
  constructor(@Inject(CORE) private core: Core) {}

  @Post()
  create(@Body() b: unknown) {
    return this.core.offers.create(b);
  }

  /** Also accepts or un-accepts: { accepted: true } */
  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.offers.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.offers.remove(intId(id));
  }
}
