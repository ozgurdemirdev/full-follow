import { Body, Controller, Delete, Inject, Param, Patch, Post } from "@nestjs/common";
import { APP_TOKEN, intId, type Core } from "@fullfollow/core";

/** Offer versions of an opportunity (listed through GET /api/opportunities/:id?with=offers) */
@Controller("api/offers")
export class OffersController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get offers() {
    return this.app.mod("pipeline")!.offers;
  }

  @Post()
  create(@Body() b: unknown) {
    return this.offers.create(b);
  }

  /** Also accepts or un-accepts: { accepted: true } */
  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.offers.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.offers.remove(intId(id));
  }
}
