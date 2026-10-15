import type { Type } from "@nestjs/common";
import { CommentsController } from "./comments.controller";
import { FilesController } from "./files.controller";
import { LinksController } from "./links.controller";
import { MiscController } from "./misc.controller";
import { NotesController } from "./notes.controller";
import { SectorsController } from "./sectors.controller";
import { SourcesController } from "./sources.controller";
import { TagsController, TrashController } from "./tags.controller";

/** The controllers the server host owns (records every module can hang things on, settings, trash); the module controllers come from the generated list */
export const coreControllers: Type<unknown>[] = [
  MiscController, SourcesController, CommentsController, SectorsController, NotesController, LinksController, FilesController,
  TagsController, TrashController,
];
