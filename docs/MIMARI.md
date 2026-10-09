# Full Follow · Mimari Plan

Durum: **kararlar verildi, arka uç yazıldı ve Opus ile gözden geçirildi (2026-10-09).** Ön yüz tasarım bitince yapılacak.
Son güncelleme: 2026-10-09

Amaç: müşteri bulmaktan işin teslimine kadar her şeyi tek sistemde, birbirine bağlı tutmak. Özgür web arayüzünden, Claude MCP üzerinden aynı veritabanını kullanır. Kayıtların üzerinde ikisinin de yazabildiği yorumlar vardır (§2.11).

---

## 1. Genel yapı

```
            ┌──────────────┐        ┌──────────────┐
 Özgür ───▶ │  Web arayüzü │        │  MCP sunucu  │ ◀─── Claude
            │ (Vite+React) │        │   (stdio)    │
            └──────┬───────┘        └──────┬───────┘
                   │ REST                  │ import
            ┌──────▼───────┐               │
            │  NestJS API  │               │
            └──────┬───────┘               │
                   │ import                │
            ┌──────▼───────────────────────▼──────┐
            │   core: servisler + iş kuralları    │
            └──────────────────┬──────────────────┘
                               │ Drizzle + better-sqlite3
                        ┌──────▼──────┐
                        │ SQLite (WAL)│
                        └─────────────┘
```

Kurallar:

- **Tek giriş kapısı core.** Web de MCP de veritabanına doğrudan yazmaz; sadece core servislerini çağırır. "Fırsat kazanıldı, proje açılsın" gibi kurallar tek yerde durur.
- **Kim yaptı, giriş noktasından gelir.** NestJS her çağrıya `actor = "ozgur"`, MCP sunucusu `actor = "claude"` verir. Kullanıcıdan gelen veride `created_by` alanı kabul edilmez.
- **Her önemli adım bir olay yazar.** Core, kaydı değiştirdiği aynı transaction içinde `events` tablosuna satır ekler. Zaman çizelgesi ve rapor buradan okunur.
- **Tek süreç, tek port.** NestJS hem API'yi hem derlenmiş web dosyalarını sunar. MCP sunucusu ayrı bir küçük süreçtir, aynı `.db` dosyasını açar; WAL modu sayesinde ikisi aynı anda çalışır.

### Yığın

| Katman | Seçim | Neden |
|---|---|---|
| Dil | TypeScript (her yerde) | Core tipleri web, API ve MCP'de ortak |
| Arka uç | NestJS (Express adaptörü) | Özgür'ün tercihi; sadece controller + DI, ekstra modül yok |
| Veritabanı | SQLite, `better-sqlite3`, WAL | Kurulum yok, senkron ve hızlı |
| ORM | Drizzle + drizzle-kit (migration) | Hafif, şema TS'de, SQL'e yakın |
| Doğrulama | Zod | Aynı şemalar hem REST girdisi hem MCP aracı için |
| MCP | `@modelcontextprotocol/sdk`, stdio | Claude Desktop / Claude Code yerelde başlatır |
| Ön yüz | Vite + React + Tailwind + Motion + dnd-kit | Akıcı animasyon, kanban sürükle bırak |
| Test | Vitest, bellek içi SQLite | Sadece core |

---

## 2. Veri modeli

Ortak alanlar (her tabloda): `id INTEGER PK`, `created_at`, `updated_at`, `created_by ('ozgur'|'claude')`.
Tarihler ISO metin (`2026-10-09` ya da `2026-10-09T20:55:00Z`). Tutarlar **tam sayı TL** (kuruş yok).

### 2.1 Kişiler ve firmalar

**companies**
| alan | tip | not |
|---|---|---|
| name | text, zorunlu | |
| website, notes | text | |

**people**
| alan | tip | not |
|---|---|---|
| name | text, zorunlu | |
| company_id | → companies | boş olabilir |
| email, phone, handle | text | handle: Instagram/LinkedIn/R10 kullanıcı adı |
| referred_by_id | → people | **referans ağacı**: kimin tanıttığı |
| next_follow_up_at | date | "takibi gelenler" buradan |
| notes | text | |

**person_tags** `(person_id, tag)` birleşik anahtar.
Etiketler sabit liste: `aday`, `musteri`, `ajans`, `is_ortagi`, `network`. Bir kişi birden fazla etiket alabilir.

### 2.2 Kaynaklar

