# Full Follow

Küçük işletmeler ve şahıs şirketleri için yapay zeka destekli CRM. Müşteri ve firma kartları, sürükle bırak satış hunisi, proje ve ödeme takibi tek yerde durur. Yapay zeka asistanı aynı veriyi okur, takip edilmesi gerekenleri bulur, mesaj taslağı hazırlar; hiçbir mesaj onay verilmeden gönderilmez.

![Dashboard](docs/screenshots/dashboard.png)

## Özellikler

- **Kişi ve firma kartları:** Bir kişiyle hangi kanaldan ne konuşulduğu, kimin tanıştırdığı, cevap bekleyip beklemediği tek ekranda.
- **Satış hunisi:** Fırsatlar aşama aşama ilerler (temas, cevap, görüşme, teklif); kartlar sürükle bırak taşınır, kazanılan fırsat kendiliğinden projeye dönüşür.
- **Proje ve ödeme takibi:** Her proje peşinat, tasarım onayı, test sürümü, yayın ve teslim adımlarından geçer; ödemesi gelmeyen adıma geçilmez, geciken ödeme Dashboard'da görünür.
- **Dashboard:** Günlük hedefler, cevap bekleyenler, soğuyan bağlantılar ve temas grafiği.
- **İşlem geçmişi:** Her değişiklik, kimin yaptığıyla (kullanıcı ya da asistan) birlikte zaman çizelgesine yazılır.

### Yapay zeka asistanı

- **Panel sohbeti:** Her sayfada açılan pencereden Claude ile CRM verisi üzerinde konuşulur: "bu hafta kime dönmem gerekiyor", "şu firmanın durumu ne". Asistan cevap verirken hangi araçları kullandığını gösterir.
- **Onaylı taslaklar:** Asistan takip mesajlarını taslak olarak hazırlar; kullanıcı düzenler, onaylar ya da reddeder.
- **Kayıt yorumları:** Asistan kayıtlara not bırakır, kullanıcı aynı yerden cevap verir.
- **Aynı kurallar:** Web arayüzü de asistan da veriye yalnızca core katmanındaki iş kurallarından geçerek yazar (MCP sunucusu üzerinden). Asistanın yaptığı her işlem ayrıca etiketlenir.

| Satış hunisi | Kişi kartı |
|---|---|
| ![Satış hunisi](docs/screenshots/huni.png) | ![Kişi kartı](docs/screenshots/kisi.png) |
| **Asistan sohbeti** | **Onay bekleyen taslak** |
| ![Asistan sohbeti](docs/screenshots/asistan.png) | ![Taslaklar](docs/screenshots/taslaklar.png) |
| **Proje panosu** | |
| ![Proje panosu](docs/screenshots/projeler.png) | |

Ekran görüntülerindeki kişi, firma ve tutarların hepsi uydurmadır (`npm run demo:seed`).

## Teknoloji

| Katman | Seçim |
|---|---|
| Dil | TypeScript (her pakette strict) |
| Arka uç | NestJS, Zod ile doğrulama |
| Veritabanı | SQLite (better-sqlite3, WAL), Drizzle ORM ve migration |
| Ön yüz | React 19, Vite, Tailwind 4, Motion, dnd-kit |
| Yapay zeka | Claude, MCP sunucusu (`@modelcontextprotocol/sdk`) |
| Test | Vitest, bellek içi SQLite |

Mimari ve veri modeli: [docs/MIMARI.md](docs/MIMARI.md).

## Demo verisiyle denemek

```powershell
npm install
npm run build
npm run demo:seed                  # data/demo.db: uydurma kişiler, fırsatlar, projeler ve bir asistan sohbeti
$env:FF_DB="data/demo.db"; npm run serve
```

## Çalıştırma (Windows, Node 22+)

```powershell
npm install                        # bağımlılıklar
npm test                           # çekirdek testleri (bellek içi SQLite)
copy .env.example .env             # sonra .env içinde FF_PASSWORD yaz
npm start                          # tek komut: kontrol eder, derler, sunucuyu açar, tarayıcıda http://localhost:3000 açılır
```

