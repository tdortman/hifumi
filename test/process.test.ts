import assert from "node:assert/strict";
import { test } from "node:test";

import { runCommand } from "../src/helpers/process.ts";

function runNodeFixture(
    source: string,
    args: readonly string[] = [],
    options?: { captureOutput?: boolean }
): Promise<string> {
    return runCommand(
        process.execPath,
        ["--input-type=module", "--eval", source, ...args],
        options
    );
}

test("passes argv literally without shell expansion", async () => {
    const literalArgs = [
        "hello world",
        "$(printf should-not-run)",
        "*.txt",
        "semicolon; echo should-not-run",
        "$HOME",
        "`echo should-not-run`",
    ];

    const output = await runNodeFixture(
        "process.stdout.write(JSON.stringify(process.argv.slice(1)));",
        literalArgs,
        { captureOutput: true }
    );

    assert.deepEqual(JSON.parse(output), literalArgs);
});

test("returns captured stdout exactly as emitted", async () => {
    const expected = "first line\nsecond line\r\nemoji: 🧪\n";
    const output = await runNodeFixture(
        `process.stdout.write(${JSON.stringify(expected)});`,
        [],
        { captureOutput: true }
    );

    assert.strictEqual(output, expected);
});

test("uncaptured output does not change success semantics", async () => {
    const output = await runNodeFixture(
        'process.stdout.write("uncaptured stdout"); process.stderr.write("uncaptured stderr");',
        [],
        { captureOutput: false }
    );

    assert.strictEqual(output, "");
});

test("rejects when the executable is missing", async () => {
    await assert.rejects(
        runCommand("hifumi-command-that-is-definitely-not-installed-9a7f3d", [])
    );
});

test("rejects when the executable exits nonzero", async () => {
    await assert.rejects(
        runNodeFixture("process.exit(23);", [], { captureOutput: true })
    );
});

// The child fixture intentionally tests Node's TypeScript module boundary.
test("evaluates JavaScript through Node TypeScript source imports", async () => {
    const output = await runNodeFixture(
        `process.env.TURSO_DATABASE_URL = "file::memory:";
process.argv.push("deploy-commands");
const { asyncEval } = await import("./src/commands/miscellaneous.ts");
process.stdout.write(String(await asyncEval("1 + 1", {})));`,
        [],
        { captureOutput: true }
    );

    assert.strictEqual(output, "2");
});

// The child fixture verifies that ensureNotBehindRemote skips when no .git exists.
test("skips Git freshness checks without a git repository", async () => {
    const output = await runNodeFixture(
        `process.env.TURSO_DATABASE_URL = "file::memory:";
const { mkdtempSync, rmSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const { join } = await import("node:path");
const { pathToFileURL } = await import("node:url");
const origCwd = process.cwd();
const modUrl = pathToFileURL(join(origCwd, "src/helpers/utils.ts")).href;
const tmpDir = mkdtempSync(join(tmpdir(), "hifumi-test-"));
process.chdir(tmpDir);
process.argv.push("deploy-commands");
try {
    const { ensureNotBehindRemote } = await import(modUrl);
    await ensureNotBehindRemote();
    process.stdout.write("no-git-ready");
} finally {
    process.chdir(origCwd);
    rmSync(tmpDir, { recursive: true, force: true });
}`,
        [],
        { captureOutput: true }
    );

    assert.strictEqual(output, "no-git-ready");
});
