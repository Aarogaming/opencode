import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { Instance } from "@/project/instance"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { Config } from "@/config/config"
import { AASProfile } from "@/aas/profile"
import { AASDoctor } from "@/aas/doctor"

const modes = ["offline", "hybrid", "live"] as const

export const AASCommand = cmd({
  command: "aas",
  describe: "manage AAS fascia integration",
  builder: (yargs: Argv) =>
    yargs
      .command(AASInitCommand)
      .command(AASModeCommand)
      .command(AASStatusCommand)
      .command(AASDoctorCommand)
      .demandCommand(),
  async handler() {},
})

export const AASInitCommand = cmd({
  command: "init",
  describe: "initialize AAS fascia settings in global config",
  builder: (yargs: Argv) =>
    yargs
      .option("mode", {
        type: "string",
        choices: [...modes],
        default: "offline",
        describe: "initial AAS mode",
      })
      .option("bridge", {
        type: "string",
        describe: "AAS bridge endpoint URL",
      })
      .option("token", {
        type: "string",
        describe: "AAS bridge auth token",
      })
      .option("header", {
        type: "string",
        describe: "AAS auth header name",
      })
      .option("hmac", {
        type: "string",
        describe: "AAS HMAC shared key",
      })
      .option("api-token", {
        type: "string",
        describe: "AAS API auth token (middleware token)",
      })
      .option("api-header", {
        type: "string",
        describe: "AAS API auth header name",
      }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("AAS Init")
        const mode = AASProfile.mode.parse(args.mode)
        const patch = AASProfile.init({
          mode,
          bridge: args.bridge,
          token: args.token,
          header: args.header,
          hmac: args.hmac,
          api_token: args.apiToken,
          api_header: args.apiHeader,
        })
        const next = await Config.updateGlobal(patch)
        const out = AASProfile.get(next)
        prompts.log.success(`AAS enabled (${out.mode})`)
        if (out.bridge) prompts.log.info(`Bridge: ${out.bridge}`)
        if (out.auth_header) prompts.log.info(`Auth header: ${out.auth_header}`)
        if (out.has_auth_token) prompts.log.info("Auth token: configured")
        if (out.has_hmac_key) prompts.log.info("HMAC key: configured")
        if (out.api_auth_header) prompts.log.info(`API auth header: ${out.api_auth_header}`)
        if (out.has_api_token) prompts.log.info("API auth token: configured")
        prompts.outro("Done")
      },
    })
  },
})

export const AASModeCommand = cmd({
  command: "mode [value]",
  describe: "set or view AAS mode",
  builder: (yargs: Argv) =>
    yargs
      .positional("value", {
        type: "string",
        choices: [...modes],
        describe: "target mode",
      })
      .option("bridge", {
        type: "string",
        describe: "optional bridge URL update",
      })
      .option("token", {
        type: "string",
        describe: "optional auth token update",
      })
      .option("header", {
        type: "string",
        describe: "optional auth header update",
      })
      .option("hmac", {
        type: "string",
        describe: "optional HMAC key update",
      })
      .option("api-token", {
        type: "string",
        describe: "optional API auth token update",
      })
      .option("api-header", {
        type: "string",
        describe: "optional API auth header update",
      }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("AAS Mode")

        const cfg = await Config.getGlobal()
        if (!args.value) {
          const out = AASProfile.get(cfg)
          prompts.log.info(`Enabled: ${out.enabled ? "yes" : "no"}`)
          prompts.log.info(`Mode: ${out.mode}`)
          if (out.bridge) prompts.log.info(`Bridge: ${out.bridge}`)
          if (out.auth_header) prompts.log.info(`Auth header: ${out.auth_header}`)
          if (out.has_auth_token) prompts.log.info("Auth token: configured")
          if (out.has_hmac_key) prompts.log.info("HMAC key: configured")
          if (out.api_auth_header) prompts.log.info(`API auth header: ${out.api_auth_header}`)
          if (out.has_api_token) prompts.log.info("API auth token: configured")
          prompts.outro("Done")
          return
        }

        const mode = AASProfile.mode.parse(args.value)
        const patch = AASProfile.set({
          mode,
          bridge: args.bridge,
          token: args.token,
          header: args.header,
          hmac: args.hmac,
          api_token: args.apiToken,
          api_header: args.apiHeader,
        })
        const next = await Config.updateGlobal(patch)
        const out = AASProfile.get(next)
        prompts.log.success(`AAS mode set to ${out.mode}`)
        if (out.bridge) prompts.log.info(`Bridge: ${out.bridge}`)
        if (out.auth_header) prompts.log.info(`Auth header: ${out.auth_header}`)
        if (out.has_auth_token) prompts.log.info("Auth token: configured")
        if (out.has_hmac_key) prompts.log.info("HMAC key: configured")
        if (out.api_auth_header) prompts.log.info(`API auth header: ${out.api_auth_header}`)
        if (out.has_api_token) prompts.log.info("API auth token: configured")
        prompts.outro("Done")
      },
    })
  },
})

export const AASStatusCommand = cmd({
  command: "status",
  describe: "show AAS fascia status",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("AAS Status")
        const cfg = await Config.getGlobal()
        const out = AASProfile.get(cfg)
        prompts.log.info(`Enabled: ${out.enabled ? "yes" : "no"}`)
        prompts.log.info(`Mode: ${out.mode}`)
        prompts.log.info(`Bridge: ${out.bridge ?? "unset"}`)
        prompts.log.info(`Auth header: ${out.auth_header ?? "unset"}`)
        prompts.log.info(`Auth token: ${out.has_auth_token ? "configured" : "unset"}`)
        prompts.log.info(`HMAC key: ${out.has_hmac_key ? "configured" : "unset"}`)
        prompts.log.info(`API auth header: ${out.api_auth_header ?? "unset"}`)
        prompts.log.info(`API auth token: ${out.has_api_token ? "configured" : "unset"}`)
        prompts.outro("Done")
      },
    })
  },
})

export const AASDoctorCommand = cmd({
  command: "doctor",
  describe: "validate AAS bridge connectivity and protocol compatibility",
  builder: (yargs: Argv) =>
    yargs.option("timeout", {
      type: "number",
      default: 3000,
      describe: "bridge probe timeout in milliseconds",
    }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("AAS Doctor")
        const cfg = await Config.getGlobal()
        const out = await AASDoctor.run(cfg, {
          timeout: typeof args.timeout === "number" ? args.timeout : 3000,
        })

        for (const item of out.list) {
          if (item.level === "ok") {
            prompts.log.success(`${item.key}: ${item.msg}`)
            continue
          }
          if (item.level === "warn") {
            prompts.log.warn(`${item.key}: ${item.msg}`)
            continue
          }
          prompts.log.error(`${item.key}: ${item.msg}`)
        }

        if (!out.ok) process.exitCode = 1
        prompts.outro(out.ok ? "Healthy" : "Needs attention")
      },
    })
  },
})