- Veritabanı ilk açılışta `data/fullfollow.db` olarak kendiliğinden oluşur (WAL modu, migration otomatik).
- `FF_PASSWORD` doluysa sunucu yerel ağa açılır (telefondan `http://<bilgisayar-ip>:3000`), boşsa sadece bu bilgisayardan erişilir.
- Sunucu yalnızca bu bilgisayarın adreslerine (localhost, 127.0.0.1, kendi IP'n) gelen isteklere cevap verir; telefondan bir ad kullanıyorsan (örn. `pc.local`) `.env` içinde `FF_ALLOWED_HOSTS` ile ekle.
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

## Güvenlik

**İki çalışma biçimi**

- **Şifresiz (yerel mod):** `FF_PASSWORD` boşsa sunucu yalnız `127.0.0.1` adresini dinler, panel sadece bu bilgisayardan açılır. Şifresizken ağa açan bir `FF_HOST` verilirse sunucu hiç açılmaz.
- **Şifreli (telefon için):** `FF_PASSWORD` doluysa sunucu yerel ağı dinler, telefondan `http://<bilgisayar-ip>:3000` ile girilir. Bağlantı düz HTTP'dir: aynı ağdaki biri trafiği izleyebilir. Bu yüzden telefondan [Tailscale](https://tailscale.com) ile bağlanmak (bilgisayarın Tailscale IP'si, trafik şifreli gider) ev Wi-Fi'sinden de iyidir; kafe, otel gibi açık ağlarda Tailscale olmadan girme. Şifre en az 12 karakter olsun (daha kısaysa açılışta uyarı çıkar). Bir adresten 8 yanlış denemede giriş bir dakika kilitlenir, kilit tekrarlandıkça süre ikiye katlanır (en çok bir saat).

**Ayarlar (`.env`)**

