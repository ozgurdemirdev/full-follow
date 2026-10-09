import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts, withList } from "../http";

@Controller("api/payments")
export class PaymentsController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("payment", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.core.get("payment", intId(id), withList(w));
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.payments.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.payments.update(intId(id), b);
  }

  /** Ödeme girer: tutar ödenene eklenir */
  @Post(":id/pay")
  pay(@Param("id") id: string, @Body() b: { amount: number; date?: string }) {
    return this.core.payments.pay(intId(id), b?.amount, b?.date);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("payment", intId(id));
  }
}
