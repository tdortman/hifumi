import { sql } from "drizzle-orm";
import {
    index,
    integer,
    sqliteTable,
    text,
    unique,
} from "drizzle-orm/sqlite-core";

export const errorLogs = sqliteTable("error_logs", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    server: text("server", { length: 255 }),
    channel: text("channel", { length: 255 }).notNull(),
    user: text("user", { length: 255 }).notNull(),
    command: text("command"),
    stack: text("stack"),
    timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`),
    log: text("log"),
    error: text("error"),
});

export const helpMessages = sqliteTable("help_messages", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    cmd: text("cmd", { length: 100 }).notNull(),
    desc: text("desc", { length: 255 }).notNull(),
});

export const leet = sqliteTable("leet", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    source: text("source", { length: 1 }).notNull(),
    translated: text("translated", { length: 10 }).notNull(),
});

export const aiCommandAliases = sqliteTable("ai_command_aliases", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    command: text("command", { length: 255 }).notNull(),
    alias: text("alias", { length: 255 }).notNull(),
});

export const aiReactions = sqliteTable("ai_reactions", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    command: text("command", { length: 255 }).notNull(),
    reaction: text("reaction", { length: 255 }).notNull(),
});

export const prefixes = sqliteTable("prefixes", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    serverId: text("server_id", { length: 255 }).notNull().unique(),
    prefix: text("prefix", { length: 255 }).notNull(),
});

export const redditPosts = sqliteTable(
    "reddit_posts",
    {
        id: integer("id", { mode: "number" }).primaryKey({
            autoIncrement: true,
        }),
        subreddit: text("subreddit", { length: 50 }).notNull(),
        title: text("title", { length: 255 }).notNull(),
        url: text("url", { length: 255 }).notNull(),
        over_18: integer("over_18", { mode: "boolean" }).notNull(),
        permalink: text("permalink", { length: 255 }).notNull(),
    },
    (table) => [
        index("subreddit_idx").on(table.subreddit),
        index("url_idx").on(table.url),
    ]
);

export const nixpkgsPrSubscriptions = sqliteTable(
    "nixpkgs_pr_subscriptions",
    {
        id: integer("id", { mode: "number" }).primaryKey({
            autoIncrement: true,
        }),
        userId: text("user_id", { length: 255 }).notNull(),
        prNumber: integer("pr_number", { mode: "number" }).notNull(),
        branch: text("branch", { length: 255 })
            .notNull()
            .default("nixos-unstable"),
        channelId: text("channel_id", { length: 255 }),
        mergeCommitSha: text("merge_commit_sha", { length: 255 }),
        createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => [
        index("nixpkgs_user_idx").on(table.userId),
        unique("unique_user_pr_branch").on(
            table.userId,
            table.prNumber,
            table.branch
        ),
    ]
);

export const nixpkgsBranchSubscriptions = sqliteTable(
    "nixpkgs_branch_subscriptions",
    {
        id: integer("id", { mode: "number" }).primaryKey({
            autoIncrement: true,
        }),
        userId: text("user_id", { length: 255 }).notNull(),
        branch: text("branch", { length: 255 })
            .notNull()
            .default("nixos-unstable"),
        channelId: text("channel_id", { length: 255 }),
        lastSeenSha: text("last_seen_sha", { length: 255 }).notNull(),
        createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => [
        index("nixpkgs_branch_user_idx").on(table.userId),
        unique("unique_user_branch").on(table.userId, table.branch),
    ]
);

export const statuses = sqliteTable(
    "statuses",
    {
        id: integer("id", { mode: "number" }).primaryKey({
            autoIncrement: true,
        }),
        type: text("type", {
            length: 20,
            enum: [
                "PLAYING",
                "WATCHING",
                "STREAMING",
                "LISTENING",
                "COMPETING",
                "CUSTOM",
            ],
        }).notNull(),
        status: text("status", { length: 128 }).notNull(),
    },
    (table) => [
        index("id").on(table.id),
        unique("unique_type_status").on(table.type, table.status),
    ]
);
