CREATE TABLE `draft_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`person_id` integer,
	`company_id` integer,
	`opportunity_id` integer,
	`project_id` integer,
	`idea_id` integer,
	`channel` text,
	`state` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`session_id` integer,
	`task_id` integer,
	`draft_id` integer,
	`drafts_before` integer,
	`started_at` text,
	`finished_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `draft_runs_state` ON `draft_runs` (`state`,`id`);--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD `kind` text DEFAULT 'chat' NOT NULL;