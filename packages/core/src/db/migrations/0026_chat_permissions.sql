CREATE TABLE `chat_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`session_id` integer NOT NULL,
	`message_id` integer,
	`tool_name` text NOT NULL,
	`input_json` text NOT NULL,
	`summary` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`answered_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_permissions_session` ON `chat_permissions` (`session_id`,`id`);--> statement-breakpoint
CREATE INDEX `chat_permissions_state` ON `chat_permissions` (`state`);