CREATE TABLE `port_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`port` integer NOT NULL,
	`protocol` text DEFAULT 'tcp' NOT NULL,
	`purpose` text DEFAULT 'other' NOT NULL,
	`server_id` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`loader_type` text NOT NULL,
	`mc_version` text NOT NULL,
	`loader_version` text,
	`java_tag` text NOT NULL,
	`memory_mb` integer NOT NULL,
	`game_port` integer NOT NULL,
	`rcon_port` integer NOT NULL,
	`rcon_password` text NOT NULL,
	`container_id` text,
	`eula_accepted` integer DEFAULT false NOT NULL,
	`status_cache` text DEFAULT 'unknown' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);