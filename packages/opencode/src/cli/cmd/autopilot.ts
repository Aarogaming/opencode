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

export const AutopilotCommand = cmd({
  command: "autopilot",
  describe: "run an unattended autopilot loop (AAS extension)",
  builder: (yargs: Argv) => {
    return yargs
      .option("runner", {
        describe: "path to a runner script (defaults to AAS repo-local autopilot)",
        type: "string",
      })
      .option("python", {
        describe: "python executable to run the runner (default: python)",
        type: "string",
      })
      .option("state", {
        describe: "path to autopilot state JSON",
        type: "string",
      })
      .option("time-budget-min", {
        describe: "time budget in minutes",
        type: "number",
        default: 60,
      })
      .option("iterations", {
        describe: "maximum iterations (optional)",
        type: "number",
      })
      .option("review", {
        describe: "enable drift review pass",
        type: "boolean",
        default: true,
      })
      .option("llm-base-url", {
        describe: "LLM base URL (OpenAI-compatible)",
        type: "string",
      })
      .option("llm-token", {
        describe: "LLM token (or Local Agent Host token)",
        type: "string",
      })
      .option("exec-mode", {
        describe: "execution backend: local | local_agent",
        type: "string",
      })
      .option("exec-base-url", {
        describe: "Local Agent Host base URL for exec backend",
        type: "string",
      })
      .option("exec-token", {
        describe: "Local Agent Host token for exec backend",
        type: "string",
      })
  },
  handler: async (args) => {
    const cwd = process.cwd()
    const defaultRunner = path.join(cwd, "tools", "opencode_autopilot", "autopilot.py")
    const runner = (args.runner as string | undefined) || (exists(defaultRunner) ? defaultRunner : "")
    if (!runner) {
      UI.error("No autopilot runner found. Provide --runner or run inside an AAS repo.")
      process.exitCode = 2
      return
    }

    const python = (args.python as string | undefined) || process.env.OPENCODE_AUTOPILOT_PYTHON || "python"
    const state =
      (args.state as string | undefined) ||
      (exists(path.join(cwd, ".opencode", "states", "refactor_web_server.state.json"))
        ? path.join(cwd, ".opencode", "states", "refactor_web_server.state.json")
        : path.join(cwd, ".opencode", "autopilot_state.template.json"))

    const env = { ...process.env }
    env.OPENCODE_AUTOPILOT_REVIEW = args.review ? "1" : "0"

    if (args["llm-base-url"]) env.OPENCODE_AUTOPILOT_BASE_URL = String(args["llm-base-url"])
    if (args["llm-token"]) env.OPENCODE_AUTOPILOT_LLM_TOKEN = String(args["llm-token"])
    if (args["exec-mode"]) env.OPENCODE_AUTOPILOT_EXEC_MODE = String(args["exec-mode"])
    if (args["exec-base-url"]) env.OPENCODE_AUTOPILOT_EXEC_BASE_URL = String(args["exec-base-url"])
    if (args["exec-token"]) env.OPENCODE_AUTOPILOT_EXEC_TOKEN = String(args["exec-token"])

    const cmdArgs = [runner, "--state", state, "--time-budget-min", String(args["time-budget-min"])]
    if (args.iterations) cmdArgs.push("--iterations", String(args.iterations))

    UI.println("Running autopilot runner:")
    UI.println(`  ${python} ${cmdArgs.map((x) => JSON.stringify(x)).join(" ")}`)

    const child = spawn(python, cmdArgs, {
      cwd,
      env,
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
