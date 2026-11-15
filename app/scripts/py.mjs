#!/usr/bin/env node
// Run Python cross-platform: `node scripts/py.mjs [--system] <python args...>`.
// Uses the map-data venv (app/.venv/bin/python, or app/.venv/Scripts/python.exe on Windows) when it
// exists, else the first working `python3` or `python` on PATH. `--system` skips the venv (for steps
// that need only the standard library). Runs in the current directory and exits with Python's code.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const system = args[0] === "--system";
if (system) args.shift();

const venv = join(dirname(fileURLToPath(import.meta.url)), "..", ".venv");
const venvPython = process.platform === "win32" ? join(venv, "Scripts", "python.exe") : join(venv, "bin", "python");

function findPython() {
  if (!system && existsSync(venvPython)) return venvPython;
  // Probe, since Windows may have a `python3` that only opens the Microsoft Store.
  for (const cmd of ["python3", "python"]) {
    const r = spawnSync(cmd, ["-c", "import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)"], { stdio: "ignore" });
    if (r.status === 0) return cmd;
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error("py.mjs: no Python 3 found (looked for app/.venv, python3 and python on PATH).");
  process.exit(1);
}
const r = spawnSync(python, args, { stdio: "inherit" });
if (r.error) {
  console.error(`py.mjs: could not run ${python}: ${r.error.message}`);
  process.exit(1);
}
if (r.signal) process.kill(process.pid, r.signal);
process.exit(r.status ?? 1);
