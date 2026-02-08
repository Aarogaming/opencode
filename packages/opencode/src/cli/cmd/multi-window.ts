import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { spawn } from "child_process"
import fs from "fs"
import path from "path"
import { UI } from "../ui"

function exists(p: string) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

export const MultiWindowCommand = cmd({
  command: "multi-window",
  describe: "spawn a multi-window editor session (AAS extension)",
  builder: (yargs: Argv) => {
    return yargs
      .option("script", {
        describe: "path to multi-window runner script (defaults to AAS multi_window.py)",
        type: "string",
      })
      .option("python", {
        describe: "python executable to run the script (default: .venv/Scripts/python if present)",
        type: "string",
      })
      .option("session-id", {
        describe: "session id",
        type: "string",
      })
      .option("count", {
        describe: "number of windows",
        type: "number",
        default: 2,
      })
      .option("editor", {
        describe: "editor binary (e.g. code, code-insiders)",
        type: "string",
        default: "code",
      })
      .option("workspace", {
        describe: "workspace path",
        type: "string",
        default: ".",
      })
      .option("mode", {
        describe: "parallel or sequential",
        type: "string",
        default: "parallel",
      })
      .option("width", { type: "number", default: 960 })
      .option("height", { type: "number", default: 1080 })
      .option("start-x", { type: "number", default: 0 })
      .option("start-y", { type: "number", default: 0 })
      .option("extensions", {
        describe: "comma-separated VSCode extension IDs",
        type: "string",
        default: "",
      })
      .option("contract", {
        describe: "path to a MultiWindowOrchestration JSON contract",
        type: "string",
      })
      .option("log", {
        describe: "log file",
        type: "string",
      })
      .option("dry-run", {
        describe: "print contract JSON and exit",
        type: "boolean",
        default: false,
      })
      .option("run-contracts", {
        describe: "run per-window contract_path via tools/opencode_adapter",
        type: "boolean",
        default: false,
      })
      .option("contract-agent-chain", {
        describe: "comma-separated agent chain for opencode_adapter (e.g. 'autopilot')",
        type: "string",
      })
      .option("adapter-python", {
        describe: "python executable for opencode_adapter (default: current python)",
        type: "string",
      })
      .option("adapter-path", {
        describe: "path to tools/opencode_adapter/opencode_adapter.py",
        type: "string",
      })
  },
  handler: async (args) => {
    const cwd = process.cwd()
    const defaultScript = path.join(cwd, "tools", "opencode_adapter", "plugins", "multi_window.py")
    const script = (args.script as string | undefined) || (exists(defaultScript) ? defaultScript : "")
    if (!script) {
      UI.error("No multi-window script found. Provide --script or run inside an AAS repo.")
      process.exitCode = 2
      return
    }

    const defaultVenvPy = path.join(cwd, ".venv", "Scripts", "python")
    const python =
      (args.python as string | undefined) ||
      process.env.OPENCODE_AUTOPILOT_PYTHON ||
      (exists(defaultVenvPy) ? defaultVenvPy : "python")

    const cmdArgs: string[] = [script]
    if (args.contract) cmdArgs.push("--contract", String(args.contract))
    if (args["session-id"]) cmdArgs.push("--session-id", String(args["session-id"]))
    cmdArgs.push("--count", String(args.count))
    cmdArgs.push("--editor", String(args.editor))
    cmdArgs.push("--workspace", String(args.workspace))
    cmdArgs.push("--mode", String(args.mode))
    cmdArgs.push("--width", String(args.width))
    cmdArgs.push("--height", String(args.height))
    cmdArgs.push("--start-x", String(args["start-x"]))
    cmdArgs.push("--start-y", String(args["start-y"]))
    if (args.extensions) cmdArgs.push("--extensions", String(args.extensions))
    if (args.log) cmdArgs.push("--log", String(args.log))
    if (args["dry-run"]) cmdArgs.push("--dry-run")
    if (args["run-contracts"]) cmdArgs.push("--run-contracts")
    if (args["contract-agent-chain"]) cmdArgs.push("--contract-agent-chain", String(args["contract-agent-chain"]))
    if (args["adapter-python"]) cmdArgs.push("--adapter-python", String(args["adapter-python"]))
    if (args["adapter-path"]) cmdArgs.push("--adapter-path", String(args["adapter-path"]))

    UI.println("Running multi-window runner:")
    UI.println(`  ${python} ${cmdArgs.map((x) => JSON.stringify(x)).join(" ")}`)

    const child = spawn(python, cmdArgs, {
      cwd,
      env: { ...process.env },
      stdio: "inherit",
    })

    await new Promise<void>((resolve) => {
      child.on("exit", (code) => {
        process.exitCode = typeof code === "number" ? code : 1
        resolve()
      })
    })
  },
})
