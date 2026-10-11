# Full Follow

Müşteri bulmaktan işin teslimine kadar her şeyi tek sistemde tutan kişisel CRM. Plan: [docs/MIMARI.md](docs/MIMARI.md).

Durum: arka uç (core + testler, NestJS API, MCP), web arayüzü (`packages/web`) ve panel sohbeti hazır.

## Çalıştırma (Windows, Node 22+)

```powershell
npm install                        # bağımlılıklar
npm test                           # 9 çekirdek test (bellek içi SQLite)
copy .env.example .env             # sonra .env içinde FF_PASSWORD yaz
npm start                          # tek komut: kontrol eder, derler, sunucuyu açar, tarayıcıda http://localhost:3000 açılır
```

- Veritabanı ilk açılışta `data/fullfollow.db` olarak kendiliğinden oluşur (WAL modu, migration otomatik).
- `FF_PASSWORD` doluysa sunucu yerel ağa açılır (telefondan `http://<bilgisayar-ip>:3000`), boşsa sadece bu bilgisayardan erişilir.
- Hızlı kontrol: tarayıcıda `http://localhost:3000/api/health` → `{"ok":true}`.
- `npm start` her adımı yazar (Arka uç derleniyor… tamam). Bir şey ters giderse sebebini ve ne yapılacağını kırmızıyla yazar; tüm çıktı `data/son-calistirma.log` dosyasında kalır.
- Derlemeden hızlı açmak için: `npm run serve` (kod değişmediyse).
- `better-sqlite3` bilerek `~12.11` sürümünde tutulur: 13.x'in Windows modülü Node 22.13'te hata yazmadan çöküyor (sunucu "başlıyor" deyip kapanıyordu). Yükseltmeden önce `npm start` ile dene.

### Her gün kullanım (canlı)

- **Pencereli başlat:** `scripts\windows\baslat.cmd` dosyasına çift tıkla.
- **Arka planda ve bilgisayar açılınca:** `Win+R` → `shell:startup` → açılan klasöre `scripts\windows\arka-planda-baslat.vbs` dosyasının kısayolunu koy. Sunucu pencere açmadan çalışır, kayıtlar `data\server.log` dosyasına yazılır. Durdurmak için Görev Yöneticisi'nde `node` işlemini kapat.
- **Telefondan:** `.env` içinde `FF_PASSWORD` doluysa aynı Wi-Fi'deki telefondan `http://<bilgisayar-ip>:3000` (başlangıçta konsolda yazar). Windows Güvenlik Duvarı ilk açılışta izin sorarsa "Özel ağlar"a izin ver.
- **Güncelleme sonrası:** `npm install` ve `npm start`. Veritabanı değişiklikleri (migration) açılışta kendiliğinden uygulanır.

### Yedek

- Sunucu her gün ilk açılışta ve açık kaldıkça 6 saatte bir kontrol edip `data/backups/fullfollow-YYYY-MM-DD.db` yedeğini alır, son 14 günü tutar (`.env`: `FF_BACKUP_KEEP`, kapatmak için `FF_BACKUP=0`).
- Elle yedek: `npm run backup`.
- Geri dönmek için: sunucuyu ve Claude'u kapat, istediğin yedeği `data/fullfollow.db` üzerine kopyala, `data/fullfollow.db-wal` ve `-shm` dosyalarını sil, sunucuyu aç.
- `data/` klasörü git'e girmez; yedekleri ayrıca bulut klasörüne (OneDrive vb.) kopyalamak iyi olur.

## MCP (Claude'un erişimi)

Önce bir kez `npm run build`. Sonra:

**Claude Code**

```powershell
claude mcp add full-follow -- node C:\Projects\WebProjects\FullFollow\packages\mcp\dist\index.js
```

**Claude Desktop** (`claude_desktop_config.json` → `mcpServers`)

```json
{
  "mcpServers": {
    "full-follow": {
      "command": "node",
      "args": ["C:\\Projects\\WebProjects\\FullFollow\\packages\\mcp\\dist\\index.js"]
    }
  }
}
```

Claude Desktop'u yeniden başlat. Kontrol: Claude'a "Full Follow'da bugün ne var?" diye sor; `today` aracı çalışmalı. Web'de sol alttaki "Claude: …" yazısı Claude'un son işlemini gösterir.

MCP ve web sunucusu aynı `data/fullfollow.db` dosyasını aynı anda açabilir. MCP'den yapılan her işlem `claude`, web'den yapılan `ozgur` olarak kaydedilir.

## Panel sohbeti

Web arayüzünün her sayfasında, sağ alttaki + düğmesinin üstündeki sohbet düğmesiyle açılan yüzer pencere. Claude ile Full Follow verisi üzerinde konuşursun: bugün ne var, şu firmanın durumu ne, bu haftanın raporu. Cevaplar kelime kelime akar; pencereyi küçültsen, sayfayı yenilesin ya da sekmeyi kapatsan da cevap sunucuda yazılmaya devam eder, geri döndüğünde kaldığı yerden görünür.

**Gerekenler**