**sources**: `name` (R10, Ajans listesi, Referans, Instagram…), `kind` (`forum`, `liste`, `referans`, `sosyal`, `diger`), `notes`.

### 2.3 Fırsatlar

**opportunities**
| alan | tip | not |
|---|---|---|
| title | text, zorunlu | "X firması e-ticaret sitesi" |
| person_id | → people, zorunlu | |
| source_id | → sources, zorunlu | rapor için şart |
| stage | enum | `bulundu → temas → cevap → gorusme → teklif → kazanildi / kaybedildi` |
| estimated_value | int TL | teklif tutarı |
| lost_reason | text | kaybedildi ise zorunlu |
| next_follow_up_at | date | |
| closed_at | datetime | kazanıldı/kaybedildi anı |
| position | int | kanban sütunu içindeki sıra |

### 2.4 Temaslar

**touches**
| alan | tip | not |
|---|---|---|
| person_id | → people, zorunlu | |
| opportunity_id, project_id | → ilgili kayıt | boş olabilir |
| channel | enum | `whatsapp`, `email`, `telefon`, `yuz_yuze`, `r10`, `instagram`, `linkedin`, `diger` |
| direction | enum | `giden` / `gelen` |
| kind | enum | `mesaj`, `arama`, `gorusme` |
| summary | text | kısa özet ya da mesaj metni |
| outcome | text | sonuç (opsiyonel) |
| happened_at | datetime | |
| draft_id | → drafts | taslaktan geldiyse |

### 2.5 Taslaklar

**drafts**
| alan | tip | not |
|---|---|---|
| person_id | → people, zorunlu | |
| opportunity_id, project_id | | opsiyonel |
| channel | enum | touches ile aynı liste |
| body | text | |
| status | enum | `bekliyor → onaylandi → gonderildi`, ya da `reddedildi` |
| reject_note | text | reddedilirse neden |

### 2.6 Projeler

**projects**
| alan | tip | not |
|---|---|---|
| name | text | |
| opportunity_id | → opportunities, unique | bir fırsattan tek proje |
| person_id | → people | müşteri |
| stage | enum | `pesinat → tasarim_onayi → test_surumu → yayin → teslim → bakim` (+ `iptal`) |
| price | int TL | toplam ücret |
| started_at, delivered_at | date | |
| maintenance_fee | int TL | aylık bakım ücreti, opsiyonel |

### 2.7 Ödemeler

**payments**
| alan | tip | not |
|---|---|---|
| project_id | → projects, zorunlu | |
| milestone | enum | proje aşamalarından biri ya da `bakim` |
| expected_amount | int TL | |
| due_date | date | beklenen tarih |
| paid_amount | int TL | varsayılan 0 |
| paid_at | date | |

Durum hesaplanır, saklanmaz: `paid_amount >= expected` ise ödendi, kısmen ödendiyse kısmi, `due_date` geçtiyse gecikmiş.

### 2.8 Görevler

**tasks**
| alan | tip | not |
|---|---|---|
| title | text | |
| assignee | enum | `ozgur` / `claude` |
| due_date | date | |
| done_at | datetime | boşsa açık |
| person_id, opportunity_id, project_id | | en fazla biri dolu olabilir, hepsi boş da olabilir |

### 2.9 Olaylar (zaman çizelgesi)

**events**
| alan | tip | not |
|---|---|---|
| type | text | örn. `opp.stage`, `touch.created`, `draft.sent`, `payment.paid`, `project.created`, `comment.created` |
| person_id, opportunity_id, project_id | | filtre için; ilgili olanlar doldurulur |
| summary | text | tek satır, insan okur: "Fırsat teklif → kazanıldı" |
| data | JSON | eski/yeni değerler |
| created_by, created_at | | |

Olay yazımı core'un içindedir; elle olay eklenmez.

### 2.10 Ayarlar

**settings** `(key, value)`. Fiyat tabanı girdileri burada:
`bagkur_monthly`, `accounting_monthly`, `other_fixed_monthly`, `target_net_monthly`.

Ek ayar: `tax_rate_percent` (varsayılan 0).

**Fiyat tabanı (aylık)** = (Bağkur + muhasebe + diğer sabit giderler + hedeflenen net gelir) / (1 − vergi oranı). Vergi oranı 0 iken düz toplamdır.

### 2.11 Yorumlar (yeni)

Herhangi bir kaydın üzerine yazılan not/soru. Özgür web'den, Claude MCP'den yazar; yazan giriş noktasından gelir (`created_by`). Yorumlar konu (thread) olarak çalışır: bir kök yorum ve ona verilen cevaplar.

