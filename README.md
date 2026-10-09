# Full Follow

Müşteri bulmaktan işin teslimine kadar her şeyi tek sistemde tutan kişisel CRM. Plan: [docs/MIMARI.md](docs/MIMARI.md).

Durum: arka uç hazır (core + testler, NestJS API, MCP sunucusu). Web arayüzü (`packages/web`) tasarım bitince eklenecek.

## Çalıştırma (Windows, Node 22+)

```powershell
npm install                        # bağımlılıklar
npm test                           # 9 çekirdek test (bellek içi SQLite)
copy .env.example .env             # sonra .env içinde FF_PASSWORD yaz
npm start                          # derler ve sunucuyu başlatır: http://localhost:3000
```

- Veritabanı ilk açılışta `data/fullfollow.db` olarak kendiliğinden oluşur (WAL modu, migration otomatik).
- `FF_PASSWORD` doluysa sunucu yerel ağa açılır (telefondan `http://<bilgisayar-ip>:3000`), boşsa sadece bu bilgisayardan erişilir.
- Hızlı kontrol: tarayıcıda `http://localhost:3000/api/health` → `{"ok":true}`.

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

MCP ve web sunucusu aynı `data/fullfollow.db` dosyasını aynı anda açabilir. MCP'den yapılan her işlem `claude`, web'den yapılan `ozgur` olarak kaydedilir.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run build` | core + server + mcp derler |
| `npm test` | core testleri |
| `npm start` | derler + web/API sunucusu |
| `npm run mcp` | MCP sunucusunu elle başlatır (stdio) |
| `npm run db:generate` | şema (`packages/core/src/db/schema.ts`) değişince yeni migration üretir |
