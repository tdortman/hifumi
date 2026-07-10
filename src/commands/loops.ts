import { setTimeout as sleep } from "node:timers/promises";
import type { TextChannel } from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { errorLogs } from "../db/schema.ts";
import {
    type CatFactResponse,
    CatFactResponseSchema,
} from "../helpers/types.ts";
import { isDev, randomIntFromRange } from "../helpers/utils.ts";

export async function startCatFactLoop(channel: TextChannel) {
    const sleepForCatFact = async () =>
        await sleep(randomIntFromRange(54000000, 86400000)); // 15h-24h

    while (true) {
        const response = await fetch("https://catfact.ninja/fact").catch(
            console.error
        );

        if (!response) {
            await channel.send("Error fetching cat fact");
            await sleepForCatFact();
            continue;
        }

        const json = (await response
            .json()
            .catch(console.error)) as CatFactResponse;

        if (!(json && CatFactResponseSchema.safeParse(json).success)) {
            await channel.send("Error parsing cat fact response");
            await sleepForCatFact();
            continue;
        }

        await channel.send(json.fact);
        await sleepForCatFact();
    }
}

export async function avoidDbSleeping() {
    const sixDaysinSeconds = 518400;

    if (isDev()) return;

    while (true) {
        await db.insert(errorLogs).values({
            channel: "N/A",
            error: "Avoiding database freezing",
            user: "N/A",
        });

        await db.delete(errorLogs).where(eq(errorLogs.channel, "N/A"));
        await sleep(sixDaysinSeconds * 1000);
    }
}
