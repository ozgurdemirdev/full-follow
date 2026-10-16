# Full Follow · Mimari Plan

Durum: **arka uç, ön yüz, Paket 1 (network paneli) ve Paket 2 (pazarlama, §11) yazıldı (2026-10-09).**
Son güncelleme: 2026-10-09

Amaç: **önce ilişki ve pazarlama takibi.** Full Follow, bir işletmenin kiminle hangi kanaldan temas kurduğunu, kimin döndüğünü, kimin soğuduğunu ve kimin kimi tanıttığını tek yerde tutar. Satış hunisi ve projeler (teslim, ödeme) bunun üzerine kurulur. Kullanıcı web arayüzünden, yapay zeka asistanı (Claude) MCP üzerinden aynı veritabanını kullanır. Kayıtların üzerinde ikisinin de yazabildiği yorumlar vardır (§2.11).

### Ürün yönü (2026-10-09, Özgür)

- **Kişi kartı ana merkez**: bir kişinin kanal kanal bütün temasları, notları, yorumları, sektörü, kimin tanıttığı ve tanıttıkları tek ekranda.
- **Network'ü büyütme kanalları**: soğuk e-posta, Instagram DM, LinkedIn, telefon, yüz yüze (WhatsApp ve R10 da duruyor).
- **Bugün ekranı network odaklı**: cevap bekleyenler (kanal, kaç gündür), takibi gelenler, soğuyan bağlantılar, haftalık temas sayıları.
- **Referans değeri**: kimin tanıttığı kişilerden ne kadar fırsat ve iş geldiği.
- **Paket 2 (pazarlama)**: paylaşımlar (yenileme hatırlatması, hangi paylaşım kişi ve iş getirdi), takip dizileri (cevapsız mesaja 3. ve 7. günde otomatik takip taslağı), sektör ve kanala göre mesaj şablonları, ürün fikirleri ve ilgi ölçümü (§2.14–2.17, §11).

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
- **Kim yaptı, giriş noktasından gelir.** NestJS her çağrıya `actor = "owner"`, MCP sunucusu `actor = "claude"` verir. Kullanıcıdan gelen veride `created_by` alanı kabul edilmez.
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

Ortak alanlar (her tabloda): `id INTEGER PK`, `created_at`, `updated_at`, `created_by ('owner'|'claude')`.
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
| email, phone | text | |
| instagram, linkedin | text | kullanıcı adı ya da profil adresi (Paket 1) |
| handle | text | diğer kullanıcı adı (R10 vb.) |
| sector_id | → sectors | iki seviyeli sektör (Paket 1, §2.12) |
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
| channel | enum | `email`, `instagram` (DM), `linkedin`, `telefon`, `yuz_yuze`, `whatsapp`, `r10`, `diger` |
| direction | enum | `giden` / `gelen` |
| kind | enum | `mesaj`, `arama`, `gorusme` |
| summary | text | kısa özet ya da mesaj metni |
| outcome | text | sonuç (opsiyonel) |
| happened_at | datetime | |
| expects_reply | bool | giden temas cevap bekliyor mu (Paket 1). Varsayılan: giden **mesaj** ise evet, arama/görüşme/gelen ise hayır. Sonradan kapatılabilir |
| draft_id | → drafts | taslaktan geldiyse |

Temas **fırsat açmadan** doğrudan kişiye eklenir; fırsat ve proje alanları opsiyoneldir.

### 2.5 Taslaklar

**drafts**
| alan | tip | not |
|---|---|---|
| person_id | → people, zorunlu | |
| opportunity_id, project_id | | opsiyonel |
| channel | enum | touches ile aynı liste |
| body | text | |
| reason | text | Claude'un bu taslağı neden hazırladığı (ör. "5 gündür cevap yok, ikinci mesaj") (Paket 1) |
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
| assignee | enum | `owner` / `claude` |
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

Network ayarları (Paket 1): `reply_wait_days` (varsayılan 3: bu kadar gün cevap gelmezse "gecikti" sayılır), `cooling_days` (varsayılan 30: bu kadar gün temas yoksa bağlantı soğuyor).

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

### 2.12 Sektörler (Paket 1)

İki seviyeli liste, etiketlerden ayrı alan. Örnek: `Sağlık > Diş hekimi`, `Sağlık > Veteriner`, `Yeme içme > Kafe`.

**sectors**
| alan | tip | not |
|---|---|---|
| name | text, zorunlu | aynı üst altında tekil (büyük/küçük harf duyarsız) |
| parent_id | → sectors | boşsa ana sektör; doluysa ana sektörün alt sektörü (en fazla iki seviye) |

- Kişiye `sector_id` ile bağlanır. Girdi olarak `sector: "Sağlık > Diş hekimi"` ya da sadece `"Diş hekimi"` verilebilir: yol verilirse eksik sektörler açılır, tek ad verilirse var olan eşleşir (yoksa ana sektör olarak açılır).
- Ana sektörle filtreleyince alt sektördeki kişiler de gelir.
- Kullanılan ya da altı olan sektör silinmez. Paket 2'de mesaj şablonları ve fikirler de bu tabloya bağlanır.

### 2.13 Notlar (Paket 1)

Kişi kartındaki tarihli notlar ("2 kliniği var, Instagram'da aktif"). Yorumlardan farkı: cevap beklemez, Claude'a soru değildir; kişi hakkında bilgi birikir. `people.notes` kısa özet alanı olarak kalır.

**notes**
| alan | tip | not |
|---|---|---|
| person_id | → people, zorunlu | |
| body | text, zorunlu | |

Not ekleme `note.created` olayı yazar (kişinin zaman çizelgesinde görünür). Kişi silinince notları da gider.

### 2.14 Paylaşımlar (Paket 2)

R10 konusu, LinkedIn ya da Instagram gönderisi. Forum konuları belli aralıkla "güncellenir" (yukarı taşınır); aralık dolunca Bugün ekranında hatırlatma çıkar.

**posts**
| alan | tip | not |
|---|---|---|
| platform | enum | `r10`, `linkedin`, `instagram`, `diger` |
| title | text, zorunlu | |
| url, body, notes | text | |
| posted_at | date | varsayılan bugün |
| refresh_days | int | yenileme aralığı (gün); boşsa hatırlatma yok |
| refreshed_at | date | son "güncelledim" |
| idea_id | → ideas | paylaşım bir fikri tanıtıyorsa |

- **Kaynak**: `people.post_id` kişiyi getiren paylaşım. Paylaşımın getirisi: kişi sayısı, o kişilerin fırsatları, kazanılan sayı ve tutar (hesaplanır).
- Paylaşım silinince kişiler kalır, bağ kopar.

### 2.15 Mesaj şablonları (Paket 2)

**templates**
| alan | tip | not |
|---|---|---|
| name | text, zorunlu | |
| kind | enum | `ilk` (ilk mesaj), `takip`, `teklif`, `diger` |
| channel | enum, boş olabilir | boş = tüm kanallar |
| sector_id | → sectors, boş olabilir | boş = tüm sektörler; ana sektör alt sektörleri de kapsar |
| body | text | yer tutucular: `{ad}` (ilk ad), `{ad_soyad}`, `{firma}`, `{sektor}` |

- Taslakta `drafts.template_id` kullanılan şablonu tutar; şablon başarısı hesaplanır: kullanım, gönderilen, gönderildikten sonra cevap gelen (dönüş oranı).
- Şablon silinince taslaklar kalır, bağ kopar.

