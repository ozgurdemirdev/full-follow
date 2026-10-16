// Builds a demo database with made-up records for screenshots and trying the app:
//   npm run build && npm run demo:seed, then start the server with FF_DB=data/demo.db (see README)
// Every name, company and number here is fictional.
const fs = require("node:fs");
const path = require("node:path");
const { openDb } = require("../packages/core/dist/index.js");
const { createApp } = require("../packages/app/dist/index.js");

const TODAY = new Date().toISOString().slice(0, 10);
const file = process.env.FF_DEMO_DB ? path.resolve(process.env.FF_DEMO_DB) : path.resolve(__dirname, "../data/demo.db");
for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
fs.mkdirSync(path.dirname(file), { recursive: true });
const handle = openDb(file);

const shift = (days) => {
  const d = new Date(`${TODAY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
// The app (core plus installed modules) whose clock sits `days` from today, so history spreads over the past weeks.
// Today's records are stamped two hours ago, so the "last touched" labels never point into the future.
const at = (days, actor = "owner") => {
  const day = shift(days);
  const now = () => (days === 0 ? new Date(Date.now() - 2 * 3600e3).toISOString() : `${day}T09:30:00Z`);
  return createApp(handle, actor, { today: () => day, now });
};
// Day offset of this week's Monday, so the calendar week is full whatever day the seed runs on
const MONDAY = -((new Date(`${TODAY}T12:00:00Z`).getUTCDay() + 6) % 7);
const core = at(0);

// Default sources come with the migrations
const source = (name) => core.get("source", name).row.id;
const referral = source("Referans");
const linkedin = source("LinkedIn");
const website = source("Web sitesi");

const person = (company, name, role, extra = {}, days = -45) => at(days).save("person", { company, name, role, ...extra }).row;
const ali = person("Çelik Mali Müşavirlik", "Ali Çelik", "Mali müşavir", { tags: ["network"], phone: "0532 000 00 01" });
const elif = person("Yıldız Diş Kliniği", "Dr. Elif Yıldız", "Kurucu hekim", { referred_by_id: ali.id, email: "elif@yildiz-klinik.example" });
const murat = person("Karaca Mobilya", "Murat Karaca", "Genel müdür", { referred_by_id: ali.id });
const selin = person("Denizli Tekstil", "Selin Aydın", "İK müdürü", { linkedin: "linkedin.com/in/ornek-selin" });
const burak = person("Mavi Kafe", "Burak Şahin", "İşletme sahibi");
const canan = person("Atlas Lojistik", "Canan Öztürk", "Operasyon müdürü");
const hakan = person("Ege Emlak", "Hakan Demirtaş", "Kurucu");
const zeynep = person("Nova Spor Salonu", "Zeynep Kaya", "İşletme sahibi");
const deniz = person("Pera Butik", "Deniz Arslan", "E-ticaret sorumlusu");

const opp = (p, title, value, src, days) => at(days).mod("pipeline").opportunities.create({ title, person_id: p.id, source_id: src, estimated_value: value }).row;
const touch = (days, p, o, channel, direction, summary, kind = "mesaj") =>
  at(days).mod("network").touches.create({ person_id: p.id, opportunity_id: o?.id ?? null, channel, direction, kind, summary });
const move = (days, o, stage, reason) => at(days).mod("pipeline").opportunities.move(o.id, { stage, reason });

const clinic = opp(elif, "Randevu ve hasta takip uygulaması", 85000, referral, -24);
touch(-24, elif, clinic, "telefon", "giden", "Ali Bey'in tanıtmasıyla arandı, ihtiyacı dinlendi", "arama");
touch(-20, elif, clinic, "yuz_yuze", "giden", "Klinikte görüşme: randevu, hatırlatma SMS'i, hasta kartı", "gorusme");
move(-12, clinic, "teklif");
touch(-12, elif, clinic, "email", "giden", "Teklif ve iş planı gönderildi");

const dealer = opp(murat, "Bayi sipariş uygulaması (B2B)", 140000, referral, -40);
touch(-40, murat, dealer, "telefon", "giden", "İlk görüşme, bayilerin sipariş süreci konuşuldu", "arama");
touch(-33, murat, dealer, "yuz_yuze", "giden", "Fabrikada demo ve kapsam görüşmesi", "gorusme");
move(-28, dealer, "teklif");
move(-21, dealer, "kazanildi");

const shop = opp(deniz, "E-ticaret mobil uygulaması", 95000, website, -70);
touch(-70, deniz, shop, "email", "gelen", "Web sitesi formundan teklif isteği geldi");
move(-60, shop, "kazanildi");

const shifts = opp(selin, "Personel izin ve vardiya paneli", 60000, linkedin, -9);
touch(-9, selin, shifts, "linkedin", "giden", "Vardiya planlamasıyla ilgili paylaşımına yazıldı");
touch(-6, selin, shifts, "linkedin", "gelen", "Görüşmek istediğini yazdı");
touch(-3, selin, shifts, "telefon", "giden", "Online görüşme: izin onay akışı, Excel'den geçiş", "gorusme");

const menu = opp(burak, "QR menü ve masadan sipariş", 35000, website, -5);
touch(-5, burak, menu, "whatsapp", "giden", "Örnek menü ekranları gönderildi");
touch(-4, burak, menu, "whatsapp", "gelen", "Fiyat ve teslim süresini sordu");

const fleet = opp(canan, "Araç takip ve teslimat raporu", 120000, linkedin, -8);
touch(-8, canan, fleet, "email", "giden", "Teslimat raporlarının elle tutulmasıyla ilgili yazıldı");

opp(hakan, "İlan yönetim sitesi", 45000, website, -1);

const gym = opp(zeynep, "Üyelik ve ders rezervasyonu", 50000, linkedin, -30);
touch(-30, zeynep, gym, "instagram", "giden", "Rezervasyon sistemiyle ilgili yazıldı");
touch(-27, zeynep, gym, "instagram", "gelen", "İlgilendi, bütçeyi sordu");
move(-15, gym, "kaybedildi", "Bütçe gelecek yıla kaldı");

// Recent first messages so the dashboard and the daily goal have today's activity
const kerem = person("Akın Oto Servis", "Kerem Akın", "İşletme sahibi", {}, -2);
const ayse = person("Lale Çiçekçilik", "Ayşe Lale", "Kurucu", {}, -1);
const mehmet = person("Başkent Eczanesi", "Mehmet Uysal", "Eczacı", {}, 0);
const service = opp(kerem, "Servis randevu ve müşteri bildirimleri", 40000, website, -2);
touch(-2, kerem, service, "telefon", "giden", "Randevu defterinin dijitale taşınması konuşuldu", "arama");
touch(-1, kerem, service, "telefon", "gelen", "Örnek görmek istedi");
const flowers = opp(ayse, "Online sipariş ve teslimat takibi", 55000, linkedin, -1);
touch(-1, ayse, flowers, "instagram", "giden", "Sipariş yoğunluğuyla ilgili paylaşımına yazıldı");
touch(0, ayse, flowers, "instagram", "gelen", "Bu hafta görüşebileceğini yazdı");
touch(0, mehmet, null, "yuz_yuze", "giden", "Eczanede stok takibi ihtiyacı dinlendi", "gorusme");
touch(0, burak, menu, "whatsapp", "giden", "Teklif hazırlanıyor, yarın gönderileceği söylendi");
touch(0, hakan, null, "email", "giden", "İlan sitesi için örnek çalışmalar gönderildi");

// A fourth deal won this month, a fifth still being offered with two extra people on it
const leyla = person("Yurt Pastaneleri", "Leyla Yurt", "Genel müdür", { phone: "0532 000 00 02" }, -30);
const bakery = opp(leyla, "Sipariş ve stok takip uygulaması", 70000, referral, -26);
touch(-26, leyla, bakery, "telefon", "giden", "Şubeler arası stok takibi konuşuldu", "arama");
touch(-18, leyla, bakery, "yuz_yuze", "giden", "Merkez fırında görüşme ve kapsam netleştirme", "gorusme");
move(-14, bakery, "teklif");
move(-9, bakery, "kazanildi");

const gokhan = person("Polat İnşaat", "Gökhan Polat", "Genel müdür", { email: "gokhan@polat.example" }, -22);
const nermin = person("Polat İnşaat", "Nermin Polat", "Finans sorumlusu", {}, -20);
const tolga = person("Polat İnşaat", "Tolga Erdem", "Bilgi işlem sorumlusu", {}, -20);
const site = opp(gokhan, "Şantiye ilerleme takip paneli", 75000, referral, -20);
touch(-20, gokhan, site, "telefon", "giden", "Şantiye raporlarının WhatsApp'tan toplanması konuşuldu", "arama");
touch(-13, gokhan, site, "yuz_yuze", "giden", "Ofiste görüşme: hakediş, ilerleme yüzdesi, fotoğraf arşivi", "gorusme");
touch(-8, nermin, site, "email", "gelen", "Hakediş raporu örneğini istedi");
move(-6, site, "teklif");
const pipeline = (days) => at(days).mod("pipeline");
pipeline(-6).offers.create({
  opportunity_id: site.id, offered_at: shift(-6), amount: 82000,
  items: [{ label: "Tasarım ve prototip", amount: 22000 }, { label: "Web paneli geliştirme", amount: 50000 }, { label: "Eğitim ve kurulum", amount: 10000 }],
  note: "İlk sürüm, fotoğraf arşivi dahil",
});
pipeline(-3).offers.create({
  opportunity_id: site.id, offered_at: shift(-3), amount: 75000,
  items: [{ label: "Tasarım ve prototip", amount: 20000 }, { label: "Web paneli geliştirme", amount: 45000 }, { label: "Eğitim ve kurulum", amount: 10000 }],
  plan: [{ key: "pesinat", label: "Peşinat", pct: 40 }, { key: "tasarim_onayi", label: "Tasarım onayı", pct: 30 }, { key: "teslim", label: "Teslim", pct: 30 }],
  note: "Fotoğraf arşivi ikinci aşamaya alındı, fiyat düştü",
});
pipeline(-5).team.add(site.id, { person_id: nermin.id, role: "karar_verici", note: "Ödeme ve hakediş onayı" });
pipeline(-5).team.add(site.id, { person_id: tolga.id, role: "teknik", note: "Mevcut Excel dosyalarının sahibi" });
touch(-2, gokhan, site, "email", "giden", "Revize teklif (75.000 ₺) gönderildi");

// A new find at the start of the funnel
const sibel = person("Tunç Hukuk Bürosu", "Sibel Tunç", "Avukat", {}, -1);
opp(sibel, "Dava ve duruşma takip paneli", 48000, website, -1);

// Won opportunities open their projects; record the paid milestones
const payments = (oppId) => handle.sqlite.prepare(
  "SELECT p.id, p.expected_amount FROM payments p JOIN projects j ON j.id = p.project_id WHERE j.opportunity_id = ? ORDER BY p.id",
).all(oppId);
const projectOf = (oppId) => handle.sqlite.prepare("SELECT id FROM projects WHERE opportunity_id = ?").get(oppId).id;
const pay = (days, oppId, index) => {
  const p = payments(oppId)[index];
  at(days).mod("projects").payments.pay(p.id, p.expected_amount, shift(days));
};
pay(-58, shop.id, 0);
at(-45).mod("projects").projects.move(projectOf(shop.id), { stage: "tasarim_onayi" });
pay(-40, shop.id, 1);
at(-20).mod("projects").projects.move(projectOf(shop.id), { stage: "test_surumu" });
pay(-19, dealer.id, 0);
pay(-8, bakery.id, 0);
pay(-3, shop.id, 2);
at(-3).mod("projects").projects.move(projectOf(shop.id), { stage: "yayin" });

// This week's calendar: meetings, follow-ups and tasks, the past ones checked off
const calendar = core.mod("calendar");
const task = (title, day, extra = {}) => {
  const row = calendar.tasks.create({ title, due_date: shift(MONDAY + day), ...extra }).row;
  if (MONDAY + day < 0) at(MONDAY + day).mod("calendar").tasks.update(row.id, { done: true });
};
task("Klinik görüşmesi: teklifin maddeleri", 0, { kind: "gorusme", due_time: "10:00", opportunity_id: clinic.id });
task("Karaca Mobilya'ya bayi uygulaması ilerleme notu gönder", 0, { kind: "takip", person_id: murat.id });
task("Denizli Tekstil online demo", 1, { kind: "gorusme", due_time: "14:00", opportunity_id: shifts.id });
task("Pera Butik mağaza gönderimi için ekran görüntülerini hazırla", 2, { project_id: projectOf(shop.id) });
task("Polat İnşaat teklif sunumu", 3, { kind: "gorusme", due_time: "11:30", opportunity_id: site.id });
task("Klinik teklifi için dönüş al", 4, { kind: "takip", opportunity_id: clinic.id });
task("Mavi Kafe menü gösterimi", 4, { kind: "gorusme", due_time: "15:00", opportunity_id: menu.id });
task("Ali Bey'e teşekkür et, yeni tanıştırmaları sor", 5, { person_id: ali.id });
task("Haftalık değerlendirme ve gelecek hafta planı", 6);

calendar.goals.create({ title: "Yeni temas", target: 5, days: [1, 2, 3, 4, 5], metric: "new_records" });
const followGoal = calendar.goals.create({ title: "Takip mesajı", target: 3, days: [1, 2, 3, 4, 5] }).row;
for (let d = Math.max(MONDAY, -4); d <= 0; d++) at(d).mod("calendar").goals.log({ goal_id: followGoal.id, date: shift(d), count: d === 0 ? 1 : 3 });

// The assistant prepares follow-ups; a person approves before anything is sent
const claude = at(0, "claude");
claude.mod("drafts").create({
  person_id: burak.id, opportunity_id: menu.id, channel: "whatsapp",
  body: "Burak Bey merhaba, menü ekranlarına bakabildiniz mi? Fiyat ve teslim süresini içeren kısa bir teklif hazırladım, uygunsanız bu hafta göstereyim.",
});
claude.save("comment", { target_type: "opportunity", target_id: fleet.id, body: "Canan Hanım'a ilk mesajdan bu yana 8 gün geçti, takip mesajı önerebilirim." });
claude.mod("drafts").create({
  person_id: selin.id, opportunity_id: shifts.id, channel: "linkedin",
  body: "Selin Hanım merhaba, konuştuğumuz izin onay akışının iki örnek ekranını hazırladım. Perşembe uygun musunuz, birlikte bakalım?",
  reason: "Online görüşmeden üç gün geçti, örnek ekran sözü verilmişti",
});
const refused = claude.mod("drafts").create({
  person_id: hakan.id, channel: "email", subject: "İlan sitesi için fikirlerim",
  body: "Sayın Hakan Bey, tarafınıza iletilen çalışmalar çerçevesinde ilan yönetim sitesine ilişkin görüşlerimi sunmak isterim.",
});
at(0).mod("drafts").reject(refused.row.id, { note: "Çok resmi, kısa ve samimi yaz" });
const thread = claude.save("comment", { target_type: "opportunity", target_id: clinic.id, body: "Teklif 12 gündür cevapsız. Telefonla aramak mı, kısa bir e-posta mı daha iyi olur?" }).row;
at(0).save("comment", { reply_to: thread.id, body: "Önce ara, ulaşamazsan e-posta at." });
claude.save("comment", { target_type: "person", target_id: ali.id, body: "Ali Bey iki kişiyi tanıştırdı ve ikisi de fırsata döndü. Teşekkür notu için bir taslak hazırlayayım mı?" });

// Ideas and own products
core.save("idea", { title: "Esnaf için WhatsApp sipariş asistanı", problem: "Küçük işletmeler siparişi mesajlardan elle deftere geçiriyor", stage: "dogrulaniyor", money_note: "Aylık abonelik, işletme başına 400 ₺" });
core.save("idea", { title: "Randevu hatırlatma SMS paketi", problem: "Kliniklerde gelmeyen hasta oranı yüksek", stage: "fikir" });
core.save("idea", { title: "Hakediş ve şantiye fotoğraf arşivi", problem: "İnşaat firmaları ilerleme kanıtını dağınık tutuyor", stage: "demo" });
core.save("own_project", { name: "Takip Defteri", description: "Esnaf için sade müşteri ve borç takip uygulaması", status: "aktif", sellable: "evet", stage: "demo" });
core.save("own_project", { name: "Randevu Köprüsü", description: "Klinik randevularını takvimle eşleyen küçük servis", status: "beklemede", sellable: "belki", stage: "fikir" });

// A finished panel chat: the assistant reads the same records through MCP tools
const chat = (actor) => at(0, actor).mod("chat");
const session = chat("owner").createSession();
chat("owner").updateSession(session.id, { title: "Bu haftanın takipleri" });
const exchange = (n, question, tools, answer) => {
  chat("owner").addUserMessage(session.id, { body: question, client_id: `demo-${n}` });
  const reply = chat("claude").startAssistantMessage(session.id);
  chat("claude").setAssistantTools(reply.id, tools);
  chat("claude").appendAssistantText(reply.id, answer);
  chat("claude").finishAssistantMessage(reply.id, { state: "done" });
};
exchange(1, "Bu hafta kime dönmem gerekiyor?", [
  { name: "today", summary: "Bugün ekranı okundu", ok: true },
  { name: "find", summary: "Açık fırsatlar listelendi", ok: true },
], [
  "Üç kişi öne çıkıyor:",
  "",
  "1. **Dr. Elif Yıldız** (Yıldız Diş Kliniği): teklif 12 gün önce gitti, cevap yok. 85.000 ₺ ile en büyük açık teklif. Bugün kısa bir telefon iyi olur.",
  "2. **Canan Öztürk** (Atlas Lojistik): ilk e-postadan bu yana 8 gün geçti. Takip mesajı önerebilirim.",
  "3. **Burak Şahin** (Mavi Kafe): fiyat ve teslim süresini sordu, teklif bekliyor.",
  "",
  "Ayrıca Pera Butik projesinde yayın ödemesi gecikmiş görünüyor.",
].join("\n"));
exchange(2, "Burak Bey için bir takip mesajı hazırla", [
  { name: "get", summary: "Burak Şahin kartı okundu", ok: true },
  { name: "draft", summary: "WhatsApp taslağı oluşturuldu", ok: true },
], "Taslağı hazırladım, **Taslaklar** ekranında onayını bekliyor. Onaylamadan hiçbir mesaj gönderilmiyor.");

handle.sqlite.close();
console.log(`demo veritabanı hazır: ${path.relative(process.cwd(), file)}`);
