// Data source: the Himalayas public Remote Jobs API (JSON), documented at
// https://himalayas.app/api. Free and unauthenticated. Himalayas asks API users
// to link back to the job's Himalayas URL and name Himalayas as the source, and
// not to repost its jobs to third-party boards; this skill is search + detail
// for a personal job hunt, which is within that. The job pages themselves sit
// behind a bot filter (403 to non-browser clients, verified 2026-09-29), so
// `detail` also reads the API: filter by company slug, then match the job slug.

export const BASE_URL = "https://himalayas.app"
export const SEARCH_PATH = "/jobs/api/search"
/** Fixed by the API: `limit` is ignored on /search (verified live). */
export const PAGE_SIZE = 20

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; himalayas-search-cli/1.0)"

/** A Himalayas job as the API serializes it - the fields this skill reads. */
export interface HimalayasJob {
  title: string
  excerpt?: string | null
  companyName?: string | null
  companySlug?: string | null
  employmentType?: string | null
  minSalary?: number | null
  maxSalary?: number | null
  salaryPeriod?: string | null
  currency?: string | null
  seniority?: string[] | null
  locationRestrictions?: string[] | null
  timezoneRestrictions?: number[] | null
  categories?: string[] | null
  description?: string | null
  pubDate?: number | null
  expiryDate?: number | null
  applicationLink?: string | null
  guid?: string | null
}

export interface SearchResponse {
  updatedAt?: number
  offset?: number
  limit?: number
  totalCount?: number
  jobs?: HimalayasJob[]
}

/**
 * GET JSON from the API. Retries 429/5xx with backoff; returns `null` on a 404.
 * A connection failure fails fast with a clear message so an outage degrades
 * this source instead of hanging the caller.
 */
export async function apiGet<T>(path: string): Promise<T | null> {
  const url = `${BASE_URL}${path}`
  const maxRetries = 6
  let delay = 500

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      })
    } catch (e) {
      throw new Error(
        `could not reach the Himalayas API at ${BASE_URL} (${e instanceof Error ? e.message : String(e)})`,
      )
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Himalayas API request failed: ${response.status} ${response.statusText}`)
      }
      await sleep(delay + Math.floor(Math.random() * 500))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Himalayas API request failed: ${response.status} ${response.statusText}`)
    }
    const body = (await response.json().catch(() => null)) as T | null
    if (!body) throw new Error("Himalayas API returned an unparseable response body")
    return body
  }
  throw new Error("Himalayas API request failed after retries")
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * A search result in the portal-skill contract shape. `id` is
 * `<companySlug>/<jobSlug>` (what `detail` consumes; the API has no numeric id),
 * `date` is the posting date. Missing values are `null`, never omitted.
 */
export interface JobResult {
  id: string
  title: string
  company: string | null
  company_slug: string | null
  location: string | null
  date: string | null
  url: string
  employment_type: string | null
  seniority: string[]
  salary: string | null
  expires: string | null
  excerpt: string | null
  description: string | null
}

export interface JobDetailResult extends JobResult {
  categories: string[]
  timezones: string | null
}

/** Unix seconds -> ISO date (YYYY-MM-DD), or null. */
export function isoDate(unixSeconds: number | null | undefined): string | null {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds) || unixSeconds <= 0) return null
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

