import { fork, spawn } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { resolve } from "path";

const SOCKET = "/tmp/sediman.sock";

function cleanup() {
  try { unlinkSync(SOCKET); } catch {}
}

process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

const binRelease = resolve(process.cwd(), "target/release/sediman-tui");
const binDebug = resolve(process.cwd(), "target/debug/sediman-tui");
const tuiBin = existsSync(binRelease) ? binRelease : binDebug;

if (!existsSync(tuiBin)) {
  console.error("Rust TUI binary not found. Run: cargo build --release -p sediman-tui");
  process.exit(1);
}

cleanup();

const server = fork(resolve(process.cwd(), "packages/server/src/index.ts"), ["--mode", "rpc"], {
  env: { ...process.env, NODE_ENV: "production", SEDIMAN_RPC_SOCKET: SOCKET },
  stdio: ["ignore", "ignore", "ignore", "ipc"],
});

function waitForSocket(retries: number, cb: () => void) {
  if (existsSync(SOCKET)) { cb(); return; }
  if (retries <= 0) { cb(); return; }
  setTimeout(() => waitForSocket(retries - 1, cb), 200);
}

waitForSocket(25, () => {
  const tui = spawn(tuiBin, [
    "--socket", SOCKET,
    "--provider", process.env.SEDIMAN_PROVIDER ?? "openai",
    ...(process.env.SEDIMAN_MODEL ? ["--model", process.env.SEDIMAN_MODEL] : []),
    ...(process.env.SEDIMAN_BASE_URL ? ["--base-url", process.env.SEDIMAN_BASE_URL] : []),
    "--no-spawn",
  ], { stdio: "inherit" });

  tui.on("exit", (code) => { server.kill(); process.exit(code ?? 0); });
  process.on("SIGINT", () => { tui.kill(); server.kill(); process.exit(0); });
  process.on("SIGTERM", () => { tui.kill(); server.kill(); process.exit(0); });
});
