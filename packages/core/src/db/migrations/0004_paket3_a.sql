-- Paket 3 (1/2): firma kaydı, veritabanındaki etiketler, çoklu sektör, nereden buldum, çöp kutusu, mükerrer anahtarları.
-- Eski sütunlar (people.sector_id, person_tags.tag) bu adımda veriyi taşımak için durur, 0005 onları kaldırır.
CREATE TABLE `company_sectors` (
	`company_id` integer NOT NULL,
	`sector_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	PRIMARY KEY(`company_id`, `sector_id`),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `company_sectors_sector` ON `company_sectors` (`sector_id`);--> statement-breakpoint
CREATE TABLE `company_tags` (
	`company_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	PRIMARY KEY(`company_id`, `tag_id`),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `company_tags_tag` ON `company_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `person_sectors` (
	`person_id` integer NOT NULL,
	`sector_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	PRIMARY KEY(`person_id`, `sector_id`),
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `person_sectors_sector` ON `person_sectors` (`sector_id`);--> statement-breakpoint
-- kişinin tek sektörü çoklu sektör tablosuna taşınır
INSERT INTO `person_sectors` (`person_id`, `sector_id`, `created_at`, `created_by`)
	SELECT `id`, `sector_id`, `created_at`, `created_by` FROM `people` WHERE `sector_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text DEFAULT 'aday' NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug` ON `tags` (`slug`);--> statement-breakpoint
-- varsayılan etiketler: eski rol çipleri + R10, sıcak, fuar (Ayarlar'dan değişir)
INSERT INTO `tags` (`created_at`, `updated_at`, `created_by`, `name`, `slug`, `color`)
	SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 'ozgur', v.name, v.slug, v.color FROM (
		SELECT 'Aday' AS name, 'aday' AS slug, 'aday' AS color
		UNION ALL SELECT 'Müşteri', 'musteri', 'musteri'
		UNION ALL SELECT 'Ajans', 'ajans', 'ajans'
		UNION ALL SELECT 'İş ortağı', 'is_ortagi', 'is_ortagi'
		UNION ALL SELECT 'Network', 'network', 'network'
		UNION ALL SELECT 'R10', 'r10', 'payment'
		UNION ALL SELECT 'Sıcak', 'sicak', 'warning'
		UNION ALL SELECT 'Fuar', 'fuar', 'source'
	) v;--> statement-breakpoint
CREATE TABLE `trash` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`type` text NOT NULL,
	`record_id` integer NOT NULL,
	`label` text NOT NULL,
	`payload` text NOT NULL,
	`keys` text
);
--> statement-breakpoint
CREATE INDEX `trash_type` ON `trash` (`type`,`record_id`);--> statement-breakpoint
DROP INDEX `people_sector`;--> statement-breakpoint
ALTER TABLE `people` ADD `source_id` integer REFERENCES sources(id);--> statement-breakpoint
ALTER TABLE `people` ADD `contact_status` text DEFAULT 'yazilmadi' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `email_key` text;--> statement-breakpoint
ALTER TABLE `people` ADD `instagram_key` text;--> statement-breakpoint
ALTER TABLE `people` ADD `linkedin_key` text;--> statement-breakpoint
CREATE INDEX `people_company` ON `people` (`company_id`);--> statement-breakpoint
CREATE INDEX `people_email_key` ON `people` (`email_key`);--> statement-breakpoint
CREATE INDEX `people_instagram_key` ON `people` (`instagram_key`);--> statement-breakpoint
CREATE INDEX `people_linkedin_key` ON `people` (`linkedin_key`);--> statement-breakpoint
CREATE TABLE `__new_person_tags` (
	`person_id` integer NOT NULL,
	`tag` text NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	PRIMARY KEY(`person_id`, `tag_id`),
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- metin etiketi (slug) etiket tablosundaki id'ye çevrilir
INSERT INTO `__new_person_tags` (`person_id`, `tag`, `tag_id`, `created_at`, `created_by`)
	SELECT pt.`person_id`, pt.`tag`, t.`id`, pt.`created_at`, pt.`created_by` FROM `person_tags` pt JOIN `tags` t ON t.`slug` = pt.`tag`;--> statement-breakpoint
DROP TABLE `person_tags`;--> statement-breakpoint
ALTER TABLE `__new_person_tags` RENAME TO `person_tags`;--> statement-breakpoint
CREATE INDEX `person_tags_tag` ON `person_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `__new_drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`person_id` integer,
	`company_id` integer,
	`contact` text,
	`opportunity_id` integer,
	`project_id` integer,
	`channel` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'bekliyor' NOT NULL,
	`reject_note` text,
	`reason` text,
	`template_id` integer,
	`followup_step` integer,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_drafts` ("id", "created_at", "updated_at", "created_by", "person_id", "opportunity_id", "project_id", "channel", "body", "status", "reject_note", "reason", "template_id", "followup_step")
	SELECT "id", "created_at", "updated_at", "created_by", "person_id", "opportunity_id", "project_id", "channel", "body", "status", "reject_note", "reason", "template_id", "followup_step" FROM `drafts`;--> statement-breakpoint
DROP TABLE `drafts`;--> statement-breakpoint
ALTER TABLE `__new_drafts` RENAME TO `drafts`;--> statement-breakpoint
CREATE TABLE `__new_touches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`person_id` integer,
	`company_id` integer,
	`contact` text,
	`contact_key` text,
	`opportunity_id` integer,
	`project_id` integer,
	`channel` text NOT NULL,
	`direction` text NOT NULL,
	`kind` text DEFAULT 'mesaj' NOT NULL,
	`summary` text NOT NULL,
	`outcome` text,
	`happened_at` text NOT NULL,
	`expects_reply` integer DEFAULT false NOT NULL,
	`draft_id` integer,
	`idea_id` integer,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_touches` ("id", "created_at", "updated_at", "created_by", "person_id", "opportunity_id", "project_id", "channel", "direction", "kind", "summary", "outcome", "happened_at", "expects_reply", "draft_id", "idea_id")
	SELECT "id", "created_at", "updated_at", "created_by", "person_id", "opportunity_id", "project_id", "channel", "direction", "kind", "summary", "outcome", "happened_at", "expects_reply", "draft_id", "idea_id" FROM `touches`;--> statement-breakpoint
DROP TABLE `touches`;--> statement-breakpoint
ALTER TABLE `__new_touches` RENAME TO `touches`;--> statement-breakpoint
CREATE INDEX `touches_person` ON `touches` (`person_id`,`happened_at`);--> statement-breakpoint
CREATE INDEX `touches_happened` ON `touches` (`happened_at`);--> statement-breakpoint
CREATE INDEX `touches_company` ON `touches` (`company_id`,`happened_at`);--> statement-breakpoint
CREATE INDEX `touches_contact` ON `touches` (`contact_key`);--> statement-breakpoint
ALTER TABLE `companies` ADD `email` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `instagram` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `linkedin` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `source_id` integer REFERENCES sources(id);--> statement-breakpoint
ALTER TABLE `companies` ADD `contact_status` text DEFAULT 'yazilmadi' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `name_key` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `domain_key` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `email_key` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `instagram_key` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `linkedin_key` text;--> statement-breakpoint
CREATE INDEX `companies_name_key` ON `companies` (`name_key`);--> statement-breakpoint
CREATE INDEX `companies_domain_key` ON `companies` (`domain_key`);--> statement-breakpoint
CREATE INDEX `companies_email_key` ON `companies` (`email_key`);--> statement-breakpoint
CREATE INDEX `companies_instagram_key` ON `companies` (`instagram_key`);--> statement-breakpoint
CREATE INDEX `companies_linkedin_key` ON `companies` (`linkedin_key`);--> statement-breakpoint
CREATE INDEX `companies_status` ON `companies` (`contact_status`);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `source_date` text;--> statement-breakpoint
ALTER TABLE `sectors` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `sources` ADD `deleted_at` text;--> statement-breakpoint
-- "nereden buldum" listesi: yoksa açılır (aynı adlı kaynak varsa ona dokunulmaz)
INSERT INTO `sources` (`created_at`, `updated_at`, `created_by`, `name`, `kind`)
	SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 'ozgur', v.name, v.kind FROM (
		SELECT 'LinkedIn' AS name, 'sosyal' AS kind
		UNION ALL SELECT 'Instagram', 'sosyal'
		UNION ALL SELECT 'R10', 'forum'
		UNION ALL SELECT 'Referans', 'referans'
		UNION ALL SELECT 'Web sitesi', 'diger'
		UNION ALL SELECT 'Fuar', 'diger'
		UNION ALL SELECT 'Diğer', 'diger'
	) v WHERE NOT EXISTS (SELECT 1 FROM `sources` s WHERE s.`name` = v.name COLLATE NOCASE);--> statement-breakpoint
-- temas durumu mevcut temaslardan: görüşme/arama > cevap geldi > yazıldı > yazılmadı
UPDATE `people` SET `contact_status` = CASE
	WHEN EXISTS (SELECT 1 FROM `touches` t WHERE t.`person_id` = `people`.`id` AND t.`kind` IN ('arama', 'gorusme')) THEN 'gorusuldu'
	WHEN EXISTS (SELECT 1 FROM `touches` t WHERE t.`person_id` = `people`.`id` AND t.`direction` = 'gelen') THEN 'cevap_geldi'
	WHEN EXISTS (SELECT 1 FROM `touches` t WHERE t.`person_id` = `people`.`id`) THEN 'yazildi'
	ELSE 'yazilmadi' END;--> statement-breakpoint
UPDATE `companies` SET `contact_status` = CASE
	WHEN EXISTS (SELECT 1 FROM `people` p WHERE p.`company_id` = `companies`.`id` AND p.`contact_status` = 'gorusuldu') THEN 'gorusuldu'
	WHEN EXISTS (SELECT 1 FROM `people` p WHERE p.`company_id` = `companies`.`id` AND p.`contact_status` = 'cevap_geldi') THEN 'cevap_geldi'
	WHEN EXISTS (SELECT 1 FROM `people` p WHERE p.`company_id` = `companies`.`id` AND p.`contact_status` = 'yazildi') THEN 'yazildi'
	ELSE 'yazilmadi' END;