**A/B kıyası** (Rapor ekranı, `templateComparison`, hesaplanır): gönderilmiş şablonlar tür + kanal grubunda karşılaştırılır (`channel` boşsa "tüm kanallar" grubu). `TEMPLATE_MIN_SAMPLE` (20) gönderimden azı `early` ("erken") sayılır: oranı güvenilir değildir. Grup içinde yeterli örneği olanlar cevap oranına göre, sonra erken olanlar gelir. `leader` ("önde") ancak grupta yeterli örneği olan en az iki şablon varsa ve en yüksek oran ikincisinden kesin büyükse işaretlenir; yoksa kazanan ilan edilmez. Her şablonda alıcı sektörüne göre döküm vardır: alıcının sektörü (kişinin, yoksa firmasının; birden çoksa en küçük sektör id'si), sektörü yoksa "Sektörsüz" kovası. Gönderilen ve cevap sayımı `templateStats` ile aynı kuraldır (`REPLIED_AFTER`).

### 2.16 Takip dizisi (Paket 2)

Ayrı tablo yok. Cevap bekleyen kuralının (§3/10) verisinden hesaplanır; üretilen taslaklar `drafts.followup_step` (1 = ilk takip) taşır. Süreler `settings.followup_days` (varsayılan `[3,7]`, en fazla 5 adım, boş = kapalı).

### 2.17 Fikirler (Paket 2)

**ideas**: `title`, `problem` (çözdüğü sorun), `stage` (`fikir → dogrulaniyor → demo → urun`), `notes`.
**idea_sectors** `(idea_id, sector_id)`: hedef sektörler (iki seviyeli sektörlerden, `sectors: ["Sağlık > Diş hekimi"]` ile eksikler açılır).
**idea_people**: fikir kime anlatıldı. `idea_id`, `person_id` (çift tekil), `interest` (`anlatildi`, `ilgilendi`, `ilgilenmedi`), `note`, `touch_id` (anlatıldığı temas).
`touches.idea_id`: temas bir fikir hakkındaysa.

Kapsam (Kendi projelerim, §13): `own_project_id` boşsa genel para kazanma fikri, doluysa o kendi projesinin fikri; projede `priority` (`yuksek|orta|dusuk`), `position` (grup içi sıra) ve `done_at` anlamlıdır. `parent_id` sadece genel fikirlerde üst fikirdir.

İlgi ölçümü (hesaplanır): kaç kişiye anlatıldı, kaçı ilgilendi, oran; fikre bağlı temas ve paylaşım sayısı.

### 2.18 Pazarlama ayarları (Paket 2)

`followup_days` (JSON dizi, "3,7" de kabul edilir) ve `weekly_target` (haftalık giden mesaj hedefi, 0 = kapalı; Bugün ekranında ilerleme).

**Günlük kota ve e-posta ısınması**: `channel_limits` (JSON nesne, kanal → günlük giden mesaj limiti; sadece `CHANNELS` kanalları, 0 ya da boş = limitsiz; varsayılan `{"email":20,"instagram":15,"whatsapp":15}`) ve `email_warmup_until` (ISO tarih ya da boş; bu tarihe kadar, o gün dahil, soğuk e-posta kapalı). "Gönderilen" = o gün `direction = giden` ve `kind = mesaj` olan temaslar (hedeflerle aynı sayım, `quota.ts` `outgoingMessageCounts`). Durum: `ok`, `near` (limitin %80'i, `QUOTA_NEAR_RATIO`), `over` (limit doldu ya da aşıldı). Soğuk e-posta = daha önce hiç temas olmayan kişiye, firmaya ya da adrese giden e-posta mesajı. Engel yok, sadece uyarı: bugünün giden temasında (taslak "gönderdim" ya da elle temas) kanal limite ulaşırsa/aşarsa ya da ısınma sürerken soğuk e-posta giderse sonucun `effects` listesine Türkçe uyarı eklenir (web bildirimde gösterir). Geçmiş tarihli temas uyarı üretmez.

### 2.19 Kaynak hunisi (fikir #30)

Hangi kaynak iş getiriyor, hangisine boşuna zaman gidiyor: `sourceFunnel` (`services/sourceFunnel.ts`, hesaplanır, saklanmaz). Birim, kaynağı (`source_id`) olan her **kişi ve firma**dır. Altı adım, her biri o adıma ulaşan kayıt sayısı ve bir önceki adıma göre oran: **bulundu** (kayıt) → **yazıldı** (en az bir giden temas) → **cevap** (giden temastan sonra gelen temas; şablonlardaki `REPLIED_AFTER` kuralı, ikinci bir eşleştirme yazılmadı) → **görüşme** (`contact_status = gorusuldu`, yani `status.ts` arama ve görüşme temasından bu durumu türetir, ya da `gorusme` türünde temas) → **teklif** (kaydın bir fırsatı `teklif` ya da `kazanildi` aşamasında; teklifte kaybedilen de `opp.stage` olayından sayılır) → **kazanıldı** (fırsat `kazanildi`). Firma kendi temaslarını, çalışanlarının temaslarını ve fırsatlarını sayar (`bumpStatus` ile aynı bakış). Sonraki adım önceki adımları gerektirir sayılır, yani sayılar huni boyunca artmaz.

Dönem (`period`) kayıt oluşturma tarihine göre süzer: `30`, `90` ya da `all`; varsayılan `SOURCE_FUNNEL_DEFAULT_PERIOD` (90). `reply_rate` = cevap / yazıldı. Yazılanı `RATE_MIN_SAMPLE` (20; şablonlardaki `TEMPLATE_MIN_SAMPLE` ile aynı sabit) altında olan kaynak `early` ("erken") sayılır, oranı güvenilir değildir. Yeterli örneği olan kaynaklar arasında cevap oranı en düşük üçte biri (`SOURCE_WEAK_SHARE`) `weak` ("zayıf") işaretlenir; en az bir kaynak ondan daha iyi olmalıdır, hepsi eşitse kimse zayıf değildir. Uç: `GET /api/report/sources?period=`. MCP `report()` tek satır ekler: `Kaynak (90g): R10 40→22→6→2→1→0 zayıf · Ajans 12→9→3→1→0→0 erken`. Web: Rapor sayfasında "Kaynak hunisi" bölümü (`SourceFunnel.tsx`), kaynak başına altı adımlık çubuk ve dönem filtresi.

### 2.20 Haftalık inceleme (fikir #31)

Cuma günü elle toplanan haftalık özet tek yerden gelir: `weeklyReview(week?)` (`services/review.ts`, hesaplanır, saklanmaz; mevcut servisleri yeniden kullanır). `week` ISO hafta etiketi (`2026-W41`) ya da o haftadan bir tarihtir, boşsa bu hafta; geçersiz etiket doğrulama hatasıdır. İçerik:

- **Giden mesaj** haftalık hedefe karşı (`weekStats(ctx, ref)`, hafta pazartesiden; hedef `weekly_target`, 0 = kapalı) ve geçen hafta; **dönüş oranı** (gelen / giden) geçen haftayla; **görüşme** (`gorusme` temas sayısı); **teklif** (o hafta `teklif` aşamasına geçen fırsatlar, `opp.stage` olaylarından); **yeni kayıt** (kişi ve firma ayrı).
- **Şablonlar**: `templateComparison` içinden sadece net `leader` (önde) olan ya da `early` şablonu bulunan gruplar; lider ve yeterli örneği olan en geride şablon.
- **Kaynaklar**: §2.19 hunisinin varsayılan döneminde en iyi (yeterli örnekli, en yüksek cevap oranı) ve en zayıf (`weak`) kaynak.
- **Günlük limit**: `quotaOverDays` (`quota.ts`, günlük kota ile aynı sayım): kanal başına limitin dolduğu ya da aşıldığı gün sayısı.
- **Gelecek hafta için öneriler** (2 ile 4 arası, kural tabanlı, yapay zeka çağrısı yok; Türkçe düz metin ve görev başlığı): giden mesaj hedefin altında `REVIEW_TARGET_MISS_SHARE` (%75, yani yüzde 25'ten fazla kaçırıldı) ise hedefi düşür ya da günlük hedef ekle (düşürülen sayı `REVIEW_TARGET_STEP` = 5'in katına yuvarlanır); net lideri olan şablon grubunda geride kalan şablonu bırak (en büyük oran farkı olan grup); zayıf kaynak varsa zamanı en iyi kaynağa kaydır; bir kanal limiti `REVIEW_LIMIT_DAYS` (3) ve üstü gün dolduysa limiti koru. En az `REVIEW_MIN_SUGGESTIONS` (2) öneriye tamamlamak için koşulsuz öneriler eklenir (hedef yoksa hedef koy, hedef tutturulduysa tempoyu koru, yeni kayıt sayısı, örnek azsa şablon ve kaynak gir); en fazla `REVIEW_MAX_SUGGESTIONS` (4).
- `next_monday`: önerilerden "Göreve çevir" ile açılan görevin son tarihi, bugünden sonraki pazartesi (görev mevcut `tasks` servisiyle `POST /api/tasks`).

Uç: `GET /api/review?week=`. `GET /api/today` yanıtında `review: {week, ready}` bulunur; `ready`, `REVIEW_WEEKDAY` (Cuma) günü doğrudur. MCP: ayrı araç yok, `report(week?)` (`week` etiket, tarih ya da `bu`) rapor yerine incelemeyi döner. Web: Sidebar'da Rapor'un altında "Haftalık inceleme" (`/inceleme`, ok düğmeleriyle önceki ve sonraki hafta), Cuma günü Dashboard'un üstünde "Cuma incelemesi hazır" bağlantı kartı.

### İlişki özeti

```
companies 1─* people *─* tags
people 1─* people (referred_by)
sectors 1─* sectors (parent) 1─* people
people 1─* notes
people 1─* opportunities *─1 sources
opportunities 1─0..1 projects 1─* payments
people/opportunities/projects 1─* touches, drafts, tasks, events
drafts 1─0..1 touches
posts 1─* people (post_id: kaynak) · ideas 1─* posts, touches
templates 1─* drafts · sectors 1─* templates
ideas *─* sectors (idea_sectors) · ideas *─* people (idea_people: ilgi)
her kayıt 1─* comments (target_type + target_id) 1─* comments (parent_id)
```

---

## 3. Çekirdek kurallar (core'da yaşayanlar)

1. **Fırsat aşaması** her yöne serbestçe değiştirilebilir (kanbanda geri çekmek mümkün), her değişiklik olay yazar.
2. **Kazanıldı**: `closed_at` dolar, otomatik proje açılır (`pesinat` aşamasında, fiyat = `estimated_value`), ödeme planı şablondan üretilir, kişiye `musteri` etiketi eklenir. Fırsat zaten projeye bağlıysa ikinci proje açılmaz.
3. **Kaybedildi**: `lost_reason` zorunlu, `closed_at` dolar.
4. **Temas otomatik ilerletir**: `bulundu` aşamasındaki fırsata giden temas girilirse aşama `temas` olur; `temas` aşamasındaki fırsata gelen temas girilirse `cevap` olur. Daha ileri aşamalara dokunmaz.
5. **Taslak akışı**: Claude taslak oluşturur (`bekliyor`). Özgür onaylar; "gönderdim" dediği anda taslak `gonderildi` olur ve aynı bilgilerle bir **giden temas** oluşturulur (`created_by = owner`, `draft_id` dolu). Böylece kural 4 de çalışır.
6. **Proje aşaması**: peşinat ödemesi tam yapılmadan proje `pesinat`tan ileri geçemez (blok). Geri almak ve `iptal` serbest.
7. **Ödeme** kaydı olay yazar; kısmi ödeme desteklenir.
8. **Kim yaptı** her zaman giriş noktasından gelir, girdiden değil.
9. **Yorum konuları**: kök yorum + cevaplar; "cevapsız" = açık konu ve son yorum Özgür'den (bkz. §2.11). Claude MCP'den cevapsızları listeler ve cevap yazar.

**Network kuralları (Paket 1)**

10. **Cevap bekleyen**: kişinin son *gelen* temasından sonra `expects_reply` işaretli *giden* temas varsa kişi cevap bekliyor. Kanal = son giden temasın kanalı; gün = son giden temastan bu yana; deneme = cevapsız giden temas sayısı. Gün `reply_wait_days`'i aşınca "gecikti". Gelen temas girilince kişi listeden düşer; giden temasta `expects_reply` kapatılarak da düşürülür.
11. **Soğuyan bağlantı**: bağlantı sayılan kişi (en az bir gelen teması olan ya da `musteri`, `is_ortagi`, `network`, `ajans` etiketli) son temasının üzerinden `cooling_days` geçtiyse, cevap beklemiyorsa ve takip tarihi (`next_follow_up_at`) boşsa soğuyor; takip tarihi girilmiş kişi zaten takip listesinde olduğu için soğuyanlarda gösterilmez. Hiç teması olmayan etiketli kişide kişinin eklenme tarihi sayılır.
12. **Sektör iki seviye**: alt sektörün üstü ana sektör olmalı; altı olan sektör başka sektörün altına taşınamaz; kendi altına bağlanamaz.
13. **Referans değeri**: bir kişinin tanıttıkları (doğrudan ve onların tanıttıkları, tüm alt ağaç) üzerinden gelen fırsat sayısı, kazanılan sayısı, kazanılan tutar (`estimated_value`) ve açık fırsat tutarı. Doğrudan tanıttığı kişi sayısı ayrıca verilir.

**Pazarlama kuralları (Paket 2)**

14. **Takip dizisi**: kişinin son gelen temasından sonraki cevap bekleyen giden mesajlar bir dizidir. k = cevapsız giden mesaj sayısı (ilk mesaj + gönderilen takipler); ilk cevapsız mesajın üzerinden `followup_days[k-1]` gün geçince k. takip zamanı gelir. Zamanı gelince onaya taslak açılır (`followup_step = k`, `reason` "Otomatik takip 1/2: 3 gündür cevap yok (LinkedIn)"). Metin: kişinin kanal ve sektörüne en uyan `takip` şablonu, yoksa varsayılan nazik metin. Bekleyen (onaylanmamış) taslağı olan kişiye ve bu dizide aynı adım için zaten taslak açılmış kişiye (reddedilmiş olsa bile) yeni taslak açılmaz. Gelen temas diziyi bitirir; adımlar bitince yeni taslak yok. Taslak gönderilince giden temas olur, deneme sayısı artar, sıradaki adım beklenir.
15. **Otomatik üretim**: web sunucusu açılışta ve saatte bir, MCP `today()` her çağrıda zamanı gelen takip taslaklarını hazırlar. Bu taslaklar `created_by = claude` yazılır (Claude taslağı); onay ve gönderme yine sadece Özgür'de (§3/5). `FF_AUTO_FOLLOWUP=0` sunucudaki zamanlayıcıyı kapatır.
16. **Paylaşım yenileme**: `refresh_days` girilmiş paylaşımda son yenileme (yoksa paylaşım günü) + aralık ≤ bugün ise "güncelle" hatırlatması çıkar. "Güncelledim" (`refreshed: true`) yenileme gününü bugüne alır, `post.refreshed` olayı yazar.
17. **Şablon seçimi**: başka kanala ya da başka sektöre yazılmış şablon önerilmez. Puan: aynı kanal 4, tüm kanallar 1; aynı alt sektör 4, kişinin ana sektörü 3, tüm sektörler 1; eşitlikte dönüş oranı yüksek olan önde. Taslak metni boş verilip şablon seçilirse metin şablondan kişiye uygulanarak doldurulur.
18. **Fikir ilgisi**: fikir hakkındaki temas (`idea_id`) kişiyi fikre "anlatıldı" olarak bağlar (zaten bağlıysa ilgisine dokunmaz). İlgi seviyesi elle (`interest` kaydı) değişir, `idea.interest` olayı yazar. Fikir aşaması `move("idea", id, stage)` ya da `save` ile değişir, `idea.stage` olayı yazar. Fikir silinince bağlı kişi ve sektör satırları gider, temas ve paylaşımlar kalır.

---

## 4. Ekranlar ve beslendikleri sorgular

| Ekran | Veri |
|---|---|
| **Bugün** (network) | haftalık temas sayıları (`GET /api/stats/week`, haftalık hedef varsa ilerleme) · **cevap bekleyenler** (kanal, kaç gün, kaç deneme) · takibi gelen kişi ve fırsatlar · **soğuyan bağlantılar** · `bekliyor` taslaklar (nedeniyle; otomatik takipler "1. takip" çipiyle) · **takip zamanı gelenler** (taslağı henüz yoksa, "Şimdi hazırla") · **güncellenecek paylaşımlar** ("Güncelledim") · bugün ve geçmiş tarihli açık görevler · cevap bekleyen yorumlar · 7 gün içindeki ödemeler (küçük) |
| **Paylaşımlar** (Paket 2) | Platform filtresi; her paylaşım: tarih, sonraki güncelleme, getirdiği kişi/fırsat/kazanılan tutar, bağlı fikir. Ekle/düzenle/güncelledim/sil, getirdiği kişiler |
| **Fikirler** (Paket 2) | Aşama filtresi; her fikir: sorun, hedef sektörler, aşama, anlatılan/ilgilenen ve oran. Detayda kişiler (ilgi seviyesi değiştirme), kişi bağlama, paylaşımlar, notlar |
| **Şablonlar** (Paket 2) | Tür ve kanal filtresi; şablon: kanal, sektör, metin, kullanım ve dönüş oranı. Ekle/düzenle/sil. Taslak formunda kişiye ve kanala göre önerilir |
| **Taslak yaz** (form) | Kişi, kanal, önerilen şablonlar (seçince metin kişiye uygulanır), metin, neden. Kişi kartında "Taslak yaz" |
| **Kişiler + kişi kartı** | Liste: etiket, sektör ve durum (cevap bekliyor / soğuyor / takip) filtreleri, son temas kanalı ve günü. Kart (`GET /api/people/:id/card`, tek istek): iletişim ve kanal hesapları, sektör, kanal kanal temas özeti ve geçmişi, notlar, yorum konuları mesajlarıyla, referans ağı ve referans değeri, fırsat ve projeler kısaca |
| **Referanslar** | Kimin tanıttığı kişilerden ne kadar fırsat ve iş geldiği (`GET /api/report/referrals`) |
| **Satış hunisi** | Aşamaya göre gruplu açık fırsatlar (kazanılan/kaybedilen sütunlar daraltılmış, son 30 gün) |
| **Proje panosu** | Aşamaya göre projeler + her birinin sıradaki görevi ve sıradaki ödemesi |
| **Zaman çizelgesi** | Bir kişi ya da projenin `events` kayıtları, eskiden yeniye |
| **Rapor** | Kaynak bazında fırsat sayısı, kazanılan, dönüşüm oranı, kazanılan tutar · aylık tahsilat (`paid_at`) vs. fiyat tabanı · şablon kıyası (tür + kanal grubunda gönderim, cevap oranı, "erken" uyarısı, sektör dökümü, §2.15) · kaynak hunisi (§2.19) |
| **Haftalık inceleme** | Bir ISO haftanın özeti: giden/hedef, dönüş oranı, görüşme, teklif, yeni kayıt, şablon ve kaynak öne çıkanları, limit aşımı, gelecek hafta için öneriler ("Göreve çevir"); önceki/sonraki hafta okları (`GET /api/review?week=`, §2.20) |
| Kayıt sayfaları | Kişi, firma, fırsat, proje detay ve formlar; her birinde yorum paneli (ekran sayısına dahil değil ama gerekli) |

Sidebar: **Network** bölümü önde (Bugün, Kişiler, Referanslar, Taslaklar, Yorumlar), **Pazarlama** (Paket 2: Paylaşımlar, Fikirler, Şablonlar), **Satış ve projeler** geride (Satış hunisi, Projeler, Zaman çizelgesi, Rapor, Haftalık inceleme), en altta Ayarlar (network süreleri, takip dizisi günleri, haftalık hedef). Mobilde soldan açılan çekmece.

Kişi kartı (Paket 2): kaynak paylaşım, anlatılan fikirler (ilgi seviyesiyle), "Taslak yaz". Kişi formunda "Kaynak paylaşım", temas formunda "Fikir" seçimi.

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
| `today()` | Bugün ekranının özeti: cevapsız yorum, cevap bekleyen kişiler, takipler, soğuyanlar, taslaklar, görevler, ödemeler, haftalık sayılar | kısa bölümler, her biri en fazla 10 satır |
| `find(type, q?, filter?, limit?)` | Kişi, firma, fırsat, proje, görev, taslak, ödeme, kaynak, temas, yorum, sektör, not, ayar listeler. `filter` örn. `{stage:"teklif"}`, `{tag:"ajans"}`, `{sector:"Sağlık"}`, `{awaiting:true}`, `{cooling:true}`, `{channel:"linkedin"}`, `{overdue:true}`, `{unanswered:true}` (yorum) | satır başına bir kayıt |
| `get(type, id, with?)` | Tek kaydın tamamı; `with: ["touches","tasks","payments","comments","notes","channels"]` ile ilgili kayıtlar. Kişide son temas, cevap bekleme ve referans değeri satırı her zaman gelir. `type: "comment"` tüm konuyu verir | kompakt blok |
| `save(type, data, id?)` | Oluştur ya da güncelle (kişi, firma, kaynak, sektör, not, fırsat alanları, proje alanları, görev, ödeme planı, ayar, **yorum**, temasın `expects_reply`/özet alanları). Aşama değişikliği burada yapılmaz. Kişi: `sector: "Sağlık > Diş hekimi"`. Not: `{person, body}`. Yorum: yeni konu `{target_type, target_id, body}`, cevap `{reply_to, body}`, kapatma `id + {resolved:true}` | `ok kişi #12` |
| `move(type, id, stage, reason?)` | Fırsat ya da proje aşaması değiştirir, kuralları çalıştırır | yan etkiler |
| `touch(person, channel, direction, summary, opp?, project?, at?)` | Temas kaydı | `ok temas #40 · fırsat #7 → cevap` |
| `draft(person, channel, body, reason?, opp?, project?)` | Onaya taslak bırakır; `reason` neden hazırlandığını söyler | `ok taslak #9 onay bekliyor` |
| `pay(payment_id, amount, date?)` | Ödeme girer | `ok ödeme #5 · 15.000/15.000 ödendi` |
| `timeline(type, id, limit?)` | Kişi/proje/fırsat olayları | `09.10 Claude · Taslak hazırlandı` |
| `report(month?, week?)` | `week` verilirse haftalık inceleme (§2.20); yoksa haftalık temas sayıları + referans değeri (ilk 5) + kaynak hunisi (tek satır, §2.19) + kaynak dönüşümü + aylık gelir vs. taban | küçük tablo |
| `delete(type, id)` | Silme (aynı kurallarla, olay yazar) | `ok` |

Paket 1 araç sayısını artırmadı (11): sektör ve not `save`/`find` ile, network listeleri `today` ve `find("person", {awaiting|cooling})` ile gelir.

Paket 2 de araç sayısını artırmadı (11):

- Yeni türler `post`, `template`, `idea`, `interest` (fikir ↔ kişi ilgisi) `find`/`get`/`save`/`delete` ile. Filtreler: `post {refresh_due, platform}`, `template {channel, sector, kind}`, `idea {stage, sector}`, `interest {idea_id, person_id}`.
- `save("post", {refreshed:true}, id)` = güncelledim. Kişinin kaynağı: `save("person", {post: "başlık"})`. Fikir: `save("idea", {title, problem, sectors:["Sağlık > Diş hekimi"]})`, ilgi: `save("interest", {idea, person, interest:"ilgilendi"})`. `move("idea", id, "demo")`.
- `touch(..., idea)` fikri anlatılan teması kaydeder; `draft(person, channel, template?, body?)` şablonla taslak (body boşsa şablon kişiye uygulanır).
- `today()` önce zamanı gelen takip taslaklarını hazırlar (kural 15), çıktıda "Otomatik takip taslağı hazırlandı", "Takip zamanı", "Güncellenecek paylaşım" bölümleri ve haftalık hedef görünür. Claude otomatik taslağı kişiye göre `save("draft", {body}, id)` ile düzeltebilir.
- `report()` pazarlama satırları ekler: paylaşım getirisi, fikir ilgisi, şablon dönüşü, kanal dönüşü (30 gün, kişi bazında), takip zamanı gelen sayısı.

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
5. **Kim yaptı doğru yazılır**: MCP actor'üyle yapılan işlem `created_by = claude`, girdide `created_by: "owner"` gönderilse bile.
6. **Fiyat tabanı ve aylık rapor**: verilen ayar değerleri ve ödemelerle taban, tahsilat ve fark doğru hesaplanır; kısmi ödeme ödendiği aya sayılır.
7. **Kaynak dönüşüm oranı**: kaynak başına kazanılan / kapanan (kazanılan + kaybedilen) doğru; açık fırsatlar paydaya girmez.

8. **Peşinat bloğu**: peşinat ödenmeden proje `pesinat`tan ileri geçemez, ödenince geçer.
9. **Yorum konuları**: Özgür'ün yorumu cevapsız listesine girer, Claude cevap yazınca ya da konu kapanınca düşer; yorumu sadece yazarı düzenler.

Paket 1 (network çekirdek kuralları):

10. **Sektör iki seviye**: yol ile açılan sektör iki seviye olur, üçüncü seviye ve döngü reddedilir; ana sektör filtresi alt sektördeki kişileri de getirir.
11. **Cevap bekleyen ve soğuyan**: fırsatsız giden mesaj kişiyi cevap bekleyenlere sokar (kanal ve gün doğru), gelen temas düşürür; eski temaslı bağlantı soğuyanlarda görünür, takip tarihi ya da yeni temas düşürür.
12. **Referans değeri**: tanıttığı kişilerin (alt ağaç dahil) fırsatları sayılır; kazanılan tutar ve açık tutar doğru.

Paket 2 (pazarlama çekirdek kuralları):

13. **Takip dizisi**: ayar süreleri uygulanır; 3. gün 1. takip taslağı (Claude adına, nedenli, şablon yoksa varsayılan metin), bekleyen taslak varken ikinci kez üretilmez, gönderilince 7. gün 2. takip (uygun `takip` şablonuyla), reddedilen adım tekrar üretilmez, gelen temas diziyi durdurur, boş ayar kapatır.
14. **Paylaşım**: yenileme zamanı gelince Bugün'de görünür, "güncelledim" düşürür ve aralık sonra tekrar çıkar; paylaşımdan gelen kişinin fırsat ve kazanılan tutarı paylaşıma sayılır; paylaşım silinince kişi kalır.
15. **Fikir ve şablon**: fikir temasla anlatıldı olur, ilgi sayısı ve oranı doğru, ana sektör filtresi alt sektörleri kapsar, aşama olayı yazılır; şablon önerisi kanal ve sektör önceliğine uyar, şablonla açılan taslağın metni kişiye uygulanır.

Kendi projelerim (`packages/core/test/own-projects.test.ts`):

20. **Kendi projesi**: sektörle açılır, `sellable` varsayılanı `belki`, durum değişince olay yazılır, `status`, `sellable` ve `sector` filtreleri bulur.
21. **Fikir kapsamı**: proje fikri üst fikir almaz, alt fikri olan fikir projeye girmez, proje fikri üst fikir olamaz, genele dönünce `done_at` silinir, genel fikirde `priority` hata verir.
22. **Sıralama**: öncelik grubunda sıra 0..n, `position` ile sürükleme, öncelik değişince iki grup yeniden numaralanır, `done` gruptan çıkarır ve geri açınca sona koyar.
23. **Fikirden proje**: alt fikirler projeye taşınır, kaynak fikir çöpe gider (geri yüklenince alt fikirsiz genel fikir); proje silinince fikirleri genele döner, geri yüklenince yeniden bağlanır.

Fırsat detay sayfası (`packages/core/test/core.test.ts`):

24. **Teklif kabulü**: bir fırsatta tek kabul edilmiş teklif olur (yenisini kabul etmek eskisinin kabulünü temizler) ve kabul edilen teklifin tutarı fırsatın `estimated_value` alanına yazılır.
25. **Kazanınca ödeme planı**: fırsat kazanılınca proje fiyatı ve ödeme planı kabul edilen teklif tutarından çıkar (fırsat değeri sonradan elle değişmiş olsa bile).

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
| 9 | **Ürün yönü** (Paket 1) | Network + pazarlama önde; huni ve projeler yan özellik, menüde geride |
| 10 | **Notlar** | Yorumdan ayrı `notes` tablosu: kişi hakkında tarihli bilgi; yorumlar Özgür–Claude yazışması olarak kalır |
| 11 | **Sektör** | Ayrı `sectors` tablosu, iki seviye; etiketler (aday, müşteri…) ilişki türü olarak kalır |
| 12 | **Cevap bekleme** | Hesaplanır, saklanmaz; sadece temasta `expects_reply` bayrağı tutulur (teşekkür mesajı gibi cevap beklemeyen mesaj kapatılabilir) |
| 13 | **Soğuma eşiği** | 30 gün, cevap gecikmesi 3 gün; ikisi de Ayarlar'dan değişir |
| 15 | **Takip dizisi** (Paket 2) | Ayrı "dizi" tablosu yok; cevap bekleyen verisinden hesaplanır, taslakta `followup_step`. Süreler tek ayar (`followup_days`, varsayılan 3 ve 7 gün), her kanalda aynı. Sayım ilk cevapsız mesajdan |
| 16 | **Otomatik takip taslağının yazarı** | `claude`: ürün tanımı "Claude taslağı, Özgür onaylar". Sunucu zamanlayıcısı ve MCP `today()` üretir; girdi kimliği değil, sabit giriş noktası. Onay kuralı değişmedi |
| 17 | **Şablon yer tutucuları** | `{ad}` `{ad_soyad}` `{firma}` `{sektor}`; bilinmeyen olduğu gibi kalır. Şablon yoksa varsayılan takip metni |
| 18 | **Fikir ilgisi** | Kişi başına tek satır (`idea_people`), üç seviye; temasla otomatik "anlatıldı" |
| 19 | **Ek pazarlama özellikleri** | Haftalık giden mesaj hedefi, şablon dönüş oranı, kanal dönüş oranı (30 gün, kişi bazında), paylaşım getirisi sıralaması, fikre ve paylaşıma yorum (Claude ile konuşma) |
| 14 | **Sıkıştırma** | Web derlemesi `.br` ve `.gz` kopyalarını üretir; sunucu tarayıcı destekliyorsa hazır sıkıştırılmış dosyayı sunar (ek paket yok, çalışırken CPU harcamaz). API yanıtları küçük olduğu için sıkıştırılmaz |

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

`createCore(db, actor)`: core'u kimin adına çalıştığını bilerek kurar. NestJS `actor="owner"`, MCP `actor="claude"` ile çağırır.

Gerçekleşen yapı (`packages/core/src` altında): `constants.ts`, `dates.ts`, `context.ts` (hata sınıfı, olay yazımı, ham SQL yardımcıları), `db/` (şema, client, `migrations/`), `schemas/index.ts` (Zod), `services/` (people, companies, opportunities, projects, payments, touches, drafts, tasks, comments, settings, queries, reports, today, records, shared), `index.ts` (`createCore`). Tablolar: 15 (companies, people, person_tags, sources, opportunities, touches, drafts, projects, payments, tasks, comments, events, settings + Paket 1: sectors, notes). Paket 1 servisleri: `services/network.ts` (cevap bekleyen, soğuyan, kişi kartı, haftalık sayılar, referans değeri), `services/sectors.ts`, `services/notes.ts`. Migration'lar: `0000` ilk şema, `0001_burly_bucky` (taslak `reason`, ön yüz thread'i), `0002_paket1_network` (sectors, notes, people.instagram/linkedin/sector_id, touches.expects_reply; mevcut giden mesajlar cevap bekliyor sayılır). Haftalık sayılar (`today.week`), taslak nedeni, yorumların mesajlarla tek istekte gelmesi, gzip/br ve günlük yedek ön yüz thread'inde yapıldı; Paket 1 bunları genişletti (kanal kırılımı, yeni kişi).

### Uygulama notları (arka uç)

- İsim girdisi: MCP/core `person`, `company`, `source`, `opp`, `project`, `referred_by` alanlarını isimle kabul eder; tek eşleşme yoksa kısa aday listesiyle hata verir. Aramada büyük/küçük harf, Türkçe karakter ve aksan fark etmez.
- Tarihler: ISO ya da `bugün`, `yarın`, `dün`, `+3g`, `+1h` (hafta).
- Temas fırsat vermeden girilirse ve kişinin tam bir açık fırsatı varsa ona bağlanır.
- Ödeme: `pay` tutarı ödenene **ekler**; kalan tutardan fazlası reddedilir. `paid_at` son ödemenin tarihidir. Aylık tahsilat `payment.paid` olaylarından okunur, yani her kısmi ödeme kendi ayına yazılır. Elle düzeltme (`paid_amount`/`paid_at`) eski kayıtları ters çeviren bir `payment.corrected` olayı yazar, rapor da düzelir.
- Ödeme planı şablonu `settings.payment_template` (JSON) ile değişir; varsayılan peşinat %40 (bugün), tasarım onayı %30 (+14 gün), yayın %30 (+30 gün). Fiyat girilmemiş fırsat kazanılırsa proje açılır ama plan çıkmaz; fiyat sonradan girilince plan üretilir. Peşinat ödemesi planlanmamış projede de ilerleme bloklanır.
- Silme: bağlı fırsat/proje/ödeme varsa reddedilir; hafif bağlantılar (etiket, temas, görev, yorum) kişiyle birlikte gider. Her silme olay yazar; olaylar silinen kayıttan sonra da kalır.
- Yorum silme: Claude sadece kendi yorumunu (ve sadece kendi cevapları olan kökü) silebilir; Özgür her yorumu silebilir. Kapalı konuya cevap yazılınca `comment.reopened` olayı yazılır.
- Bağlantı tutarlılığı: temas, taslak ve projede verilen fırsat/proje aynı kişiye ait olmalı. Proje hakkındaki temas (project verilmiş) kişinin açık fırsatına otomatik bağlanmaz, satış aşamasını ilerletmez. Referans ağacında döngü kurulamaz.
- Web sunucusu: `FF_PASSWORD` tanımlıysa `0.0.0.0` dinler. Yoksa ilk açılışta panel şifre sorar (`data/auth.json`, scrypt özeti); bu şifreyle `127.0.0.1` dinler, `phone_access` ayarı açıksa `0.0.0.0`. Şifre yokken yalnız `127.0.0.1` ve yalnız kurulum ucu açıktır. Ayarlar kök `.env` dosyasından okunur.

---

## 9. Yapım sırası (2-3 saat hedefi)

1. İskelet: workspaces, core şema + migration, `createCore`. ✅ yapıldı
2. Core servisleri + testler (8 + yorum). ✅ yapıldı
3. NestJS controller'ları + MCP araçları (ikisi de ince katman). ✅ yapıldı
4. Artboard'da tasarım sistemi ve ekranlar (paralel ya da önce). 
5. Web ekranları: Bugün, Huni, Proje panosu, Zaman çizelgesi, Rapor, kayıt formları. (~60 dk)
6. Elle uçtan uca deneme: kişi → fırsat → taslak → temas → kazanıldı → ödeme → rapor.
7. Paket 1 network paneli: sektör, not, cevap bekleme, soğuma, kişi kartı, haftalık sayılar, referans değeri, menü sırası, API eksikleri. ✅ yapıldı
8. Paket 2 pazarlama: paylaşımlar, takip dizisi, şablonlar, fikirler, haftalık hedef, pazarlama raporu (§11). ✅ yapıldı (Linux'ta derleme + 15 test; Windows doğrulaması ayrı)

---

## 10. Paket 1 uç noktaları ve Paket 2 hazırlığı

Yeni REST uçları (Paket 1):

| Uç | Ne verir |
|---|---|
| `GET /api/people/:id/card` | Kişi kartı tek istekte: kişi, sektör yolu, kanal özeti, temaslar (son 200), notlar, yorum konuları mesajlarıyla, referans eden, tanıttıkları, referans değeri, fırsat/proje/bekleyen taslak, cevap bekleme durumu |
| `GET /api/people?awaiting=true` / `?cooling=true` / `?sector=3` / `?channel=linkedin` | Network filtreleri; her satırda `last_touch_at`, `last_channel`, `awaiting` |
| `GET /api/network` | Bugün'ün network bölümleri: cevap bekleyenler, soğuyanlar |
| `GET /api/stats/week` | Bu hafta ve geçen hafta: giden, gelen (dönüş), dönüş oranı, görüşme, yeni kişi, açık/sessiz teklif, kanal kırılımı |
| `GET /api/report/referrals` | Referans değeri listesi |
| `GET/POST/PATCH/DELETE /api/sectors` | Sektör listesi (ağaç için `parent_id`, `people_count`) |
| `GET/POST/DELETE /api/notes` (`?person_id=`) | Notlar |
| `PATCH /api/touches/:id` | Temasın özet, sonuç, kanal, tarih ve `expects_reply` alanları |
| `GET /api/comments?messages=true` | Konular mesajlarıyla tek istekte |

Paket 2 bu şemaya ekledi, mevcut alanları değiştirmedi (§11).

---

## 11. Paket 2: pazarlama (2026-10-09)

Migration `0003_paket2_marketing`: tablolar `posts`, `templates`, `ideas`, `idea_sectors`, `idea_people`; sütunlar `people.post_id`, `touches.idea_id`, `drafts.template_id`, `drafts.followup_step`. Var olan veriye dokunmaz.

Core servisleri: `services/posts.ts` (yenileme, getiri), `services/templates.ts` (yer tutucu, öneri, başarı), `services/ideas.ts` (fikir, sektör, ilgi), `services/followups.ts` (takip dizisi: zamanı gelenler, taslak üretimi), `services/marketing.ts` (pazarlama özeti, kanal dönüşü). `createCore` yeni alanlar: `posts`, `templates`, `ideas`, `followups.due()/generate()`, `marketing()`. Yorum hedeflerine `post` ve `idea` eklendi.

REST uçları:

| Uç | Ne verir |
|---|---|
| `GET/POST /api/posts`, `PATCH/DELETE /api/posts/:id`, `POST /api/posts/:id/refresh` | Paylaşımlar (`?platform=`, `?refresh_due=true`); her satırda `people_count`, `opp_count`, `won`, `won_value`, `next_refresh_at`, `refresh_due`. `GET /api/posts/:id?with=people` |
| `GET/POST /api/templates`, `PATCH/DELETE /api/templates/:id` | Şablonlar (`?kind=&channel=&sector=`); `used`, `sent`, `replied`, `reply_rate`, `early` |
| `GET /api/templates/suggest?person_id=&channel=&kind=` | Kişi ve kanala uyan şablonlar, en uygun önce |
| `GET /api/templates/:id/render?person_id=` | Şablonun kişiye uygulanmış metni |
| `GET/POST /api/ideas`, `PATCH/DELETE /api/ideas/:id` | Fikirler (`?stage=&sector=`); `told`, `interested`, `interest_rate`, `sectors`, `touch_count`, `post_count`. Girdi: `sector_ids` ya da `sectors: ["Ana > Alt"]` |
| `GET /api/ideas/people?idea_id=&person_id=` · `POST /api/ideas/:id/people` · `PATCH/DELETE /api/ideas/people/:linkId` | Fikir ↔ kişi ilgisi |
| `GET /api/followups` · `POST /api/followups/run` | Takip zamanı gelenler · şimdi hazırla (zamanlayıcının işini hemen yapar) |
| `GET /api/report/marketing` | Paylaşım getirisi, güncellenecekler, fikir ilgisi, şablon kıyası (`template_groups`: tür + kanal grupları; şablonda `sent`, `replied`, `reply_rate`, `early`, `leader`, `sectors`), kanal dönüşü (30 gün), takip zamanı gelenler |
| `GET /api/today` | ek bölümler: `posts_due`, `followups`; `quota` (`{date, channels:[{channel,sent,limit,state}], email_warmup:{until,active}}`); `network.settings` içinde `followup_days`, `weekly_target`, `channel_limits`, `email_warmup_until` |
| `POST /api/drafts` | `template_id` ile (metin boşsa şablondan doldurulur) |
| `PUT /api/settings` | `followup_days` ("3,7" ya da dizi), `weekly_target`, `channel_limits` (`{"email":20}`), `email_warmup_until` (ISO tarih ya da boş) |

Web: sidebar "Pazarlama" bölümü (Paylaşımlar `/paylasimlar`, Fikirler `/fikirler`, Şablonlar `/sablonlar`), Bugün'de "Takip zamanı", "Güncellenecek paylaşımlar" ve "Günlük kota" kartları ve haftalık hedef, Taslaklar'da otomatik takip çipi ve "Taslak yaz" formu (şablon önerili), kişi kartında kaynak paylaşım ve fikirler, kişi formunda kaynak paylaşım, temas formunda fikir, Ayarlar'da takip günleri, haftalık hedef, kanal limitleri ve ısınma bitişi. MCP `today()` çıktısı tek satır `Kota: ...` ve ısınma sürerken `Soğuk e-posta kapalı (...)` satırı ekler.

## 12. Paket 3: firma, etiket, mükerrer kontrolü, çöp kutusu (2026-10-10)

Özgür'ün onayladığı 12 madde. CSV içe aktarma ekranı yok: toplu listeler Claude'a verilir, Claude MCP'den tek çağrıda ekler.

### 12.1 Veri modeli (migration 0004 + 0005)

- **companies** artık tam kayıt: `email`, `phone`, `instagram`, `linkedin`, `source_id`, `contact_status`, `notes`. Kişiler `company_id` ile firmaya bağlanır.
- **contact_status** (kişi ve firma): `yazilmadi → yazildi → cevap_geldi → gorusuldu`, ayrıca `olumsuz`. Temas kaydedilince core ileri taşır (giden mesaj: yazıldı, gelen: cevap geldi, arama/görüşme: görüşüldü), geri götürmez. `olumsuz` sadece elle verilir ve temasla değişmez. Kişiye yazılan temas kişinin firmasını da ilerletir. Migration mevcut temaslardan durumu doldurur.
- **tags** tablosu (ad, değişmeyen `slug`, renk, `deleted_at`). Varsayılanlar: Aday, Müşteri, Ajans, İş ortağı, Network, R10, Sıcak, Fuar. `person_tags` ve `company_tags` etiketi id ile tutar. Soğuma kuralı ve "kazanınca müşteri" etiketi `slug` ile çalışır; ad değişse de bozulmaz.
- **Çoklu sektör**: `person_sectors`, `company_sectors` (iki seviye kuralı aynı). `people.sector_id` kalktı, değeri `person_sectors`'a taşındı.
- **sources** = "nereden buldum" listesi (fırsatın kaynağıyla aynı tablo). Migration yoksa LinkedIn, Instagram, R10, Referans, Web sitesi, Fuar, Diğer ekler. Kişi ve firmada `source_id`.
- **Kategori soft delete**: `tags`, `sectors`, `sources` için `deleted_at`. Silinen kategori onu taşıyan kayıtlarda kalır (elle çıkarılana kadar), yeni kayda ya da yeni bağa seçilemez. Ana sektör silinince alt sektörleri de gizlenir; geri yüklenince birlikte döner.
- **touches / drafts**: muhatap üçünden biri: `person_id`, `company_id` (info@ gibi firmaya doğrudan) ya da sadece `contact` (kayıtsız adres/hesap). Adres zaten bir kişinin ya da firmanın e-postası/hesabıysa temas ona bağlanır. Sadece adresli temas, o adresle kişi ya da firma açılınca otomatik ona taşınır (`contact_key`).
- **opportunities**: `source_url` (ilanın ya da konunun linki) ve `source_date` (ilan tarihi).
- **trash** (çöp kutusu): silinen kayıt ve alt kayıtları (temaslar, notlar, taslaklar, görevler, yorumlar, bağlar) JSON olarak; boşaltılan bağlar (ör. tanıttığı kişilerin `referred_by_id`'si) de saklanır. Geri yükleme aynı id'lerle yerine koyar. `keys`: mükerrer kontrolü için anahtarlar.
- Mükerrer anahtar sütunları: kişide `email_key`, `instagram_key`, `linkedin_key`; firmada ayrıca `name_key`, `domain_key`. İndeksli; eski kayıtlarınki açılışta (`backfillKeys`) doldurulur.
- `openDb` migration'ları foreign key kapalıyken uygular, sonra `foreign_key_check` ile doğrular (tablo yeniden kurulumu için SQLite'ın önerdiği sıra).

### 12.2 Çekirdek kuralları

- **Mükerrer kontrolü core'da** (web ve MCP aynı kuralı alır): e-posta, web sitesinin alan adı, firma adı, LinkedIn ve Instagram tektir. Karşılaştırma büyük/küçük harf, boşluk, Türkçe karakter, `https://`, `www.`, sondaki `/` ve adres biçimi farkını yok sayar; firma adında noktalama ve sondaki şirket ekleri (Ltd, Şti, A.Ş. vb.) atılır. E-posta ve hesaplar kişi ile firma arasında da tektir. Ad soyad tekrar edebilir. Güncellemede sadece değişen anahtar kontrol edilir. Çakışma `FFError("duplicate")` ve `duplicate: {type, id, label, field, in_trash}` döner; HTTP 409.
- Çöp kutusundaki kaydın anahtarı da mükerrer sayılır (`in_trash: true`): yenisi açılmaz, geri yükleme önerilir. Geri yüklerken anahtar başka bir kayıtta kullanılıyorsa kayıt geri gelmez.
- **Silme her yerde çöp kutusuna** (kişi, firma, fırsat, proje, görev, temas, not, taslak, ödeme, yorum, paylaşım, şablon, fikir, fikir ilgisi). Eski kurallar aynı: fırsatı ya da projesi olan kişi, projesi olan fırsat, ödeme alınmış proje/ödeme, gönderilmiş taslak silinmez. Firma silinince çalışanları kalır, firma bağı boşalır (geri yüklenince döner).
- Şablon yer tutucuları firmada: `{ad}` ve `{firma}` firma adı, `{sektor}` firmanın ilk sektörü; kişinin sektörü yoksa firmasınınki kullanılır. Şablon önerisi muhatabın sektörlerinden en iyi eşleşeni seçer.
- **Takip dizisi** muhatap bazında: kişi, firma ya da sadece adres. Firmanın herhangi bir çalışanından gelen cevap firma dizisini de durdurur.
- **Toplu kayıt** `saveMany(type, items)`: tek transaction, her kayıt kendi savepoint'inde. Sonuç: `created`, `skipped` (mükerrer, hangi kayıtla çakıştığı), `failed`. Kişide `company: "ABC"` bulunamazsa firma açılır.

### 12.3 Uç noktalar

| Uç nokta | Ne yapar |
|---|---|
| `GET /api/companies?tag=&sector=&source=&status=&q=` | Firma listesi: kişi sayısı, son temas, temas sayısı, açık fırsat, etiket/sektör/kaynak |
| `GET /api/companies/:id/card` | Firma kartı: çalışanlar, firmaya ve çalışanlarına temaslar, kanallar, fırsatlar, bekleyen taslaklar, yorumlar |
| `GET /api/people?tag=&sector=&source=&status=` | Aynı filtreler kişide (etiket/sektör/kaynak id, slug ya da ad; virgülle çoklu) |
| `GET/POST /api/tags`, `PATCH/DELETE /api/tags/:id` | Etiketler (`?all=true` silinenler dahil) |
| `GET /api/sources?all=true`, `GET /api/sectors?all=true` | Silinenler dahil (kayıtlarda görünmeye devam ettikleri için) |
| `GET /api/trash` · `POST /api/trash/restore {type, id}` | Çöp kutusu (kayıtlar ve gizlenen kategoriler) · geri yükleme |
| `GET /api/touches?loose=true` · `?company_id=` | Sadece adresli temaslar · firmaya doğrudan temaslar |
| `POST /api/touches`, `POST /api/drafts` | `person_id` ya da `company_id` ya da `contact` |
| `GET /api/templates/suggest?company_id=` · `/:id/render?company_id=` | Firma için şablon önerisi ve önizleme |
| `GET /api/stats/activity?period=day\|week\|month` | Dashboard: son 14 gün / 8 hafta / 6 ay dilimleri (giden, dönüş, görüşme, yeni kişi/firma), son dilimin kanal kırılımı, kişi ve firma temas durumu dağılımı |
| `DELETE` uç noktaları | `{effects, trash: {type, id}}` döner (Geri al için) |

### 12.4 MCP (yeni araç yok, mevcutlar genişledi)

- `find`: `company`, `tag`, `trash` türleri; kişi ve firmada `{tag, sector, source, status}` filtreleri; temasta `{loose:true}`, `{company_id}`.
- `get company with: people, touches, opportunities, drafts, comments, channels`.
- `save`: `data` dizi ise toplu ekler; çıktı eklenen sayısı, atlanan mükerrerler (`[sıra] ad → kişi #4 Ali Veli (e-posta, çöp kutusunda)`) ve hatalar. Kişi/firma: `tags`, `add_tags`, `remove_tags` (ad ya da id), `sectors`, `source`, `contact_status`. `tag: {name, color}`. Fırsat: `source_url`, `source_date`.
- `touch` ve `draft`: `person` ya da `company` ya da `contact`.
- `delete`: çöp kutusuna gönderir; `restore: true` geri yükler (id ya da çöpteki ad).

### 12.5 Web

- Sidebar: "Bugün" → **Dashboard** (`/`), yeni **Firmalar** (`/firmalar/:id`).
- Firmalar sayfası: filtreler (durum, etiket, sektör, kaynak, arama), firma kartı (çalışanlar, temaslar, fırsatlar, yorumlar, "Firmaya temas", "Taslak yaz", "Kişi ekle"), "Sadece adresle yazılanlar" listesinde tek tıkla **Kişi yap / Firma yap**.
- Kişiler: aynı filtreler; kart başlığında durum, etiketler, sektörler, kaynak.
- Formlar (`forms/ContactForms.tsx`): kişi ve firma formunda etiket seçici (yeni etiket yazılabilir), çoklu sektör, nereden buldum, temas durumu. Temas formunda "Kime: Kişi / Firma / Sadece adres". Taslak formu firmaya yazabilir.
- Her kart türünde **Düzenle / Sil** (kişi, firma, fırsat, görev, temas, not, paylaşım, şablon, fikir). Silme onay sormaz; bildirimde **Geri al** çıkar. Mükerrer hatasında bildirimde **Kayda git** ya da (çöpteyse) **Geri yükle**.
- Fırsat formunda **Kaynak linki** ve **İlan tarihi**; huni kartında ve fırsat detayında tıklanır link olarak görünür. Fırsat düzenleme formu: başlık, tutar, kaynak, link, ilan tarihi, takip tarihi.
- **Satış hunisi telefonda**: yatay kaydırma yok, aşamalar alt alta bölümler halinde; kartın aşaması kart üzerindeki seçiciyle değişir (kaybedildi için neden sorulur). Masaüstünde sürükle bırak kanban aynı kalır.
- Ayarlar: **Etiketler** (ekle, yerinde ad değiştir, renk, sil), **Sektörler**, **Kaynaklar**, **Çöp kutusu** (geri yükle).
- Dashboard: **Günlük / Haftalık / Aylık** seçici (tercih tarayıcıda hatırlanır), özet kutuları (önceki dönemle fark, haftalık hedef), giden/dönüş çubuk grafiği ve kanal kırılımı, firma ve kişi temas durumu çubukları. Grafikler kütüphanesiz, sadece tasarım token'larıyla.

### 12.6 Testler (`packages/core/test/paket3.test.ts`, 16-19)

16. Mükerrer: e-posta, alan adı, firma adı, LinkedIn, Instagram normalize edilip tek; ad soyad tekrar edebilir; toplu eklemede mükerrerler atlanır ve raporlanır; çöpteki kayıt mükerrer sayılır.
17. Silme çöp kutusuna gider, geri yükleme alt kayıtları ve bağlarıyla aynı id'lerle getirir.
18. Etiket: eklenir, adı değişir (slug kalır), silinen kayıtta kalır ama yenisine seçilemez, geri yüklenince seçilir.
19. Firma: doğrudan ve çalışan temasları durumu ilerletir, `olumsuz` değişmez, adresli temas sonradan açılan kayda bağlanır, takip dizisi ve şablon firmada çalışır, filtreler çalışır, silinen kaynak seçilemez.

Test 10'a sektör soft delete kontrolü eklendi. Toplam 19 test.

## 12. Günlük iş planı (fikir #22)

- `daily_goals` (başlık, günlük sayı, tekrar günleri ISO "1,2,3,4,5", isteğe bağlı kanal, kalıcı not) ve `goal_logs` (hedef + gün başına elle sayı + gün notu).
- Kanalı olan hedefte o günkü giden mesaj temasları kendiliğinden sayılır; kalanı elle (+1, +5, sayı).
- **Yeni kayıt hedefi** (fikir #32, `daily_goals.metric = new_records`, migration `0017_goal_metric`, yeni sütun boş olabilir, veri değişmez): kanal yerine o gün oluşturulan kişi ve firmaları kendiliğinden sayar (silinenler çöp kutusuna gittiği için sayılmaz). Bir hedef ya kanaldan ya metrikten sayar, ikisinden birden değil (doğrulama hatası). Toplu eklemede (`saveMany`, MCP'ye verilen liste) mükerrer diye atlanan kişi ve firmalar toplu kayıt başına tek `bulk.skipped` olayı olarak yazılır: `data = {record_type, count, keys}` (`keys` atlanan kayıtların anahtarları, `email:a@b.com` biçimi). Hedef satırı o günün olaylarından toplayıp "12 eklendi · 3 mükerrer atlandı" gösterir (`GoalDay.duplicates`). Gerçek "Liste yenileme, 50, Perşembe" hedefini Özgür ekler: `save goal {title:"Liste yenileme", target:50, days:[4], metric:"new_records"}` ya da hedef formunda "Yeni kayıt" seçimi. Web: hedef formunda "Kendiliğinden say" seçimine "Yeni kayıt" eklendi, Günün planı ve Dashboard hedef şeridi mükerrer sayısını gösterir. MCP `plan` çıktısı `(12 eklendi, 3 mükerrer atlandı)` yazar.
- Seri (üst üste tamamlanan gün) ve haftalık oran core'da hesaplanır; görevler mevcut `tasks.due_date` ile takvimde görünür.
- Web: Dashboard üstünde Günün planı, `/takvim` hafta ve ay görünümü. MCP: `plan` aracı, `save goal`, `save goal_log`, `today` içinde plan.

## 13. Kendi projelerim (2026-10-10)

Özgür'ün kendi ürünleri (Full Follow gibi) müşteri projelerinden ayrı izlenir. Ayrıntılı plan: [plan-kendi-projelerim.md](plan-kendi-projelerim.md).

- **Ayrı tablo** `own_projects` (`name`, `description`, `status` aktif|beklemede|tamamlandi|birakildi, `sellable` evet|belki|hayir, `sellable_note`, `notes`) ve `own_project_sectors`. Müşteri `projects` tablosuna dokunulmaz: ciro, ödeme ve "kazanıldı" kuralları değişmez.
- **Fikirler tek tabloda**: `ideas.own_project_id` kapsamı belirler; `priority`, `position`, `done_at` proje fikrinde anlamlıdır. Sıralama satış hunisiyle aynı yardımcıyı kullanır (`placeInGroup`, `renumberGroup`).
- **Kurallar** (core): proje fikri üst fikir almaz, alt fikri olan fikir projeye girmez, `priority/position/done` sadece proje fikrinde; kapsam değişince `idea.moved`, yapılınca `idea.done` olayı.
- **Projeye dönüştür** (`save own_project {from_idea}` ya da `POST /api/own-projects/from-idea/:id`): fikir proje olur, alt fikirleri projenin fikirleri olur, kaynak fikir çöp kutusuna gider. Proje silinince fikirleri genele döner, geri yüklenince bağlanır.
- **REST**: `/api/own-projects` (liste, detay `?with=ideas,links,comments`, ekle, düzenle, sil, `from-idea/:id`). **MCP**: yeni araç yok; `find|get|save|move|delete` `own_project` türünü tanır.
- **Web**: `/projelerim` (Kendi projelerim) liste + detay, öncelik gruplu fikirler (masaüstünde sürükle, telefonda yukarı/aşağı), `Yapılanlar`. `/fikirler` artık "Para kazanma fikirleri".

## 14. Fırsat detay sayfası (2026-10-13)

Değerli bir fırsatın (ör. "Örnek Pizza") ekibi, teklif sürümleri, dosyaları ve değeri tek sayfada görünür. Eskiden fırsat sadece zaman çizelgesinde ve kanban kartı olarak vardı.

- **Yeni tablolar** (migration `0017_opportunity_page`, mevcut veriye dokunmaz):
  - `opportunity_people` (`opportunity_id`, `person_id`, `role` karar_verici|teknik|ortak|diger, `note`, `created_by`, zaman damgaları; çift tekil). Fırsatın `person_id` alanı ana muhatap olarak kalır, rolsüzdür ve bu tabloda yer almaz.
  - `offers` (`opportunity_id`, `version` fırsat başına 1'den artar, `offered_at`, `amount` TL, `items` JSON `[{label, amount}]`, `note`, `accepted_at`, `file_id`). Kısmi tekil indeks: fırsat başına en fazla bir kabul edilmiş teklif.
  - `files` (`target_type` opportunity|project, `target_id`, `name`, `mime`, `size`, `stored_name`). Baytlar diskte `data/files/<stored_name>` (veritabanı klasörünün yanında, `FF_DB` ile birlikte taşınır, git'e girmez). Silinen satır çöp kutusuna gider; `deleted_at` sütunu yok, baytlar diskte kalır ve geri yüklenince dosya yerine gelir.
- **Kurallar** (core):
  - Teklifi kabul etmek (`PATCH /api/offers/:id {accepted:true}`) diğerlerinin `accepted_at` alanını temizler, fırsatın `estimated_value` alanını teklif tutarına çeker, `offer.accepted` olayı yazar. Kabul edilmiş teklifin tutarı değişirse fırsat değeri de değişir. Kabulü geri almak (`accepted:false`) fırsat değerine dokunmaz.
  - Kabul edilmiş teklif silinince kabulü kalkar (çöp kutusundan kabulsüz döner).
  - Kazanınca açılan projenin fiyatı ve ödeme planı (`payment_template` yüzdeleri) kabul edilen teklifin tutarından çıkar; kabul yoksa eskisi gibi `estimated_value`.
  - Ekip: ekleme, rol/not değiştirme (aynı kişiyi tekrar eklemek rolünü günceller), çıkarma. Ana muhatap ekibe eklenmez. Olaylar: `opp.person_added|person_updated|person_removed`. Teklif olayları `offer.created|updated|accepted|unaccepted|deleted`, dosya olayları `file.uploaded|deleted`; hepsi ilgili fırsat zaman çizelgesinde görünür.
  - Fırsat, kişi ya da proje silinirken bu tabloların satırları aynı çöp kutusu kaydına girer ve geri yüklemede döner. Dosya silinirken ona bağlı tekliflerin `file_id` alanı boşaltılır, geri yüklenince yeniden bağlanır.
- **Dosya yükleme** (server): `POST /api/files` (multipart: `file`, `target_type`, `target_id`). Tür baytlardan anlaşılır (png, jpg, gif, webp, pdf; docx, pptx, xlsx zip imzası + uzantı; txt, md, csv metin denetimiyle), uzantıya güvenilmez. Resim en fazla 10 MB, dosya 25 MB (`FILE_LIMITS`). Ortak kısım `packages/server/src/upload.ts` (chat ekleri de aynı `sniff` ve `cleanName` işlevini kullanır). `GET /api/files/:id` indirir (`Content-Disposition`: resim ve PDF sekmede açılır, kalanı iner, `nosniff`).
- **Uç noktalar**: `GET /api/opportunities/:id?with=people,offers,files,links,tasks,touches,comments` (ekip ana muhatap hariç), `POST /api/opportunity-people` (`opportunity_id, person_id, role, note`), `PATCH|DELETE /api/opportunity-people/:id`, `POST /api/offers`, `PATCH|DELETE /api/offers/:id`, `POST /api/files`, `GET|DELETE /api/files/:id`.
- **MCP** (yeni araç yok, `offer` kayıt türü eklendi): `get opportunity with:['people','offers','files']` ekip, teklif sürümleri ve dosya listesini kısa satırlarla verir. Ekip yazımı `save opportunity {add_people:[{person:'Deniz Örnek', role:'karar_verici', note?}], remove_people:['Ali Örnek']}` ile (id ile güncellerken; isim ya da id kabul eder). Teklifler `offer` türüyle: `save offer {opportunity:'Örnek Pizza'|id, amount, offered_at?, items:[{label,amount}]?, note?}` sıradaki sürümü açar, `save offer {...} id` günceller, `save offer {accepted:true|false} id` aynı çekirdek kuralla kabul eder ya da kabulü geri alır (tek kabul, fırsat değeri teklif tutarına çekilir), `delete offer id` çöp kutusuna atar (`restore:true` ile döner), `find offer {opportunity_id}` kısa satırlar verir (`#2 v2 · 12.10 · 85.000₺ · kabul edildi · Örnek Pizza`). Dosya yazımı MCP'de yok, web'den yapılır.
- **Web**: `/firsatlar/:id` (Pipeline kartı, genel arama, Bugün, kişi ve firma kartları, zaman çizelgesindeki kişi kartı bu sayfaya açılır; `recordPath("opportunity")` de). Üstte özet kartı: tahmini değer (KDV hariç), kaynak ve ilan linki, tıklanır aşama çubuğu (telefonda yatay kayar, `kaybedildi` neden sorar, kazanılınca "Projeye git"), temas ekle. Sol sütunda Teklifler ve Akış (Hepsi, Temaslar, Yorumlar, Aşama süzgeçleri, yorum kutusu), sağ sütunda Sıradaki adım (takip tarihi gecikince vurgulu + en yakın açık görev), Ekip, Dosyalar, Linkler. Telefonda tek sütun: sıradaki adım, teklifler, ekip, dosyalar, linkler, akış. Akış, sıradaki adım ve "neden kaybedildi" sayfası zaman çizelgesi ve satış hunisinden çıkarılıp paylaşıldı (`components/Feed.tsx`, `NextStep.tsx`, `LostReason.tsx`); zaman çizelgesinde aşama olayları artık ayrı "Aşama" süzgecinde.
