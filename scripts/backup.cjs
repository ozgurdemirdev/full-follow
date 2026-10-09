// Veritabanını elle yedekler: npm run backup  (önce npm run build)
const { backupDb, loadRootEnv } = require("../packages/core/dist/index.js");
loadRootEnv();
backupDb(undefined, Number(process.env.FF_BACKUP_KEEP || 14))
  .then((f) => console.log(f ? `yedek: ${f}` : "bugünün yedeği zaten var (data/backups)"))
  .catch((e) => { console.error("yedek alınamadı:", e.message); process.exit(1); });