**comments**
| alan | tip | not |
|---|---|---|
| target_type | enum | `person`, `company`, `opportunity`, `project`, `task`, `draft`, `payment` |
| target_id | int | hedef kaydın id'si (polimorfik, FK yok; hedef silinince yorumlar da silinir) |
| body | text, zorunlu | |
| parent_id | → comments | boşsa kök yorum; cevaplar kök yorumun id'sini taşır (düz konu, iç içe yok) |
| resolved_at | datetime | sadece kökte dolar: konu kapatıldı |

Kurallar:

- **Cevapsız konu**: açık (kapatılmamış) ve **son yorumu Özgür yazmış** konu. Cevap Claude'dan beklenir. Claude cevap yazınca ya da konu kapanınca listeden düşer; Özgür yeniden yazarsa tekrar girer.
- Kapalı konuya yeni yorum ya da cevap yazılırsa konu yeniden açılır.
- Yorum metnini sadece yazarı düzenler. Kök yorum silinirse cevapları da gider.
- Her yorum `comment.created` olayı yazar; olay hedefin kişi/fırsat/proje bağlantılarını taşır, yani zaman çizelgesinde görünür.
- Web'de yorum çipleri iki yazar için ayrı renk/etiket taşır (Özgür / Claude); kayıt sayfalarında yorum paneli, Bugün ekranında Özgür'ün cevap bekleyen konuları görünür.

### İlişki özeti

```
companies 1─* people *─* tags
people 1─* people (referred_by)
people 1─* opportunities *─1 sources
opportunities 1─0..1 projects 1─* payments
people/opportunities/projects 1─* touches, drafts, tasks, events
drafts 1─0..1 touches
her kayıt 1─* comments (target_type + target_id) 1─* comments (parent_id)
```

---

## 3. Çekirdek kurallar (core'da yaşayanlar)

1. **Fırsat aşaması** her yöne serbestçe değiştirilebilir (kanbanda geri çekmek mümkün), her değişiklik olay yazar.
2. **Kazanıldı**: `closed_at` dolar, otomatik proje açılır (`pesinat` aşamasında, fiyat = `estimated_value`), ödeme planı şablondan üretilir, kişiye `musteri` etiketi eklenir. Fırsat zaten projeye bağlıysa ikinci proje açılmaz.
3. **Kaybedildi**: `lost_reason` zorunlu, `closed_at` dolar.
4. **Temas otomatik ilerletir**: `bulundu` aşamasındaki fırsata giden temas girilirse aşama `temas` olur; `temas` aşamasındaki fırsata gelen temas girilirse `cevap` olur. Daha ileri aşamalara dokunmaz.
5. **Taslak akışı**: Claude taslak oluşturur (`bekliyor`). Özgür onaylar; "gönderdim" dediği anda taslak `gonderildi` olur ve aynı bilgilerle bir **giden temas** oluşturulur (`created_by = ozgur`, `draft_id` dolu). Böylece kural 4 de çalışır.
6. **Proje aşaması**: peşinat ödemesi tam yapılmadan proje `pesinat`tan ileri geçemez (blok). Geri almak ve `iptal` serbest.
7. **Ödeme** kaydı olay yazar; kısmi ödeme desteklenir.
8. **Kim yaptı** her zaman giriş noktasından gelir, girdiden değil.
9. **Yorum konuları**: kök yorum + cevaplar; "cevapsız" = açık konu ve son yorum Özgür'den (bkz. §2.11). Claude MCP'den cevapsızları listeler ve cevap yazar.

---

## 4. Ekranlar ve beslendikleri sorgular

| Ekran | Veri |
|---|---|
| **Bugün** | `bekliyor` taslaklar · `next_follow_up_at <= bugün` olan kişi ve fırsatlar · bugün ve geçmiş tarihli açık görevler · 7 gün içinde beklenen ve gecikmiş ödemeler · (Claude tarafında) cevapsız yorumlar |
| **Satış hunisi** | Aşamaya göre gruplu açık fırsatlar (kazanılan/kaybedilen sütunlar daraltılmış, son 30 gün) |
| **Proje panosu** | Aşamaya göre projeler + her birinin sıradaki görevi ve sıradaki ödemesi |
| **Zaman çizelgesi** | Bir kişi ya da projenin `events` kayıtları, eskiden yeniye |
| **Rapor** | Kaynak bazında fırsat sayısı, kazanılan, dönüşüm oranı, kazanılan tutar · aylık tahsilat (`paid_at`) vs. fiyat tabanı |
| Kayıt sayfaları | Kişi, firma, fırsat, proje detay ve formlar; her birinde yorum paneli (ekran sayısına dahil değil ama gerekli) |

