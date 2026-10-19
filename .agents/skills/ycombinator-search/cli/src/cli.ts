#!/usr/bin/env bun
// Self-contained CLI for searching open roles at Y Combinator startups via the
// public "Work at a Startup" listing pages on ycombinator.com. No external CLI
// framework, so it runs anywhere `bun` is available with zero install beyond
// the repo clone.
//
// Personal use only. Public pages, honest User-Agent, no login; keep volume low.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { LOCATION_SLUGS, ROLE_SLUGS } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `ycombinator-cli — search open roles at Y Combinator startups (ycombinator.com/jobs)

USAGE
  bun run src/cli.ts search [-q "<keywords>"] [flags]
  bun run src/cli.ts detail <company-slug>/<job-code> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords, matched client-side against title, company, one-liner, role detail, skills.
  --role <slug>           ${ROLE_SLUGS.join(" | ")} | all. Default software-engineer.
  --location, -l <slug>   ${LOCATION_SLUGS.join(" | ")}. Other cities: put the city in --query.
  --remote                Shorthand for --location remote.
  --jobage <days>         Posted within N days (approximate: YC shows relative ages).
  --page <n>              1-indexed page (40 results per role page). Default 1.
  --max-pages <n>         Consecutive pages to read from --page. Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "AI" --remote --max-pages 2 --format table
  bun run src/cli.ts search -q "forward deployed" --max-pages 3 --format table
  bun run src/cli.ts search -q "London" --format table
  bun run src/cli.ts search --role all --remote --format table
  bun run src/cli.ts detail aviaryai/m5Dm1Qa --format plain

Personal use only — public pages on ycombinator.com; keep volume low.
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "role", "location", "remote", "jobage", "page", "max-pages", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

function boolFlag(raw: string | boolean | string[] | undefined): boolean {
  if (raw === undefined) return false
  if (raw === true) return true
  if (typeof raw === "string") return !/^(false|no|0|off)$/i.test(raw.trim())
  return false
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  // Reject unknown flags instead of silently discarding them: a discarded
  // filter changes what the search returns with no error.
  const knownFlags = KNOWN_FLAGS[cmd]
  if (knownFlags) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || knownFlags.has(key)) continue
      process.stderr.write(
        JSON.stringify({
          error: `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
          code: "UNKNOWN_FLAG",
        }) + "\n",
      )
      return 1
    }
  }

  if (cmd === "search") {
    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = typeof raw === "string" ? Number(raw.trim()) : NaN
      if (!Number.isInteger(val) || val < 1) {
        process.stderr.write(
          JSON.stringify({ error: `--${name} must be a whole number of at least 1, got "${raw}"`, code: "BAD_ARG" }) + "\n",
        )
        return null
      }
      return val
    }

    let jobage = 9999
    let page = 1
    let maxPages = 1
    let limit: number | undefined
    if (flags.jobage !== undefined) {
      const v = parseIntFlag("jobage", flags.jobage)
      if (v === null) return 1
      jobage = v
    }
    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      page = v
    }
    if (flags["max-pages"] !== undefined) {
      const v = parseIntFlag("max-pages", flags["max-pages"])
      if (v === null) return 1
      maxPages = v
    }
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      limit = v
    }

    const role = typeof flags.role === "string" ? flags.role.trim().toLowerCase() : "software-engineer"
    if (role !== "all" && !(ROLE_SLUGS as readonly string[]).includes(role)) {
      process.stderr.write(
        JSON.stringify({ error: `--role must be one of ${ROLE_SLUGS.join(", ")} or all, got "${role}"`, code: "BAD_ARG" }) + "\n",
      )
      return 1
    }

    let location = typeof flags.location === "string" ? flags.location.trim().toLowerCase() : undefined
    if (boolFlag(flags.remote)) {
      if (location && location !== "remote") {
        process.stderr.write(
          JSON.stringify({ error: "--remote and --location both set the listing location; pass only one", code: "CONFLICTING_FLAGS" }) + "\n",
        )
        return 1
      }
      location = "remote"
    }
    if (location && !(LOCATION_SLUGS as readonly string[]).includes(location)) {
      process.stderr.write(
        JSON.stringify({
          error: `--location must be one of ${LOCATION_SLUGS.join(", ")}, got "${location}" - for other places put the city in --query`,
          code: "BAD_ARG",
        }) + "\n",
      )
      return 1
    }

    const fmt = (flags.format as string) || "json"
    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      role,
      location,
      jobage,
      page,
      maxPages,
      limit,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires an <id|url>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = { id, format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"] }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), code: "INTERNAL_ERROR" }) + "\n",
    )
    process.exit(1)
  })
