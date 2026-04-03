import { afterAll, afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { pathToFileURL } from "url"
import { tmpdir } from "../fixture/fixture"

const disableDefault = process.env.OPENCODE_DISABLE_DEFAULT_PLUGINS
process.env.OPENCODE_DISABLE_DEFAULT_PLUGINS = "1"

const { Plugin } = await import("../../src/plugin/index")
const { Instance } = await import("../../src/project/instance")

afterAll(() => {
  if (disableDefault === undefined) {
    delete process.env.OPENCODE_DISABLE_DEFAULT_PLUGINS
    return
  }
  process.env.OPENCODE_DISABLE_DEFAULT_PLUGINS = disableDefault
})

afterEach(async () => {
  await Instance.disposeAll()
})

describe("plugin.aas.skeleton", () => {
  test("loads a minimal aas-core v1 server plugin", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const file = path.join(dir, "aas-plugin.ts")
        const mark = path.join(dir, "aas-plugin-called.txt")
        await Bun.write(
          file,
          [
            "const plugin = {",
            "  id: 'aas.core',",
            "  server: async () => ({",
            "    tool: {",
            "      aas_ping: {",
            "        description: 'ping bridge',",
            "        args: {},",
            "        execute: async () => 'pong',",
            "      },",
            "    },",
            `    config: async () => { await Bun.write(${JSON.stringify(mark)}, 'ok') },`,
            "  }),",
            "}",
            "export default plugin",
            "",
          ].join("\n"),
        )

        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({ plugin: [pathToFileURL(file).href] }, null, 2),
        )
        return { mark }
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hooks = await Plugin.list()
        expect(hooks.length).toBeGreaterThan(0)
        const tool = hooks.flatMap((x) => Object.keys(x.tool ?? {}))
        expect(tool).toContain("aas_ping")
      },
    })

    expect(await Bun.file(tmp.extra.mark).text()).toBe("ok")
  })
})
