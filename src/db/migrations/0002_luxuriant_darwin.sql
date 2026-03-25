CREATE TABLE `nixpkgs_pr_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text(255) NOT NULL,
	`pr_number` integer NOT NULL,
	`branch` text(255) DEFAULT 'nixos-unstable' NOT NULL,
	`channel_id` text(255),
	`merge_commit_sha` text(255),
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `nixpkgs_user_idx` ON `nixpkgs_pr_subscriptions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_pr_branch` ON `nixpkgs_pr_subscriptions` (`user_id`,`pr_number`,`branch`);