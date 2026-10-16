// Every text core writes for a person or for Claude: refusals, event summaries, trash labels. One language today (see i18n.ts).
import { defineMessages, LANG } from "./i18n";

const cap = (s: string) => s.charAt(0).toLocaleUpperCase(LANG) + s.slice(1);

export const m = defineMessages({
  tr: {
    currency: "₺",
    /** "none" in a list of names ("geçerli ilişkiler: yok") */
    none: "yok",
    /** An upload past UPLOAD_QUOTA_BYTES */
    uploadQuota: (gb: number) => `yükleme alanı dolu: yüklenen dosyalar toplam ${gb} GB'ı geçemez`,
    /** Names of the records, as the sentences say them ("kişi #3 bulunamadı") */
    noun: {
      person: "kişi", company: "firma", opportunity: "fırsat", project: "proje", task: "görev", draft: "taslak",
      payment: "ödeme", source: "kaynak", comment: "yorum", touch: "temas", sector: "sektör", parentSector: "üst sektör",
      note: "not", post: "paylaşım", template: "şablon", idea: "fikir", ownProject: "kendi projesi", ideaPerson: "fikir ilgisi",
      tag: "etiket", link: "link", goal: "hedef", file: "dosya", offer: "teklif", opportunityPerson: "ekip üyesi",
    },
    /** Names of the fields a duplicate is found on */
    keyLabel: { email: "e-posta", domain: "alan adı", name: "firma adı", instagram: "Instagram", linkedin: "LinkedIn" },
    field: { name: "ad" },
    /** `owner` is the neutral word used while the owner has not given a name (setting `owner_name`) */
    actor: { claude: "Claude", owner: "kullanıcı" },
    /** Words the date parser understands, besides "+3g" */
    date: { today: "bugün", todayAscii: "bugun", tomorrow: "yarın", tomorrowAscii: "yarin", yesterday: "dün", yesterdayAscii: "dun" },

    forbiddenAction: (what: string, owner: string) => `${what} sadece ${owner} tarafından yapılır`,
    invalidId: (id: unknown) => `geçersiz id "${id}"`,
    invalidNumber: (name: string, min: number, max: number) => `${name}, ${max === Number.MAX_SAFE_INTEGER ? `${min} ya da daha büyük` : `${min} ile ${max} arasında`} bir tam sayı olmalı`,
    notFound: (what: string, id: unknown) => `${what} #${id} bulunamadı`,
    moduleNotInstalled: (type: string, owner: string) => `"${type}" türü için "${owner}" modülü kurulu değil`,
    unknownType: (type: string, valid: string) => `bilinmeyen tür "${type}" (geçerli: ${valid})`,
    unknownRecordType: (type: string) => `bilinmeyen kayıt türü "${type}"`,
    unsupportedOperation: (type: string, method: string) => `${type} için ${method} desteklenmiyor`,
    brokenForeignKeys: (count: number, detail: string) => `migration sonrası ${count} kırık foreign key: ${detail}`,

    // ---- Developer only (module registry), English
    registry: {
      moduleKeyShape: (key: string) => `module key "${key}" must be lower-case letters, digits and dashes`,
      typeNameTwice: (name: string, module: string) => `record type name "${name}" is claimed twice (module "${module}")`,
      duplicateModuleKey: (key: string) => `duplicate module key "${key}"`,
      emitOutsideTransaction: (name: string) => `emit("${name}") must run inside the caller's transaction`,
    },

    // ---- Zod messages
    schema: {
      webUrl: "geçerli bir http ya da https adresi gerekli",
      dateShape: "tarih YYYY-MM-DD olmalı",
      dateIso: "tarih ISO olmalı",
      subjectNeeded: "kişi, firma ya da adres (contact) gerekli",
    },

    // ---- Core records (save, remove, restore, find, get)
    records: {
      trashNotWritable: "çöp kutusuna kayıt yazılmaz; geri yüklemek için restore",
      moveOnly: (types: string) => `move sadece ${types} için`,
      settingNotDeletable: "ayar silinmez",
      trashNoPermanentDelete: "çöp kutusundan kalıcı silme yok",
      cannotRestore: (type: string) => `${type} geri yüklenemez`,
      trashNoLabelMatch: (label: string, what: string) => `çöp kutusunda "${label}" adlı ${what} yok`,
      ambiguousMatch: (label: string, list: string) => `"${label}" birden fazla kayıtla eşleşiyor: ${list}`,
      trashUseFind: "çöp kutusu için find(type: trash) kullan",
      settingUseFind: "ayarlar için find(type: setting) kullan",
      relationsInvalid: (type: string, allowed: string) => `${type} için geçerli ilişkiler: ${allowed}`,
    },

    // ---- Names ("Sağlık > Diş hekimi", "Sıcak", "LinkedIn")
    refs: {
      byNameImpossible: (type: string) => `${type} isimle verilemez`,
      nameEmpty: (label: string) => `${label} adı boş`,
      notFound: (label: string, name: string) => `${label} "${name}" bulunamadı`,
      ambiguous: (name: string, label: string, list: string) => `"${name}" birden fazla ${label} ile eşleşiyor: ${list}`,
      attachTargetInvalid: (list: string) => `target_type: Invalid option: expected one of ${list}`,
    },

    // ---- Duplicates
    dupe: {
      bulkSkipped: (count: number, label: string) => `Toplu eklemede ${count} mükerrer ${label} atlandı`,
      exists: (field: string, what: string, id: number, label: string, inTrash: boolean) =>
        `Bu ${field} zaten kayıtlı: ${what} #${id} ${label}${inTrash ? " (çöp kutusunda, geri yüklenebilir)" : ""}`,
    },

    // ---- Tags, sources, sectors
    categories: {
      tagAdded: (name: string) => `Etiket eklendi: ${name}`,
      sourceAdded: (name: string) => `Kaynak eklendi: ${name}`,
      deadPicked: (names: string, what: string) => `${names} ${what}i silinmiş; Ayarlar > Çöp kutusundan geri yükleyince seçilebilir`,
    },
    sectors: {
      selfParent: "sektör kendi altına bağlanamaz",
      twoLevelsOfParent: (name: string) => `sektör en fazla iki seviye: "${name}" zaten bir alt sektör`,
      twoLevels: "sektör en fazla iki seviye: \"Ana > Alt\"",
      ambiguous: (name: string, list: string) => `"${name}" birden fazla sektörle eşleşiyor: ${list}. "Ana > Alt" biçiminde yaz`,
      hasChildren: (name: string) => `"${name}" altında sektörler var; başka sektörün altına taşınamaz (en fazla iki seviye)`,
      added: (path: string) => `Sektör eklendi: ${path}`,
      updated: (path: string) => `Sektör güncellendi: ${path}`,
    },

    // ---- Comments
    comments: {
      threadReopened: (target: string) => `Yorum konusu yeniden açıldı (${target})`,
      threadClosed: (target: string) => `Yorum konusu kapatıldı (${target})`,
      reopenedEffect: "konu yeniden açıldı",
      needsTarget: "yorum için target_type ve target_id (ya da reply_to) gerekli",
      targetInvalid: (type: string, valid: string) => `target_type: "${type}" için yorum yazılamaz (geçerli: ${valid})`,
      optionsClaudeOnly: "Hızlı cevap seçeneklerini sadece Claude ekler",
      written: (by: string, target: string, preview: string) => `${cap(by)} yorum yazdı (${target}): ${preview}`,
      markReadAction: "Konuyu okundu işaretlemek",
      authorOnlyEdit: "Yorumu sadece yazarı düzenleyebilir",
      claudeOnlyOwn: "Claude sadece kendi yorumlarını silebilir",
      entry: (preview: string) => `Yorum: ${preview}`,
      deleted: (target: string, preview: string) => `Yorum silindi (${target}): ${preview}`,
    },

    // ---- Notes, links, files
    notes: {
      entry: (preview: string) => `Not: ${preview}`,
      deleted: (preview: string) => `Not silindi: ${preview}`,
      authorOnlyEdit: "Notu sadece yazarı düzenleyebilir",
      claudeOnlyOwn: "Claude sadece kendi notlarını silebilir",
    },
    links: {
      added: (label: string) => `Link eklendi: ${label}`,
      entry: (label: string) => `Link: ${label}`,
      deleted: (label: string) => `Link silindi: ${label}`,
    },
    files: {
      added: (name: string) => `Dosya eklendi: ${name}`,
      entry: (name: string) => `Dosya: ${name}`,
      deleted: (name: string) => `Dosya silindi: ${name}`,
      unsupportedType: "Bu dosya türü desteklenmiyor",
      textUnreadable: "Metin dosyası okunamadı",
      textNotUtf8: "Metin dosyası UTF-8 olmalı",
    },

    // ---- Settings
    settings: {
      followupOrder: "takip günleri artan sırada olmalı (örn. 3,7)",
      rulesDistinct: "kurallar birbirinden farklı olmalı",
      warmupDate: "tarih YYYY-AA-GG olmalı",
      unknown: (key: string, valid: string) => `bilinmeyen ayar "${key}" (geçerli: ${valid})`,
      templateTotal: (sum: number) => `ödeme şablonu yüzdeleri toplamı 100 olmalı (şu an ${sum})`,
      templateDeposit: "ödeme şablonunda peşinat tam bir kez olmalı",
      moduleNotInstalled: (unknown: string, installed: string) => `kurulu olmayan modül: ${unknown} (kurulu: ${installed})`,
      event: (key: string) => `Ayar: ${key}`,
      empty: "ayar verisi boş",
      ownerOnlyAction: (key: string) => `${key} ayarını değiştirmek`,
    },

    // ---- Trash
    trash: {
      deleteBlocked: (what: string) => `silinemedi: ${what} kaydına bağlı başka kayıtlar var (ilgili modül kurulu değil)`,
      missing: (what: string, id: number) => `çöp kutusunda ${what} #${id} yok`,
      restored: (what: string, label: string) => `Geri yüklendi (${what}): ${label}`,
      restoreBlocked: (label: string) => `${label} geri yüklenemedi: bağlı olduğu kayıt da silinmiş, önce onu geri yükle`,
      restoreDuplicate: (label: string, holder: string) => `${label} geri yüklenemedi: aynı kayıt zaten var (${holder})`,
      restoredEffect: (label: string) => `${label} geri yüklendi`,
      categoryDeleted: (what: string, name: string) => `${cap(what)} silindi: ${name}`,
    },
  },
});