Sidebar: Bugün, Huni, Projeler, Kişiler, Rapor, Ayarlar. Mobilde alttan açılan çekmece ya da alt sekme çubuğu (tasarımda karar).

---

## 5. MCP araçları (token tasarruflu)

Hedef: Claude, Özgür'ün arayüzde yapabildiği her şeyi yapabilsin, ama her konuşmada az token harcansın.

### İlkeler

- **Az araç, genel parametre.** 40 ayrı araç yerine 10 araç. Araç listesi ve açıklamaları her istekte bağlama girdiği için bu en büyük kazanç (hedef: tüm araç tanımları ~1.500 token altında).
- **Kısa çıktı.** JSON yerine tek satırlık düz metin; boş alanlar yazılmaz. Örnek:
  `#12 Ahmet Yılmaz · aday · R10 · takip 10.10`
- **Yazma işlemleri kaydı geri basmaz.** Sadece sonuç ve yan etkiler döner:
  `ok fırsat #7 → kazanildi · proje #3 açıldı · 3 ödeme planlandı`
- **Varsayılan limit 20**, `limit` ve `offset` ile sayfalama; uzun metinler (taslak gövdesi, notlar) listelerde 60 karakterde kesilir, `get` ile tam hali alınır.
- **İsimle ya da id ile referans.** `person: "Ahmet"` verilirse core tek eşleşmeyi bulur, birden fazla varsa kısa liste döner. Claude'un önce arama yapıp id öğrenme turunu atlatır.
- **Tarihler kısa**: `bugün`, `yarın`, `+3g` ya da ISO.

### Araç listesi

| Araç | Ne yapar | Örnek çıktı |
|---|---|---|
| `today()` | Bugün ekranının özeti | 4 kısa bölüm, her biri en fazla 10 satır |
| `find(type, q?, filter?, limit?)` | Kişi, firma, fırsat, proje, görev, taslak, ödeme, kaynak, temas, yorum, ayar listeler. `filter` örn. `{stage:"teklif"}`, `{tag:"ajans"}`, `{overdue:true}`, `{unanswered:true}` (yorum) | satır başına bir kayıt |
| `get(type, id, with?)` | Tek kaydın tamamı; `with: ["touches","tasks","payments","comments"]` ile ilgili kayıtlar. `type: "comment"` tüm konuyu verir; kaydın açık yorum konusu varsa belirtir | kompakt blok |
| `save(type, data, id?)` | Oluştur ya da güncelle (kişi, firma, kaynak, fırsat alanları, proje alanları, görev, ödeme planı, ayar, **yorum**). Aşama değişikliği burada yapılmaz. Yorum: yeni konu `{target_type, target_id, body}`, cevap `{reply_to, body}`, kapatma `id + {resolved:true}` | `ok kişi #12` |
| `move(type, id, stage, reason?)` | Fırsat ya da proje aşaması değiştirir, kuralları çalıştırır | yan etkiler |
| `touch(person, channel, direction, summary, opp?, project?, at?)` | Temas kaydı | `ok temas #40 · fırsat #7 → cevap` |
| `draft(person, channel, body, opp?, project?)` | Onaya taslak bırakır | `ok taslak #9 onay bekliyor` |
| `pay(payment_id, amount, date?)` | Ödeme girer | `ok ödeme #5 · 15.000/15.000 ödendi` |
| `timeline(type, id, limit?)` | Kişi/proje/fırsat olayları | `09.10 Claude · Taslak hazırlandı` |
| `report(month?)` | Kaynak dönüşümü + aylık gelir vs. taban | küçük tablo |
| `delete(type, id)` | Silme (aynı kurallarla, olay yazar) | `ok` |

**Yorumlar için ayrı araç yok**: `find("comment", filter {unanswered:true})` Claude'un cevaplaması gereken konuları verir (aynı liste `today()` çıktısının en üstünde "Cevapsız yorum" olarak gelir), `get("comment", id)` konuyu tam okutur, `save("comment", ...)` cevap yazar. Böylece araç sayısı 11'de kalır.

Not: **Taslak onaylama ve "gönderildi" işaretleme MCP'de yok**, çünkü taslak akışının anlamı Özgür'ün onayı. Diğer her şey iki tarafta aynı.

