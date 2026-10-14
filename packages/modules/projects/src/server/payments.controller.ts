import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";

@Controller("api/payments")
export class PaymentsController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get payments() {
    return this.app.mod("projects")!.payments;
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.app.find("payment", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("payment", intId(id), withList(w), 50);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.payments.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.payments.update(intId(id), b);
  }

  /** Ödeme girer: tutar ödenene eklenir */
  @Post(":id/pay")
  pay(@Param("id") id: string, @Body() b: { amount: number; date?: string }) {
    return this.payments.pay(intId(id), b?.amount, b?.date);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("payment", intId(id));
  }
}
