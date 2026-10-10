import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts } from "../http";

/** Etiketler (Ayarlar'dan yönetilir). ?all=true silinenleri de verir: kayıtlarda görünmeye devam ederler. */
@Controller("api/tags")
export class TagsController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("tag", listOpts(query));
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.tags.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.tags.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("tag", intId(id));
  }
}

/** Çöp kutusu: silinen kayıtlar ve gizlenen etiket/sektör/kaynaklar; geri yükleme */
@Controller("api/trash")
export class TrashController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("trash", listOpts(query));
  }

  @Post("restore")
  restore(@Body() b: { type: string; id: number }) {
    return this.core.restore(b?.type, intId(String(b?.id)));
  }
}
