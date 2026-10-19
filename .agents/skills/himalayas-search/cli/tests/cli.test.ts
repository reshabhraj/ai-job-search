import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers"

// Live smoke tests hit the real site, so they are opt-in: PORTAL_LIVE_TESTS=1 bun test.
// CI and default runs skip them (network-flaky, and the site is for personal use).
const liveDescribe = process.env.PORTAL_LIVE_TESTS === "1" ? describe : describe.skip

interface SearchOut {
  meta: { count: number; page: number; pages_read: number; total: number | null }
  results: Array<{ id: string; title: string; company: string | null; location: string | null; date: string | null; url: string }>
}

// Volume stays at a handful of requests.
liveDescribe("himalayas-cli search (live)", () => {
  test("returns results with the contract fields", async () => {
    const out = parseJSON<SearchOut>(await runCLI(["search", "-q", "engineer", "--limit", "5"]))
    expect(out.meta.count).toBeGreaterThan(0)
    expect(out.results.length).toBeLessThanOrEqual(5)
    for (const r of out.results) {
      expect(r.id).toMatch(/^[^/]+\/[^/]+$/)
      expect(r.title.length).toBeGreaterThan(0)
      expect(r.url).toMatch(/^https:\/\/himalayas\.app\//)
      expect("company" in r && "location" in r && "date" in r).toBe(true)
    }
  })

  test("--strict keeps only all-words matches", async () => {
    const out = parseJSON<SearchOut>(await runCLI(["search", "-q", "engineer", "--strict", "--limit", "5"]))
    for (const r of out.results) {
      expect(r.title.toLowerCase() + " " + JSON.stringify(r).toLowerCase()).toContain("engineer")
    }
  })

  test("table format renders a header", async () => {
    const res = await runCLI(["search", "-q", "engineer", "--limit", "3", "--format", "table"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout.split("\n")[0]).toContain("TITLE")
  })
})

liveDescribe("himalayas-cli detail (live)", () => {
  test("resolves the first search hit", async () => {
    const out = parseJSON<SearchOut>(await runCLI(["search", "-q", "engineer", "--limit", "1"]))
    expect(out.results.length).toBe(1)
    const res = await runCLI(["detail", out.results[0].id, "--format", "plain"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("URL: https://himalayas.app/")
    expect(res.stdout).toContain("Source: Himalayas")
  })
})

describe("himalayas-cli argument validation", () => {
  test("bogus flag exits 1 with JSON on stderr", async () => {
    const res = await runCLI(["search", "--bogus", "x"])
    expect(res.exitCode).toBe(1)
    expect(res.stdout).toBe("")
    expect(JSON.parse(res.stderr).code).toBe("UNKNOWN_FLAG")
  })

  test("detail without an id exits 1", async () => {
    const res = await runCLI(["detail"])
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("NO_ID")
  })

  test("detail rejects a non-Himalayas URL", async () => {
    const res = await runCLI(["detail", "https://example.com/companies/x/jobs/y"])
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("BAD_ID")
  })

  test("bad --sort exits 1", async () => {
    const res = await runCLI(["search", "--sort", "sideways"])
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("BAD_ARG")
  })
})
