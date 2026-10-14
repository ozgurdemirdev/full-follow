ALTER TABLE `tasks` ADD `due_time` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `kind` text DEFAULT 'gorev' NOT NULL;