- Claude Code CLI: `npm i -g @anthropic-ai/claude-code`
- Giriş yapılmış bir Claude aboneliği: `claude auth login`
- Node 22+ ve bir kez `npm run build` (MCP sunucusu `packages/mcp/dist` içinde olmalı)

Sohbet kendi Claude aboneliğinle çalışır (CLI üzerinden, API anahtarı yok). Kullanım senin planına yazılır; penceredeki "5 saat" ve "Haftalık" halkaları abonelik sınırının ne kadar dolduğunu gösterir.

**Ne yapabilir, ne yapamaz**

- Sadece Full Follow araçlarını kullanır (MCP: `find`, `get`, `save`, `today` ve diğerleri). Claude'un yazdığı her kayıt "Claude" etiketiyle görünür.
- Dosya okuyamaz, kabuk komutu çalıştıramaz, internete çıkamaz.
- Model (Opus 5.5, Sonnet 5.5, Haiku 5.5) ve efor (Düşük, Orta, Yüksek) her sohbet için başlıktaki düğmeden seçilir; değişiklik bir sonraki mesajdan geçerlidir. Varsayılan Haiku 5.5, düşük efor.
- Eski sohbetler listede durur, tam bağlamıyla devam eder. Başlıktaki çubuk bağlam doluluğunu gösterir.

**Ortam değişkenleri** (`.env`, hepsi isteğe bağlı)

| Değişken | Varsayılan | Ne yapar |
|---|---|---|
| `FF_CLAUDE_CLI` | otomatik bulunur | Claude Code çalıştırılabilir dosyasının tam yolu (PATH'te `claude` yoksa) |
| `FF_CHAT_CWD` | `C:/Projects/Networking`, yoksa `data/chat/` | Claude'un çalışma klasörü; içindeki `CLAUDE.md` dosyası iş bağlamı olarak okunur. Senin bilgisayarında bu klasör yoksa `data/chat/` kullanılır, sorun olmaz |
| `FF_CLAUDE_CONFIG_DIR` | yok | Sohbet için terminalden farklı bir Claude hesabı kullanmak istersen: `CLAUDE_CONFIG_DIR=<klasör> claude auth login` ile bir kez giriş yap, klasörü buraya yaz |

**Sabit notlar:** Ayarlar sayfasındaki "Sohbet sabit notları" kutusu (en fazla 4.000 karakter) her yeni sohbette Claude'a verilir; kurallarını ve iş bağlamını oraya yazabilirsin. Eski sohbetler ilk açıldıkları notla devam eder.

**Sık görülen hatalar**

| Mesaj | Çözüm |
|---|---|
| Claude Code bulunamadı | `npm i -g @anthropic-ai/claude-code`, sonra sunucuyu yeniden başlat |
| Claude oturumu kapanmış | Terminalde `claude auth login`, sonra tekrar dene |
| Claude kullanım sınırına takıldın | Sınır yenilenince tekrar dene (halkalardaki "Yenilenme" saatine bak) |
| Full Follow MCP derlenmemiş | `npm run build` |
| Claude beklenmedik şekilde kapandı | Tekrar dene; sürerse sunucu günlüğüne (`data/son-calistirma.log`) bak |
| Sunucu yeniden başladı, bu cevap yarım kaldı | Sunucu cevap yazılırken kapandı; aynı sohbette devam edebilirsin |

Çalışma dosyaları (`mcp.json`, `system.md`) `data/chat/` içinde kendiliğinden oluşur ve git'e girmez.

## Ön yüz (packages/web)

- Tasarım tokenleri tek kaynaktan gelir: `packages/web/src/styles/tokens.json`. `npm run tokens -w @fullfollow/web` bundan `tokens.css` (Tailwind teması + CSS değişkenleri) ve `public/favicon.svg` üretir; build ve dev bunu kendiliğinden çalıştırır.
- Kodda sabit renk, px, ms yazmak yasak: `npm run check -w @fullfollow/web` bulursa build durur.
- Vite + React 19 (React Compiler) + Tailwind 4 + Motion + dnd-kit. Sayfalar ayrı parçalar halinde yüklenir.
- Derleme `.br` ve `.gz` kopyalarını da üretir; sunucu bunları hazır sıkıştırılmış gönderir. `/assets` dosyaları süresiz önbelleklenir, `index.html` her seferinde tazelenir.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run build` | core + server + mcp derler, ön yüzü (`packages/web`) `packages/web/dist` içine üretir |
| `npm run dev:web` | ön yüz geliştirme sunucusu (http://localhost:5173, `/api` isteklerini 3000'e yönlendirir; sunucu ayrıca `npm start` ile açık olmalı) |
| `npm test` | core testleri |
| `npm start` | kontrol + derleme + sunucu + tarayıcı (tek komut) |
| `npm run serve` | derlemeden sunucuyu açar |
| `npm run backup` | veritabanını `data/backups` içine yedekler |
| `npm run mcp` | MCP sunucusunu elle başlatır (stdio) |
| `npm run db:generate` | şema (`packages/core/src/db/schema.ts`) değişince yeni migration üretir |
