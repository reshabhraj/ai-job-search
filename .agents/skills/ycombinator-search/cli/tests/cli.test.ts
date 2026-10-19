import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers"

// Live smoke tests hit the real site, so they are opt-in: PORTAL_LIVE_TESTS=1 bun test.
// CI and default runs skip them (network-flaky, and the site is for personal use).
const liveDescribe = process.env.PORTAL_LIVE_TESTS === "1" ? describe : describe.skip

interface SearchOut {
  meta: { count: number; page: number; pages_read: number; role: string; location: string | null }
  results: Array<{
    id: string
    title: string
    company: string | null
    location: string | null
    date: string | null
    url: string
    visa: string | null
  }>
}

// Volume stays at a handful of requests.
liveDescribe("ycombinator-cli search (live)", () => {
  test("returns results with the contract fields", async () => {
    const out = parseJSON<SearchOut>(await runCLI(["search", "--limit", "5"]))
    expect(out.meta.count).toBeGreaterThan(0)
    expect(out.results.length).toBeLessThanOrEqual(5)
    for (const r of out.results) {
      expect(r.id).toMatch(/^[^/]+\/[^/]+$/)
      expect(r.title.length).toBeGreaterThan(0)
      expect(r.url).toMatch(/^https:\/\/www\.ycombinator\.com\/companies\//)
      expect("company" in r && "location" in r && "date" in r && "visa" in r).toBe(true)
    }
  })

  test("--query filters client-side", async () => {
    const out = parseJSON<SearchOut>(await runCLI(["search", "-q", "engineer", "--limit", "5"]))
    for (const r of out.results) {
      expect(JSON.stringify(r).toLowerCase()).toContain("engineer")
    }
  })

  test("table format renders a header", async () => {
    const res = await runCLI(["search", "--remote", "--limit", "3", "--format", "table"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout.split("\n")[0]).toContain("VISA")
  })
})

liveDescribe("ycombinator-cli detail (live)", () => {
  test("resolves the first search hit", async () => {
    const out = parseJSON<SearchOut>(await runCLI(["search", "--limit", "1"]))
    expect(out.results.length).toBe(1)
    const res = await runCLI(["detail", out.results[0].id, "--format", "plain"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("URL: https://www.ycombinator.com/companies/")
    expect(res.stdout.length).toBeGreaterThan(200)
  })
})

describe("ycombinator-cli argument validation", () => {
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

  test("detail rejects a non-YC URL", async () => {
    const res = await runCLI(["detail", "https://example.com/companies/x/jobs/y-z"])
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("BAD_ID")
  })

  test("bad --role exits 1", async () => {
    const res = await runCLI(["search", "--role", "astronaut"])
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("BAD_ARG")
  })
})
