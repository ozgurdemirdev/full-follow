import { defineMessages } from "@fullfollow/core";

/** Texts of the companies module's server side: module label, errors, event summaries, MCP lines */
export const m = defineMessages({
  tr: {
    label: "Firmalar",
    /** What one company is called in a sentence, a record label and the MCP output */
    noun: "firma",
    /** Plural of the noun (an alias of the record type) */
    plural: "firmalar",
    notFound: (id: number) => `firma #${id} bulunamadı`,
    events: {
      created: (name: string) => `Firma eklendi: ${name}`,
      updated: (name: string, fields: string) => `Firma güncellendi: ${name} (${fields})`,
      deleted: (name: string) => `Firma silindi: ${name}`,
    },
    /** Field names the update summary lists, by column or input key */
    fieldNames: {
      name: "ad",
      website: "web sitesi",
      email: "e-posta",
      phone: "telefon",
      instagram: "Instagram",
      linkedin: "LinkedIn",
      source_id: "nereden",
      contact_status: "durum",
      notes: "not",
      city: "şehir",
      tags: "etiket",
      sectors: "sektör",
    },
    mcp: {
      source: (name: string) => `kaynak ${name}`,
      money: (won: string, due: string, open: string) => `alınan ${won} bekleyen ${due} açık ${open}`,
      people: (count: number) => `${count} kişi`,
      openOpps: (count: number) => `${count} açık fırsat`,
      lastTouch: (date: string) => `son temas ${date}`,
      saveViaPerson: " (person {company:'ABC'} yoksa firmayı açar)",
    },
  },
});
