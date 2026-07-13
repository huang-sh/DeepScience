#!/usr/bin/env node
/**
 * DeepScience — single-command dev launcher.
 *
 * Kills stale processes on :3000 and :5175, then starts
 * the pi agent server and Vite dev server concurrently.
 *
 * Usage:  node scripts/dev.mjs   (or: npm run dev)
 */
import { spawn, execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const API_PORT = "3000";
const WEB_PORT = "5175";
const children = new Set();
let shuttingDown = false;

// ── Kill anything on our ports ──────────────────────────────────────────────
function killPort(port) {
  try {
    const pids = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: "utf-8" }).trim();
    if (pids) {
      execSync(`kill -9 ${pids.split("\n").join(" ")} 2>/dev/null`);
      console.log(`Killed stale process on :${port}`);
    }
  } catch {
    /* nothing on that port — fine */
  }
}

killPort(API_PORT);
killPort(WEB_PORT);

// ── Spawn a labelled child process ──────────────────────────────────────────

/** @param {string} label @param {string} cmd @param {string[]} args @param {string} cwd */
function start(label, cmd, args, cwd) {
  const child = spawn(cmd, args, {
    cwd: resolve(root, cwd),
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  children.add(child);

  const prefix = `[${label}]`;
  child.stdout?.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) console.log(`${prefix} ${line}`);
    }
  });
  child.stderr?.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) console.error(`${prefix} ${line}`);
    }
  });
  child.on("exit", (code) => {
    children.delete(child);
    console.log(`${prefix} exited with code ${code}`);
    if (shuttingDown) return;
    shuttingDown = true;
    for (const sibling of children) sibling.kill("SIGTERM");
    process.exitCode = code ?? 1;
  });
  return child;
}

console.log("DeepScience dev — starting server + frontend...\n");

start("api", "npx", ["tsx", "packages/server/src/index.ts"], ".");
start("web", "npx", ["vite", "--port", WEB_PORT], "packages/frontend");

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill(signal);
  process.exitCode = signal === "SIGINT" ? 130 : 143;
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