/** The job slug: the path segment after /jobs/ in the guid or application link. */
export function jobSlug(j: HimalayasJob): string | null {
  const src = j.guid || j.applicationLink || ""
  const m = src.match(/\/jobs\/([^/?#]+)/)
  return m ? m[1] : null
}

export function jobId(j: HimalayasJob): string {
  return `${j.companySlug || "unknown"}/${jobSlug(j) || ""}`
}

export function jobUrl(j: HimalayasJob): string {
  if (j.guid) return j.guid
  if (j.applicationLink) return j.applicationLink
  return `${BASE_URL}/companies/${j.companySlug || ""}/jobs/${jobSlug(j) || ""}`
}

/** Hiring-country restrictions joined, or a worldwide marker when unrestricted. */
export function formatLocation(j: HimalayasJob): string | null {
  const r = (j.locationRestrictions || []).filter((x) => typeof x === "string" && x.trim())
  if (r.length === 0) return "Worldwide (remote)"
  return r.join(", ")
}

export function formatSalary(j: HimalayasJob): string | null {
  if (j.minSalary == null && j.maxSalary == null) return null
  const cur = j.currency ? `${j.currency} ` : ""
  const period = j.salaryPeriod ? ` ${j.salaryPeriod}` : ""
  if (j.minSalary != null && j.maxSalary != null) return `${cur}${j.minSalary}–${j.maxSalary}${period}`
  return `${cur}${j.minSalary ?? j.maxSalary}${period}`
}

export function formatTimezones(j: HimalayasJob): string | null {
  const tz = (j.timezoneRestrictions || []).filter((x) => typeof x === "number")
  if (tz.length === 0) return null
  const fmt = (n: number) => (n >= 0 ? `UTC+${n}` : `UTC${n}`)
  return `${fmt(Math.min(...tz))} to ${fmt(Math.max(...tz))}`
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/**
 * Strip a description's HTML into readable prose: block/line-break tags become
 * newlines, entities are decoded, tags removed. Null for empty input.
 */
export function cleanHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d|tr)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

export function toResult(j: HimalayasJob): JobResult {
  return {
    id: jobId(j),
    title: j.title || "(untitled)",
    company: j.companyName || null,
    company_slug: j.companySlug || null,
    location: formatLocation(j),
    date: isoDate(j.pubDate),
    url: jobUrl(j),
    employment_type: j.employmentType || null,
    seniority: (j.seniority || []).filter((s) => typeof s === "string"),
    salary: formatSalary(j),
    expires: isoDate(j.expiryDate),
    excerpt: j.excerpt || null,
    description: cleanHtml(j.description),
  }
}

export function toDetail(j: HimalayasJob): JobDetailResult {
  return {
    ...toResult(j),
    categories: (j.categories || []).filter((c) => typeof c === "string"),
    timezones: formatTimezones(j),
  }
}

/**
 * Accept `<company>/<job>`, a `companies/<company>/jobs/<job>` path, or a full
 * himalayas.app URL. Any other host is rejected so an unrelated apply link can
 * never be looked up as if it were a Himalayas job.
 */
export function normalizeId(input: string): { company: string; job: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed) || /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(trimmed)) {
    let parsed: URL
    try {
      parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    } catch {
      return null
    }
    if (!/(^|\.)himalayas\.app$/i.test(parsed.hostname)) return null
    const m = parsed.pathname.match(/\/companies\/([^/]+)\/jobs\/([^/?#]+)/)
    return m ? { company: m[1], job: m[2] } : null
  }

  const path = trimmed.match(/^\/?companies\/([^/]+)\/jobs\/([^/?#]+)\/?$/)
  if (path) return { company: path[1], job: path[2] }

  const pair = trimmed.match(/^([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)$/i)
  return pair ? { company: pair[1], job: pair[2] } : null
}

/** True when the posting date is within `days` of now (unset -> always true). */
export function withinDays(j: HimalayasJob, days: number): boolean {
  if (!days || days <= 0 || days >= 9999) return true
  if (typeof j.pubDate !== "number") return false
  return Date.now() - j.pubDate * 1000 <= days * 86400 * 1000
}

/** Split a query into lowercase words (quotes stripped, one-letter words dropped). */
export function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/["']/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1)
}

/**
 * Whole-word matcher for one query term, so "ai" matches "AI engineer" but not
 * "maintain". Boundaries apply only where the term starts/ends with a word
 * character, so "c++" and ".net" still match.
 */
export function termRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const lead = /^\w/.test(term) ? "\\b" : ""
  const trail = /\w$/.test(term) ? "\\b" : ""
  return new RegExp(`${lead}${escaped}${trail}`, "i")
}

/** True when every query word appears in title, excerpt, company or description. */
export function matchesAllTerms(j: HimalayasJob, terms: string[]): boolean {
  if (terms.length === 0) return true
  const hay = [j.title, j.excerpt, j.companyName, cleanHtml(j.description)]
    .filter((x): x is string => typeof x === "string")
    .join("\n")
  return terms.every((t) => termRegex(t).test(hay))
}
