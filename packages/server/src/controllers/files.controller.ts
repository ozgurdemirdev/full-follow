import fs from "node:fs";
import { pipeline } from "node:stream";
import { Body, Controller, Delete, Get, Inject, Param, Post, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { FILE_LIMITS } from "@fullfollow/core";
import { CORE, type Core } from "../core.provider";
import { intId } from "../http";
import { recordFile, saveRecordFile } from "../record-files";

/** Files of an opportunity or project: upload (multipart), download, delete (into the trash) */
@Controller("api/files")
export class FilesController {
  constructor(@Inject(CORE) private core: Core) {}

  /** multipart: field "file" plus target_type and target_id */
  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: FILE_LIMITS.maxFileBytes } }))
  upload(@Body() b: { target_type?: string; target_id?: string }, @UploadedFile() file: { originalname: string; buffer: Buffer; size: number } | undefined) {
    return saveRecordFile(this.core, b ?? {}, file);
  }

  /** Stored mime only, never sniffed by the browser; images and PDF open in the tab, the rest downloads */
  @Get(":id")
  download(@Param("id") id: string, @Res() res: Response) {
    const { row, full } = recordFile(this.core, intId(id));
    const inline = row.mime.startsWith("image/") || row.mime === "application/pdf";
    res.setHeader("Content-Type", row.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.name)}`);
    // pipeline destroys the file stream when the response closes early, so an aborted download never holds the file handle
    pipeline(fs.createReadStream(full), res, () => {});
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.files.remove(intId(id));
  }
}
