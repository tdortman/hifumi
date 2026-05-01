CREATE TABLE IF NOT EXISTS `nixpkgs_branch_subscriptions` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `user_id` text(255) NOT NULL,
    `branch` text(255) DEFAULT 'nixos-unstable' NOT NULL,
    `channel_id` text(255),
    `last_seen_sha` text(255) NOT NULL,
    `created_at` text DEFAULT CURRENT_TIMESTAMP
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `nixpkgs_branch_user_idx` ON `nixpkgs_branch_subscriptions` (`user_id`);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_user_branch` ON `nixpkgs_branch_subscriptions` (`user_id`, `branch`);