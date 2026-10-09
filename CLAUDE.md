# Full Follow

Müşteri bulmaktan işin teslimine kadar her şeyi tek sistemde tutan kişisel CRM. Özgür web arayüzünden, Claude MCP üzerinden aynı veritabanını kullanır. Ayrıntılı plan: [docs/MIMARI.md](docs/MIMARI.md).

## İletişim

- Özgür ile Türkçe konuş.
- Teknik kararları kendi önerinle ver, kısaca bildir; sadece kaçınılmazsa sor.

## Yığın

- TypeScript her yerde, npm workspaces.
- Arka uç: NestJS (Express adaptörü), sade tutulur (controller + DI).
- Veritabanı: SQLite, `better-sqlite3`, WAL modu. ORM: Drizzle + drizzle-kit. Doğrulama: Zod.
- MCP: `@modelcontextprotocol/sdk`, stdio, Özgür'ün bilgisayarında yerel çalışır.
- Ön yüz: Vite + React + Tailwind + Motion + dnd-kit. NestJS derlenmiş web dosyalarını da sunar.
- Test: Vitest, bellek içi SQLite.

## Klasör yapısı

```
packages/
├─ core/     db/ (şema, client, migration), schemas/ (Zod), services/, events.ts, index.ts → createCore(db, actor)
├─ server/   NestJS, kaynak başına bir controller
├─ mcp/      index.ts, tools.ts, format.ts (kısa çıktı)
└─ web/      Vite + React: app/, pages/, components/, api/, styles/
data/        fullfollow.db (git'e girmez)
docs/        MIMARI.md
```

## Altın kurallar

- **Tek giriş kapısı core.** Web (NestJS) ve MCP veritabanına doğrudan yazmaz, sadece core servislerini çağırır. İş kuralları (kazanıldı → proje aç, temas → aşama ilerlet, peşinat bloğu vb.) yalnızca core'da durur.
- **Her kayıtta `created_by`.** Değer giriş noktasından gelir: NestJS `actor="ozgur"`, MCP `actor="claude"`. Girdideki `created_by` asla kabul edilmez.
- **Olaylar core'da yazılır.** Her önemli değişiklik aynı transaction içinde `events` tablosuna satır ekler; elle olay eklenmez.
- **Yorumlar**: her kayda Özgür ve Claude yorum yazar (`comments` tablosu, konu = kök yorum + cevaplar). Cevapsız = açık konu ve son yorum Özgür'den; Claude bunları MCP'de `find("comment", {unanswered:true})` ya da `today()` ile görür ve `save("comment", {reply_to, body})` ile cevaplar.
- Tutarlar tam sayı TL, tarihler ISO metin.
- MCP araçları az ve genel, çıktılar kısa düz metin (token tasarrufu).

## Testler

- Sadece core'daki çekirdek kurallar için test yazılır (liste: docs/MIMARI.md §6, 9 test). Çalıştır: `npm test`.
- Gerisini Özgür elle test eder; gereksiz test yazma.

## Çalıştırma

`npm install`, `npm test`, `npm start` (ayrıntı: README.md). `.env` dosyası git'e girmez; örnek: `.env.example`.

## Tasarım

- Tasarım Claude artboard'unda (Artifacts) yapılır, Figma değil.
- Akıcı animasyonlar, özenli sidebar, mobil uyumlu, sade arayüz.
