#!/usr/bin/env bun
// Self-contained CLI for searching remote jobs on Himalayas (himalayas.app) via
// its free public JSON API. No external CLI framework, so it runs anywhere
// `bun` is available with zero install beyond the repo clone.
//
// Attribution: Himalayas asks API users to link back to the job's Himalayas URL
// and name Himalayas as the source, and not to repost its jobs elsewhere.

import { runSearch, SORT_ORDERS, type SearchOpts, type SortOrder } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

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

const HELP = `himalayas-cli — search remote jobs on Himalayas (himalayas.app)

USAGE
  bun run src/cli.ts search [-q "<keywords>"] [flags]
  bun run src/cli.ts detail <company-slug>/<job-slug> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>        Keywords (loosely matched by the API). Add --strict for all-words.
  --location, -l <country>  Hiring country: ISO alpha-2 (DE), name (Germany) or slug. Alias: --country.
  --worldwide               Keep only roles open to applicants anywhere.
  --seniority <list>        Comma-separated: Entry-level, Mid-level, Senior, Manager, Director, Executive.
  --employment-type <list>  Comma-separated: "Full Time", "Part Time", Contractor, Temporary, Intern, Volunteer, Other.
  --company <slugs>         Comma-separated canonical company slugs.
  --sort <order>            recent (default) | relevant | salaryAsc | salaryDesc | nameAToZ | nameZToA | jobs.
  --jobage <days>           Posted within N days (filtered client-side on pubDate).
  --strict                  Keep only results whose title/excerpt/description contain every query word.
  --page <n>                1-indexed page (20 results/page). Default 1.
  --max-pages <n>           Consecutive pages to read from --page. Default 1.
  --limit, -n <n>           Cap results emitted (client-side).
  --format <fmt>            json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "AI engineer" --strict --jobage 14 --max-pages 3 --format table
  bun run src/cli.ts search -q "analytics engineer" -l Germany --format table
  bun run src/cli.ts search -q "data engineer" --worldwide --seniority "Mid-level,Senior" --format table
  bun run src/cli.ts search --company linear --format table
  bun run src/cli.ts detail mercuryo/ai-solutions-engineer --format plain

Attribution: link back to the Himalayas URL and name Himalayas as the source (API terms).
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set([
    "query", "location", "country", "worldwide", "seniority", "employment-type", "company", "sort",
    "jobage", "strict", "page", "max-pages", "limit", "format", "help", "h",
  ]),
  detail: new Set(["format", "help", "h"]),
}

function boolFlag(raw: string | boolean | string[] | undefined): boolean {
  if (raw === undefined) return false
  if (raw === true) return true
  if (typeof raw === "string") return !/^(false|no|0|off)$/i.test(raw.trim())
  return false
}

function listFlag(raw: string | boolean | string[] | undefined): string[] {
  if (typeof raw !== "string") return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
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

    const sortRaw = typeof flags.sort === "string" ? flags.sort.trim() : "recent"
    if (!(SORT_ORDERS as readonly string[]).includes(sortRaw)) {
      process.stderr.write(
        JSON.stringify({ error: `--sort must be one of ${SORT_ORDERS.join(", ")}, got "${sortRaw}"`, code: "BAD_ARG" }) + "\n",
      )
      return 1
    }

    const fmt = (flags.format as string) || "json"
    const country =
      typeof flags.location === "string" ? flags.location : typeof flags.country === "string" ? flags.country : undefined

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      country,
      worldwide: boolFlag(flags.worldwide),
      seniority: listFlag(flags.seniority),
      employmentType: listFlag(flags["employment-type"]),
      company: listFlag(flags.company),
      sort: sortRaw as SortOrder,
      jobage,
      page,
      maxPages,
      limit,
      strict: boolFlag(flags.strict),
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