### Çalışma şekli

MCP sunucusu Özgür'ün bilgisayarında, Claude Desktop ya da Claude Code yapılandırmasına eklenir (`node packages/mcp/dist/index.js`). Aynı `.db` dosyasını açar. Bu proje sohbetindeki (bulutta çalışan) Claude bu dosyaya doğrudan erişemez; şimdilik erişmeyecek (§7, karar 8).

---

## 6. Çekirdek testler (kod yazmadan önce)

Hepsi `core` paketinde, bellek içi SQLite ile, Vitest. Gerisi elle test edilir.

**Yazılanlar (8 + yorum özelliği için 1):**

1. **Kazanılan fırsat projeye döner**: `move(opp, kazanildi)` sonrası tek proje oluşur, aşaması `pesinat`, fiyatı fırsat tutarı, ödeme planı oluşur, kişiye `musteri` etiketi eklenir. Aynı fırsat ikinci kez kazanıldıya çekilirse ikinci proje açılmaz.
2. **Kaybedildi için neden zorunlu**: neden yoksa hata, varsa `closed_at` dolu.
3. **Gönderilen taslak temas olur**: taslak `gonderildi` olunca `draft_id` bağlı tek bir giden temas oluşur ve `bulundu` aşamasındaki fırsat `temas`a geçer.
4. **Temas otomatik ilerletme sınırları**: gelen temas `temas → cevap` yapar; `teklif` aşamasındaki fırsata temas aşamayı değiştirmez.
5. **Kim yaptı doğru yazılır**: MCP actor'üyle yapılan işlem `created_by = claude`, girdide `created_by: "ozgur"` gönderilse bile.
6. **Fiyat tabanı ve aylık rapor**: verilen ayar değerleri ve ödemelerle taban, tahsilat ve fark doğru hesaplanır; kısmi ödeme ödendiği aya sayılır.
7. **Kaynak dönüşüm oranı**: kaynak başına kazanılan / kapanan (kazanılan + kaybedilen) doğru; açık fırsatlar paydaya girmez.

8. **Peşinat bloğu**: peşinat ödenmeden proje `pesinat`tan ileri geçemez, ödenince geçer.
9. **Yorum konuları**: Özgür'ün yorumu cevapsız listesine girer, Claude cevap yazınca ya da konu kapanınca düşer; yorumu sadece yazarı düzenler.

**Opsiyonel (gerekirse):**

9. Bugün sorgusu: dünkü açık görev gecikmiş olarak gelir, tamamlanan gelmez.
10. Her durum değişikliği tam bir olay yazar (transaction geri alınırsa olay da yazılmaz).

---

## 7. Kararlar (2026-10-09, Özgür kararları Claude'a bıraktı)

