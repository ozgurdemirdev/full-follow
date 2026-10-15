// Every text the calendar module writes for a person or for Claude: record names, errors, event summaries, MCP output.
import { defineMessages } from "@fullfollow/core";

/** Short weekday names, Monday first (a message cannot be a list, `weekdayShort` reads from it) */
const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export const m = defineMessages({
  tr: {
    label: "Takvim",
    // record names (trash lists, MCP lines, "not found" errors)
    task: "görev",
    goal: "hedef",
    goalLog: "ilerleme",
    taskSection: "Görev",
    weekdayShort: (index: number) => WEEKDAYS[index],
    errors: {
      logNotDeletable: "ilerleme silinmez; count:0 ile sıfırla",
      oneCounter: "hedef ya kanaldan ya da yeni kayıttan kendiliğinden sayar, ikisinden birden değil",
      rangeTooLong: (days: number) => `takvim aralığı en fazla ${days} gün olabilir`,
      logNeedsValue: "add, count ya da note gerekli",
      logAddAndCount: "add ve count birlikte verilmez",
      time: "saat HH:MM olmalı (00:00 ile 23:59 arası)",
      oneTarget: "görev en fazla bir kayda (kişi, firma, fırsat, proje ya da fikir) bağlanabilir",
      moduleMissing: (noun: string, id: number, key: string) => `${noun} verildi (#${id}) ama "${key}" modülü kurulu değil`,
      notFound: (noun: string, id: number) => `${noun} #${id} bulunamadı`,
    },
    // nouns of the "linked record" errors
    opportunityNoun: "fırsat",
    projectNoun: "proje",
    ideaNoun: "fikir",
    // event summaries
    events: {
      taskAdded: (assignee: string, title: string) => `Görev eklendi (${assignee}): ${title}`,
      taskUpdated: (title: string) => `Görev düzenlendi: ${title}`,
      taskDone: (title: string) => `Görev tamamlandı: ${title}`,
      taskDeleted: (title: string) => `Görev silindi: ${title}`,
      goalAdded: (title: string, target: number) => `Günlük hedef eklendi: ${title} (${target})`,
      goalUpdated: (title: string) => `Günlük hedef düzenlendi: ${title}`,
      goalDeleted: (title: string) => `Günlük hedef silindi: ${title}`,
      goalProgress: (title: string, done: number, target: number, date: string) => `${title}: ${done}/${target} (${date})`,
    },
    // effect string of a progress write
    complete: " tamam",
    // MCP output
    mcp: {
      everyDay: "her gün",
      weekdays: "hafta içi",
      autoAdded: (auto: number, duplicates: number) => ` (${auto} eklendi${duplicates ? `, ${duplicates} mükerrer atlandı` : ""})`,
      autoChannel: (auto: number) => ` (otomatik ${auto})`,
      completeMark: " ✓",
      planGoalNote: (note: string) => ` · not: ${note}`,
      streak: (n: number) => `seri ${n} gün`,
      weekRatio: (percent: number) => `hafta %${percent}`,
      goalsBlock: (lines: string) => `Hedef:\n${lines}`,
      noGoals: "hedef yok (save goal ile ekle)",
      tasksBlock: (lines: string) => `Görev:\n${lines}`,
      planHead: (date: string) => `PLAN ${date}`,
      noTarget: "hedef yok",
      dayRatio: (percent: number) => `hedef %${percent}`,
      dayTasks: (done: number, total: number) => `görev ${done}/${total}`,
      due: (date: string, time: string | null | undefined) => `son ${date}${time ? ` ${time}` : ""}`,
      done: "bitti",
      perDay: (target: number) => `günde ${target}`,
      auto: (label: string) => `otomatik: ${label}`,
      today: (done: number, target: number) => `bugün ${done}/${target}`,
      note: (note: string) => `not: ${note}`,
      manual: (count: number) => `elle ${count}`,
    },
    docs: {
      today: "görevler, ",
      save: "task: {title,assignee:ozgur|claude|musteri (musteri: müşterinin yapacağı iş, projede Müşteride bekliyor sayılır),due_date,due_time:'14:30',kind:gorusme|takip|gorev (varsayılan gorev),idea:'fikir adı' (fikir için anlatım metni görevi)}. goal: {title,target,days,channel?|metric?:'new_records',note?} (günlük tekrarlı hedef); goal_log: {goal,add|count,date?,note?}.",
      planTool: "Günün iş planı: hedefler (yapılan/hedef; kanallı hedefte giden mesajlar kendiliğinden sayılır), o günün görevleri, seri, haftalık tutturma oranı. date varsayılan bugün. from+to verilirse takvim (gün gün hedef doluluğu ve görevler, en fazla 92 gün). Hedef: save goal {title,target,days:'her_gun|hafta_ici|hafta_sonu'|[1..7],channel?|metric?,note?}; channel verilirse o kanaldaki giden mesajlar, metric:'new_records' verilirse o gün eklenen yeni kişi ve firmalar kendiliğinden sayılır (çıktıda eklenen ve mükerrer atlanan sayısı görünür; kanal ve metric birlikte verilmez, örn. Perşembe liste yenileme {title:'Liste yenileme',target:50,days:[4],metric:'new_records'}); ilerleme: save goal_log {goal:'ad',add:1|count:10,date?,note?}.",
    },
  },
});
