-- Paket 3 (2/2): taşınan eski sütunlar kalkar (people.sector_id → person_sectors, person_tags.tag → tag_id).
-- Tablo yeniden kurulurken foreign key kontrolü openDb'de kapalıdır, sonunda foreign_key_check çalışır.
CREATE TABLE `__new_people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`name` text NOT NULL,
	`company_id` integer,
	`email` text,
	`phone` text,
	`instagram` text,
	`linkedin` text,
	`handle` text,
	`referred_by_id` integer,
	`post_id` integer,
	`source_id` integer,
	`contact_status` text DEFAULT 'yazilmadi' NOT NULL,
	`next_follow_up_at` text,
	`notes` text,
	`email_key` text,
	`instagram_key` text,
	`linkedin_key` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referred_by_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_people`("id", "created_at", "updated_at", "created_by", "name", "company_id", "email", "phone", "instagram", "linkedin", "handle", "referred_by_id", "post_id", "source_id", "contact_status", "next_follow_up_at", "notes", "email_key", "instagram_key", "linkedin_key") SELECT "id", "created_at", "updated_at", "created_by", "name", "company_id", "email", "phone", "instagram", "linkedin", "handle", "referred_by_id", "post_id", "source_id", "contact_status", "next_follow_up_at", "notes", "email_key", "instagram_key", "linkedin_key" FROM `people`;--> statement-breakpoint
DROP TABLE `people`;--> statement-breakpoint
ALTER TABLE `__new_people` RENAME TO `people`;--> statement-breakpoint
CREATE INDEX `people_follow_up` ON `people` (`next_follow_up_at`);--> statement-breakpoint
CREATE INDEX `people_referred` ON `people` (`referred_by_id`);--> statement-breakpoint
CREATE INDEX `people_post` ON `people` (`post_id`);--> statement-breakpoint
CREATE INDEX `people_company` ON `people` (`company_id`);--> statement-breakpoint
CREATE INDEX `people_email_key` ON `people` (`email_key`);--> statement-breakpoint
CREATE INDEX `people_instagram_key` ON `people` (`instagram_key`);--> statement-breakpoint
CREATE INDEX `people_linkedin_key` ON `people` (`linkedin_key`);--> statement-breakpoint
ALTER TABLE `person_tags` DROP COLUMN `tag`;