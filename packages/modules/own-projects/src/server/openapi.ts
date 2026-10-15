import { z } from "zod";
import { docKit } from "@fullfollow/core";
import { ownProjectCreate, ownProjectUpdate } from "../service/schemas";

const { crud, defineDocs, saveResult } = docKit;

/** API documentation of the own projects routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/own-projects", {
    noun: "own project",
    filters: {
      status: z.string().optional().describe("Comma separated: aktif, beklemede, tamamlandi, birakildi"),
      sellable: z.string().optional().describe("Comma separated: evet, belki, hayir"),
      sector: z.string().optional().describe("Sector id, name or path; a main sector includes its sub sectors"),
    },
    create: ownProjectCreate,
    update: ownProjectUpdate,
    list: { description: "`q` searches name, description and notes." },
  }),
  "POST /api/own-projects/from-idea/:ideaId": {
    summary: "Turn an idea into an own project",
    params: { ideaId: "Id of the idea" },
    response: saveResult,
  },
});
