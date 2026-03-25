import type { HeadersInit } from "bun";
import {
    type ChatInputCommandInteraction,
    type Client,
    EmbedBuilder,
    hyperlink,
    MessageFlags,
    userMention,
} from "discord.js";
import { z } from "zod";
import { EMBED_COLOUR, USER_AGENT } from "../config.ts";
import {
    addPrSubscription,
    deletePrSubscriptionById,
    getAllActivePrSubscriptions,
    getUserPrSubscriptions,
    removePrSubscription,
    updatePrSubscriptionBranch,
    updatePrSubscriptionSha,
} from "../db/index.ts";
import type { NixpkgsPrSubscription } from "../db/types.ts";

const GITHUB_API = "https://api.github.com";
const NIXPKGS_REPO = "NixOS/nixpkgs";
const POLL_INTERVAL_MS = 5 * 1000;

const GITHUB_HEADERS: HeadersInit = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
};

const GitHubPRSchema = z.object({
    number: z.number(),
    title: z.string(),
    html_url: z.url(),
    state: z.string(),
    merged: z.boolean(),
    merge_commit_sha: z.string().nullable(),
});

type GitHubPR = z.infer<typeof GitHubPRSchema>;

async function fetchPR(prNumber: number): Promise<GitHubPR | null> {
    const res = await fetch(
        `${GITHUB_API}/repos/${NIXPKGS_REPO}/pulls/${prNumber}`,
        {
            headers: GITHUB_HEADERS,
        }
    ).catch(() => null);

    if (!res?.ok) return null;

    const json = await res.json().catch(() => null);
    const parsed = GitHubPRSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
}

/**
 * Check if a commit SHA exists on a given branch by checking if the branch
 * contains that commit. We use the compare API: if the merge_commit is
 * an ancestor of the branch head, it will show status "ahead" or "identical"
 * for sha...branch.
 */
const GitHubCompareSchema = z.object({
    status: z.enum(["behind", "identical", "ahead", "diverged"]),
});

async function isShaOnBranch(
    sha: string,
    branch: string
): Promise<boolean | null> {
    // GET /repos/{owner}/{repo}/compare/{basehead}
    // basehead = sha...branch  → if status is "ahead", branch contains sha
    const basehead = `${encodeURIComponent(sha)}...${encodeURIComponent(branch)}`;
    const res = await fetch(
        `${GITHUB_API}/repos/${NIXPKGS_REPO}/compare/${basehead}`,
        {
            headers: GITHUB_HEADERS,
        }
    ).catch(() => null);

    if (!res) return null;
    if (!res.ok) return null;

    const json = await res.json().catch(() => null);
    const parsed = GitHubCompareSchema.safeParse(json);
    if (!parsed.success) return null;

    // "ahead" = branch has commits not in sha (i.e. sha is reachable from branch)
    // "identical" = sha IS the branch head
    // "behind" = branch is missing commits from sha
    // "diverged" = branches diverged
    return parsed.data.status === "ahead" || parsed.data.status === "identical";
}

function prUrl(prNumber: number): string {
    return `<https://github.com/${NIXPKGS_REPO}/pull/${prNumber}>`;
}

function prHyperlink(prNumber: number): string {
    return hyperlink(`#${prNumber}`, prUrl(prNumber));
}

function toDiscordTimestamp(value: string | null): string {
    if (!value) return "unknown";

    // SQLite CURRENT_TIMESTAMP is usually `YYYY-MM-DD HH:MM:SS` in UTC.
    const normalized = value.includes("T")
        ? value
        : `${value.replace(" ", "T")}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return "unknown";

    const seconds = Math.floor(date.getTime() / 1000);
    return `<t:${seconds}:f> (<t:${seconds}:R>)`;
}

export async function nixpkgsAdd(interaction: ChatInputCommandInteraction) {
    const prNumber = interaction.options.getInteger("pr", true);
    const branch =
        interaction.options.getString("branch", false) ?? "nixos-unstable";
    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Validate the PR exists on GitHub
    const pr = await fetchPR(prNumber);
    if (!pr) {
        return await interaction.editReply(
            `Could not find PR ${prHyperlink(prNumber)} on nixpkgs. Make sure the PR number is correct.`
        );
    }

    try {
        await addPrSubscription({
            userId,
            prNumber,
            branch,
            channelId,
            mergeCommitSha: pr.merge_commit_sha,
        });
    } catch (e: unknown) {
        const duplicatePr = ((e as Error).cause as Error).message.includes(
            "UNIQUE"
        );

        if (duplicatePr) {
            return await interaction.editReply(
                `You're already subscribed to PR ${prHyperlink(prNumber)} on branch \`${branch}\`.`
            );
        }
        return await interaction.editReply(
            "Failed to add subscription, please try again later."
        );
    }

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle("Nixpkgs PR Subscription Added")
        .setDescription(`Tracking ${prHyperlink(prNumber)} → \`${branch}\``)
        .addFields(
            { name: "PR Title", value: pr.title, inline: false },
            {
                name: "Status",
                value: pr.merged ? "Merged ✅" : `${pr.state}`,
                inline: true,
            },
            { name: "Branch", value: `\`${branch}\``, inline: true }
        )
        .setTimestamp();

    return await interaction.editReply({ embeds: [embed] });
}

