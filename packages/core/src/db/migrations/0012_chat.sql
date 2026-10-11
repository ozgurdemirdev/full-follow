CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`session_id` integer NOT NULL,
	`role` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`state` text NOT NULL,
	`client_id` text,
	`tools_json` text,
	`error` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`cost_usd_micros` integer,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_messages_session` ON `chat_messages` (`session_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_messages_client` ON `chat_messages` (`session_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`deleted_at` text,
	`title` text DEFAULT 'Yeni sohbet' NOT NULL,
	`title_locked` integer DEFAULT false NOT NULL,
	`cli_session_id` text NOT NULL,
	`cli_started` integer DEFAULT false NOT NULL,
	`model` text NOT NULL,
	`effort` text NOT NULL,
	`context_tokens` integer DEFAULT 0 NOT NULL,
	`input_tokens_total` integer DEFAULT 0 NOT NULL,
	`output_tokens_total` integer DEFAULT 0 NOT NULL,
	`cost_usd_micros_total` integer DEFAULT 0 NOT NULL,
	`last_message_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_sessions_cli_session_id_unique` ON `chat_sessions` (`cli_session_id`);--> statement-breakpoint
CREATE INDEX `chat_sessions_list` ON `chat_sessions` (`deleted_at`,`last_message_at`);