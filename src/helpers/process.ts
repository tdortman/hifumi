import { spawn } from "node:child_process";

export type RunCommandOptions = {
    captureOutput?: boolean;
};

/**
 * Runs an executable directly with argv, without invoking a shell.
 *
 * By default, the child inherits the parent's stdio. When captureOutput is
 * enabled, stdout is collected and stderr is discarded.
 */
export function runCommand(
    command: string,
    args: readonly string[],
    options: RunCommandOptions = {}
): Promise<string> {
    const captureOutput = options.captureOutput ?? false;

    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            shell: false,
            stdio: captureOutput ? ["ignore", "pipe", "ignore"] : "inherit",
        });

        let stdout = "";
        let settled = false;

        const rejectOnce = (error: Error) => {
            if (settled) return;
            settled = true;
            reject(error);
        };

        child.once("error", rejectOnce);

        if (captureOutput) {
            child.stdout?.setEncoding("utf8");
            child.stdout?.on("data", (chunk: string) => {
                stdout += chunk;
            });
        }

        child.once("close", (code, signal) => {
            if (settled) return;
            settled = true;

            if (code !== 0) {
                const reason =
                    code === null
                        ? `terminated by signal ${signal ?? "unknown"}`
                        : `exited with code ${code}`;
                reject(new Error(`Command ${command} ${reason}`));
                return;
            }

            resolve(captureOutput ? stdout : "");
        });
    });
}