export async function nixpkgsRemove(interaction: ChatInputCommandInteraction) {
    const prNumber = interaction.options.getInteger("pr", true);
    const branch =
        interaction.options.getString("branch", false) ?? "nixos-unstable";
    const userId = interaction.user.id;

    const result = await removePrSubscription(userId, prNumber, branch);

    if (result.rowsAffected === 0) {
        return await interaction.reply({
            content: `No subscription found for PR ${prHyperlink(prNumber)} on branch \`${branch}\`.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    return await interaction.reply({
        content: `Unsubscribed from PR ${prHyperlink(prNumber)} on branch \`${branch}\`.`,
        flags: MessageFlags.Ephemeral,
    });
}

export async function nixpkgsEdit(interaction: ChatInputCommandInteraction) {
    const prNumber = interaction.options.getInteger("pr", true);
    const newBranch = interaction.options.getString("branch", true);
    const userId = interaction.user.id;

    try {
        const result = await updatePrSubscriptionBranch(
            userId,
            prNumber,
            newBranch
        );

        if (result.rowsAffected === 0) {
            return await interaction.reply({
                content: `No subscription found for PR ${prHyperlink(prNumber)}.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    } catch (e: unknown) {
        const msg =
            e instanceof Error && e.message.includes("UNIQUE")
                ? `You already have a subscription for PR ${prHyperlink(prNumber)} on branch \`${newBranch}\`.`
                : "Failed to update subscription, please try again later.";
        return await interaction.reply({
            content: msg,
            flags: MessageFlags.Ephemeral,
        });
    }

    return await interaction.reply({
        content: `Updated subscription: PR ${prHyperlink(prNumber)} now tracking \`${newBranch}\`.`,
        flags: MessageFlags.Ephemeral,
    });
}

export async function nixpkgsList(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const subs = await getUserPrSubscriptions(userId);

    if (subs.length === 0) {
        return await interaction.reply({
            content: "You have no active nixpkgs PR subscriptions.",
            flags: MessageFlags.Ephemeral,
        });
    }

    const uniquePrNumbers = [...new Set(subs.map((s) => s.prNumber))];
    const prEntries = await Promise.all(
        uniquePrNumbers.map(async (prNumber) => {
            const pr = await fetchPR(prNumber);
            return [prNumber, pr] as const;
        })
    );
    const prByNumber = new Map<number, GitHubPR | null>(prEntries);

    const lines = subs.map((s) => {
        const pr = prByNumber.get(s.prNumber);
        const title = pr?.title ?? "Title unavailable";
        return [
            `• ${prHyperlink(s.prNumber)} - ${title}`,
            `  Branch: \`${s.branch}\``,
            `  Added: ${toDiscordTimestamp(s.createdAt)}`,
        ].join("\n");
    });

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle("Your Nixpkgs PR Subscriptions")
        .setDescription(lines.join("\n"))
        .setFooter({ text: `${subs.length} subscription(s)` })
        .setTimestamp();

    return await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
    });
}

async function notifyUser(
    client: Client,
    sub: NixpkgsPrSubscription,
    pr: GitHubPR
) {
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle("🎉 Nixpkgs PR Landed!")
        .setDescription(
            `${prHyperlink(pr.number)} has landed on \`${sub.branch}\`!`
        )
        .addFields({ name: "PR Title", value: pr.title, inline: false })
        .setTimestamp();

    try {
        const user = await client.users.fetch(sub.userId, { force: true });
        const dm = await user.createDM(true);
        await dm.send({ embeds: [embed] });
    } catch (err) {
        // DM failed, fall back to channel
        if (sub.channelId) {
            try {
                const channel = await client.channels.fetch(sub.channelId);
                if (channel?.isTextBased() && "send" in channel) {
                    await channel.send({
                        content: userMention(sub.userId),
                        embeds: [embed],
                    });
                }
            } catch {
                console.error(
                    `Failed to notify user ${sub.userId} for PR #${sub.prNumber} (channel fallback also failed)`
                );
                console.error(err);
            }
        }
    }
}

export async function startNixpkgsPollingLoop(client: Client) {
    while (true) {
        try {
            const subs = await getAllActivePrSubscriptions();

            // Group subs by prNumber to minimize GitHub API calls
            const byPr = new Map<number, NixpkgsPrSubscription[]>();
            for (const sub of subs) {
                const existing = byPr.get(sub.prNumber) ?? [];
                existing.push(sub);
                byPr.set(sub.prNumber, existing);
            }

            for (const [prNumber, prSubs] of byPr) {
                const pr = await fetchPR(prNumber);
                if (!pr) continue;

                // Update merge_commit_sha if we don't have it yet but PR is now merged
                if (pr.merge_commit_sha) {
                    for (const sub of prSubs) {
                        if (!sub.mergeCommitSha) {
                            await updatePrSubscriptionSha(
                                sub.id,
                                pr.merge_commit_sha
                            );
                            sub.mergeCommitSha = pr.merge_commit_sha;
                        }
                    }
                }

                // Skip if PR hasn't been merged yet
                if (!pr.merged || !pr.merge_commit_sha) continue;

                // Group by branch to minimize compare calls
                const byBranch = new Map<string, NixpkgsPrSubscription[]>();
                for (const sub of prSubs) {
                    const existing = byBranch.get(sub.branch) ?? [];
                    existing.push(sub);
                    byBranch.set(sub.branch, existing);
                }

                for (const [branch, branchSubs] of byBranch) {
                    const onBranch = await isShaOnBranch(
                        pr.merge_commit_sha,
                        branch
                    );
                    if (!onBranch) continue;

                    for (const sub of branchSubs) {
                        await notifyUser(client, sub, pr);
                        await deletePrSubscriptionById(sub.id);
                    }
                }

                // Small delay between PRs to be respectful to the API
                await Bun.sleep(1000);
            }
        } catch (e) {
            console.error("Error in nixpkgs polling loop:", e);
        }

        await Bun.sleep(POLL_INTERVAL_MS);
    }
}