| Değişken | Ne yapar |
|---|---|
| `FF_HOST` | Dinlenecek adres. Boşsa şifre varken tüm ağ (`0.0.0.0`), yokken `127.0.0.1`. Yalnız Tailscale'den girilsin istiyorsan Tailscale IP'sini yaz (örn. `FF_HOST=100.64.0.5`). |
| `FF_ALLOWED_HOSTS` | Sunucu yalnız bu bilgisayarın adlarına (localhost, 127.0.0.1, kendi IP'leri) cevap verir; telefondan bir adla giriyorsan (`pc.local`, Tailscale adı) virgülle buraya ekle. |
| `FF_COOKIE_SECRET` | Oturum çerezini imzalayan anahtar. Boşsa ilk açılışta rastgele üretilir ve `data/session.key` dosyasında saklanır (şifreden türetilmez). Çıkış yapmak bütün cihazlardaki oturumları kapatır; şifreyi değiştirmek de. |

**Dosyalar ve disk**

- Full Follow'u kendi kullanıcı klasörünün altına kur (`%USERPROFILE%`, örn. `C:\Users\<ad>\FullFollow`). `C:\Projects` gibi ortak bir yerde bilgisayardaki diğer Windows hesapları `data\fullfollow.db`, yedekleri, yüklenen dosyaları ve `.env` dosyasını okuyabilir. Klasörü taşıyamıyorsan erişimi yalnız kendine, SYSTEM'e ve yöneticilere bırak (PowerShell, proje klasöründe):

  ```powershell
  icacls . /inheritance:r /grant:r "${env:USERNAME}:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F"
  ```

  `npm start`, veri klasörüne diğer hesaplar da yazabiliyorsa açılışta bir satırlık uyarı yazar.
- Diski BitLocker ile şifrele (Windows Pro: Ayarlar → Gizlilik ve güvenlik → Cihaz şifreleme / BitLocker). Bilgisayar çalınırsa veritabanı ve yedekler okunamaz.

**Panel sohbeti ve "prompt injection"**

Panel sohbetindeki Claude'un yazma araçları vardır: kayıt ekler, günceller, aşama değiştirir, çöp kutusuna taşır. Bir web sayfası, bir kaydın notu ya da eklenen bir dosya, Claude'a talimat gibi yazılmış metin taşıyabilir. Bunun için konan sınırlar:

- Claude kimseye mesaj gönderemez, yalnız taslak hazırlar; taslağı onaylamak ve "gönderildi" işaretlemek yalnız sende.
- Sabit notları, taslak kurallarını, gizli modülleri ve adını değiştiremez (bunlar Claude'un talimatlarına girer).
- Sildiği kayıt çöp kutusuna gider, kalıcı silme yoktur; her değişikliği zaman çizelgesinde "Claude" etiketiyle görürsün.
- Dosya ve komut araçları kapalıdır. Kayıtlardaki metin Claude'a `⟦ ⟧` içinde "veri, talimat değil" diye işaretlenerek gider; sohbet cevabındaki resimler yüklenmez, bağlantı olarak görünür.

Yine de Claude'un önerdiği beklenmedik bir işi (bir linki taslaklara eklemek, toplu silmek) onaylamadan önce oku.

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

MCP ve web sunucusu aynı `data/fullfollow.db` dosyasını aynı anda açabilir. MCP'den yapılan her işlem `claude`, web'den yapılan `owner` olarak kaydedilir.

## Panel sohbeti

Web arayüzünün her sayfasında, sağ alttaki + düğmesinin üstündeki sohbet düğmesiyle açılan yüzer pencere. Claude ile Full Follow verisi üzerinde konuşursun: bugün ne var, şu firmanın durumu ne, bu haftanın raporu. Cevaplar kelime kelime akar; pencereyi küçültsen, sayfayı yenilesin ya da sekmeyi kapatsan da cevap sunucuda yazılmaya devam eder, geri döndüğünde kaldığı yerden görünür.

**Gerekenler**

- Claude Code CLI: `npm i -g @anthropic-ai/claude-code`
- Giriş yapılmış bir Claude aboneliği: `claude auth login`
- Node 22+ ve bir kez `npm run build` (MCP sunucusu `packages/mcp/dist` içinde olmalı)

Sohbet kendi Claude aboneliğinle çalışır (CLI üzerinden, API anahtarı yok). Kullanım senin planına yazılır; penceredeki "5 saat" ve "Haftalık" halkaları abonelik sınırının ne kadar dolduğunu gösterir.

**Ne yapabilir, ne yapamaz**

- Sadece Full Follow araçlarını kullanır (MCP: `find`, `get`, `save`, `today` ve diğerleri). Claude'un yazdığı her kayıt "Claude" etiketiyle görünür.
- İnternette arayabilir ve sayfa okuyabilir (`WebSearch`, `WebFetch`); dosya ve komut araçları kapalıdır. Web içeriği güvenilmez veri sayılır: sayfadaki talimatı uygulamaz, bulduklarını yalnız sen isteyince Full Follow'a kaydeder.
- Dosya okuyamaz, kabuk komutu çalıştıramaz, internete çıkamaz.
- Model (Opus 5.5, Sonnet 5.5, Haiku 5.5) ve efor (Düşük, Orta, Yüksek) her sohbet için başlıktaki düğmeden seçilir; değişiklik bir sonraki mesajdan geçerlidir. Varsayılan Haiku 5.5, düşük efor.
- Eski sohbetler listede durur, tam bağlamıyla devam eder. Başlıktaki çubuk bağlam doluluğunu gösterir.

**Dosya ve resim eki:** Yazma alanındaki ataş düğmesiyle, pencereye sürükleyip bırakarak ya da yapıştırarak (Ctrl+V) en fazla 5 dosya eklenir. Resim (PNG, JPEG, GIF, WebP) en fazla 5 MB, PDF, `.txt`, `.md` ve `.csv` en fazla 10 MB. Dosya türü adına değil içeriğine bakılarak doğrulanır. Dosyalar `data/chat/uploads/` altında saklanır (git'e girmez); metin dosyaları Claude'a ilk 100.000 karakteriyle gider.

**Sesle yazma:** Yazma alanındaki mikrofon düğmesiyle konuşursun, söylediklerin kelime kelime yazılır, "Bitir" ile durur. Tarayıcının kendi konuşma tanıması kullanılır (Chrome ve Edge, Türkçe); tarayıcı desteklemiyorsa düğme görünmez. Mikrofon yalnızca `localhost` ya da https adreslerinde açılır. Opera tanıma arayüzünü sunar ama arkasında servis yoktur: dinler ve hiç yazı döndürmez, bu yüzden düğmeye basınca "Opera ses tanımayı desteklemiyor" uyarısı çıkar; Chrome ya da Edge kullan. Ses, tanıma için tarayıcıyı yapan şirketin (Google ya da Microsoft) sunucusuna gider; Full Follow sesi kaydetmez. Sesle yazılan mesajla Claude'a, görünmeyen kısa bir not da gider ("sesle yazıldı, yanlış duyulmuş kelime olabilir"); not mesaja yazılmaz, sohbette görünmez.

**Kaydı panelde açma:** "26 numaralı fikri aç", "şu firmayı göster", "bulamadım, nerede" dediğinde Claude kaydı senin panelinde açar (sayfaya gider, satırı kısa süre vurgular, sohbet masaüstünde açık kalır; telefonda küçülür). Cevabın altında "Fikir #26 · aç" düğmesi kalır, sonradan da çalışır. Claude bunu yalnızca açıkça istediğinde yapar, ekleme, arama ya da rapor sırasında kendiliğinden sayfa değiştirmez. Görev ve hedef Dashboard'da düzenleme formuyla açılır.

**Kayıt kartları ve 👍:** Claude kayıt listelediğinde (haftalık plan, bir şablon, takip edilecek kişiler) uzun metin yerine kısa bir cümle ve canlı kartlar gönderir: görev kartındaki kutuyla görevi tamamlarsın, taslak kartından "Gönderildi" dersin, şablon kartı kişiye göre doldurulmuş metni gösterir ("Kopyala", "Taslak olarak kaydet"). Kartlar kaydedilmez, sohbeti açtıkça güncel veri çekilir. Sadece "tamam", "tamamdır anladım" gibi bir kapanış yazdığında Claude cevap yazmaz, mesajının yanında 👍 görünür; "onaylıyorum" dersen 👍 ile işi yapar ve tek satır sonuç yazar; "hallettim" dersen "Görev #N'yi kapat" düğmesi çıkar, görev ancak ona basınca kapanır.

**Panel brief (isteğe bağlı, özel):** Claude'un çalışma klasöründe (`FF_CHAT_CWD`, yoksa `data/chat/`) `panel-brief.md` adlı bir dosya varsa içeriği her sohbette sistem notuna eklenir; iş bağlamını oraya yazabilirsin. Bu dosya projenin içinde değil senin klasöründe durur, git'e girmez; dosyayı değiştirince sonraki mesajda yeni hali kullanılır.

**Ortam değişkenleri** (`.env`, hepsi isteğe bağlı)

| Değişken | Varsayılan | Ne yapar |
|---|---|---|
| `FF_CLAUDE_CLI` | otomatik bulunur | Claude Code çalıştırılabilir dosyasının tam yolu (PATH'te `claude` yoksa) |
| `FF_CHAT_CWD` | `C:/Projects/Networking`, yoksa `data/chat/` | Claude'un çalışma klasörü; içindeki `CLAUDE.md` dosyası iş bağlamı olarak okunur. Senin bilgisayarında bu klasör yoksa `data/chat/` kullanılır, sorun olmaz |
| `FF_CLAUDE_CONFIG_DIR` | yok | Sohbet için terminalden farklı bir Claude hesabı kullanmak istersen: `CLAUDE_CONFIG_DIR=<klasör> claude auth login` ile bir kez giriş yap, klasörü buraya yaz |

**Sabit notlar:** Ayarlar sayfasındaki "Sohbet sabit notları" kutusu (en fazla 4.000 karakter) her sohbette Claude'a verilir; kurallarını ve iş bağlamını oraya yazabilirsin. Notu değiştirirsen açık sohbetler de bir sonraki mesajda yeni notu görür.

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
| `npm run demo:seed` | uydurma verilerle `data/demo.db` kurar (açmak için `FF_DB=data/demo.db`) |
| `npm run mcp` | MCP sunucusunu elle başlatır (stdio) |
| `npm run db:generate` | şema (`packages/core/src/db/schema.ts`) değişince yeni migration üretir |