| # | Konu | Karar |
|---|---|---|
| 1 | **Ön yüz** | Vite + React + Tailwind + Motion (animasyon) + dnd-kit (kanban). NestJS derlenmiş dosyaları sunar |
| 2 | **Ödeme planı şablonu** | Kazanınca 3 ödeme: peşinat %40, tasarım onayı %30, yayın %30. Tutarlar ve tarihler proje bazında düzenlenebilir; şablon `settings`'te durur, sonradan değiştirilebilir |
| 3 | **Fiyat tabanı formülü** | (Bağkur + muhasebe + diğer sabit + hedef net) / (1 − vergi oranı). Vergi oranı varsayılan 0 |
| 4 | **Para birimi** | Sadece TL, tam sayı |
| 5 | **Taslak onayı** | Sadece Özgür onaylar ve gönderildi işaretler; MCP'de bu işlem yok |
| 6 | **Peşinat kuralı** | Blok: peşinat tam ödenmeden proje ilerlemez |
| 7 | **Telefondan erişim** | Sunucu yerel ağda (0.0.0.0) açılır, tek şifreli basit giriş (şifre `.env`'de, imzalı çerez, 30 gün) |
| 8 | **Buluttaki Claude erişimi** | Şimdilik yok; MCP'yi Özgür'ün bilgisayarındaki Claude Desktop/Claude Code kullanır |

## 8. Klasör yapısı

```
full-follow/
├─ package.json            npm workspaces, ortak script'ler
├─ tsconfig.base.json
├─ data/                   fullfollow.db (git'e girmez)
└─ packages/
   ├─ core/
   │  ├─ src/
   │  │  ├─ db/            schema.ts, client.ts (WAL açılışı), migrations/
   │  │  ├─ schemas/       Zod girdi şemaları
   │  │  ├─ services/      people, opportunities, projects, touches,
   │  │  │                 drafts, payments, tasks, reports, today
   │  │  ├─ events.ts      olay yazımı
   │  │  └─ index.ts       createCore(db, actor)
   │  └─ test/
   ├─ server/              NestJS
   │  └─ src/              main.ts, app.module.ts, controllers/ (kaynak başına bir controller)
   ├─ mcp/
   │  └─ src/              index.ts, tools.ts, format.ts (kısa çıktı biçimleri)
   └─ web/                 Vite + React
      └─ src/              app/, pages/, components/, api/, styles/
```

`createCore(db, actor)`: core'u kimin adına çalıştığını bilerek kurar. NestJS `actor="ozgur"`, MCP `actor="claude"` ile çağırır.

Gerçekleşen yapı (`packages/core/src` altında): `constants.ts`, `dates.ts`, `context.ts` (hata sınıfı, olay yazımı, ham SQL yardımcıları), `db/` (şema, client, `migrations/`), `schemas/index.ts` (Zod), `services/` (people, companies, opportunities, projects, payments, touches, drafts, tasks, comments, settings, queries, reports, today, records, shared), `index.ts` (`createCore`). Tablolar: 13 (companies, people, person_tags, sources, opportunities, touches, drafts, projects, payments, tasks, comments, events, settings).

### Uygulama notları (arka uç)

- İsim girdisi: MCP/core `person`, `company`, `source`, `opp`, `project`, `referred_by` alanlarını isimle kabul eder; tek eşleşme yoksa kısa aday listesiyle hata verir. Aramada büyük/küçük harf, Türkçe karakter ve aksan fark etmez.
- Tarihler: ISO ya da `bugün`, `yarın`, `dün`, `+3g`, `+1h` (hafta).
- Temas fırsat vermeden girilirse ve kişinin tam bir açık fırsatı varsa ona bağlanır.
- Ödeme: `pay` tutarı ödenene **ekler**; kalan tutardan fazlası reddedilir. `paid_at` son ödemenin tarihidir. Aylık tahsilat `payment.paid` olaylarından okunur, yani her kısmi ödeme kendi ayına yazılır. Elle düzeltme (`paid_amount`/`paid_at`) eski kayıtları ters çeviren bir `payment.corrected` olayı yazar, rapor da düzelir.
- Ödeme planı şablonu `settings.payment_template` (JSON) ile değişir; varsayılan peşinat %40 (bugün), tasarım onayı %30 (+14 gün), yayın %30 (+30 gün). Fiyat girilmemiş fırsat kazanılırsa proje açılır ama plan çıkmaz; fiyat sonradan girilince plan üretilir. Peşinat ödemesi planlanmamış projede de ilerleme bloklanır.
- Silme: bağlı fırsat/proje/ödeme varsa reddedilir; hafif bağlantılar (etiket, temas, görev, yorum) kişiyle birlikte gider. Her silme olay yazar; olaylar silinen kayıttan sonra da kalır.
- Yorum silme: Claude sadece kendi yorumunu (ve sadece kendi cevapları olan kökü) silebilir; Özgür her yorumu silebilir. Kapalı konuya cevap yazılınca `comment.reopened` olayı yazılır.
- Bağlantı tutarlılığı: temas, taslak ve projede verilen fırsat/proje aynı kişiye ait olmalı. Proje hakkındaki temas (project verilmiş) kişinin açık fırsatına otomatik bağlanmaz, satış aşamasını ilerletmez. Referans ağacında döngü kurulamaz.
- Web sunucusu: şifre (`FF_PASSWORD`) tanımlıysa `0.0.0.0`, değilse sadece `127.0.0.1` dinler. Ayarlar kök `.env` dosyasından okunur.

---

## 9. Yapım sırası (2-3 saat hedefi)

1. İskelet: workspaces, core şema + migration, `createCore`. ✅ yapıldı
2. Core servisleri + testler (8 + yorum). ✅ yapıldı
3. NestJS controller'ları + MCP araçları (ikisi de ince katman). ✅ yapıldı
4. Artboard'da tasarım sistemi ve ekranlar (paralel ya da önce). 
5. Web ekranları: Bugün, Huni, Proje panosu, Zaman çizelgesi, Rapor, kayıt formları. (~60 dk)
6. Elle uçtan uca deneme: kişi → fırsat → taslak → temas → kazanıldı → ödeme → rapor.
