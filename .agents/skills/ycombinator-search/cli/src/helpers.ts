// Data source: Y Combinator's public "Work at a Startup" pages on
// ycombinator.com. Each page is an Inertia.js app that embeds its data as JSON
// in a `data-page` attribute, so there is no HTML card parsing: we decode that
// attribute and reshape `props.jobPostings` (listings) / `props.job` (detail).
// No authentication; robots.txt allows these paths. The listing has no
// free-text search (only role and location pages), so --query filters
// client-side. Personal use only: keep volume low.

export const BASE_URL = "https://www.ycombinator.com"

export const ROLE_SLUGS = [
  "software-engineer", "designer", "product-manager", "recruiting-hr", "sales-manager",
  "marketing", "support", "operations", "science",
] as const
export const LOCATION_SLUGS = [
  "san-francisco", "new-york", "los-angeles", "seattle", "boston", "austin", "chicago", "india", "remote",
] as const

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; ycombinator-search-cli/1.0)"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
      })
    } catch (e) {
      throw new Error(`could not reach ycombinator.com (${e instanceof Error ? e.message : String(e)})`)
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      await new Promise((r) => setTimeout(r, delay + Math.floor(Math.random() * 500)))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
}

export interface DataPage {
  component: string
  props: Record<string, unknown>
}

/** The Inertia `data-page` JSON embedded in every ycombinator.com page. */
export function extractDataPage(html: string): DataPage | null {
  const m = html.match(/data-page="([^"]*)"/)
  if (!m) return null
  try {
    const parsed = JSON.parse(decodeHtmlEntities(m[1])) as DataPage
    return parsed && typeof parsed === "object" && parsed.props ? parsed : null
  } catch {
    return null
  }
}

/** A job posting as the listing and job pages serialize it - the fields we read. */
export interface YcJobPosting {
  id?: string | number
  title?: string
  url?: string
  applyUrl?: string
  location?: string
  type?: string
  role?: string
  roleSpecificType?: string
  prettyRole?: string
  salaryRange?: string
  equityRange?: string
  minExperience?: string
  minSchoolYear?: string
  visa?: string
  skills?: string[]
  companyUrl?: string
  companyName?: string
  companyBatchName?: string
  companyOneLiner?: string
  hiringManager?: unknown
  createdAt?: string
  lastActive?: string
  description?: string
  interview_process?: string
}

export interface YcCompany {
  slug?: string
  name?: string
  batch_name?: string
  one_liner?: string
  website?: string
  team_size?: number | string
  location?: string
  country?: string
  tags?: string[]
  year_founded?: number | string
}

/**
 * A search result in the portal-skill contract shape. `id` is
 * `<company-slug>/<code>` (what `detail` consumes); `date` is derived from YC's
 * relative age and flagged approximate. Missing values are `null`, never omitted.
 */
export interface JobResult {
  id: string
  title: string
  company: string | null
  company_slug: string | null
  location: string | null
  date: string | null
  date_is_approximate: boolean
  posted: string | null
  url: string
  apply_url: string | null
  employment_type: string | null
  role: string | null
  role_detail: string | null
  salary: string | null
  equity: string | null
  min_experience: string | null
  visa: string | null
  skills: string[]
  batch: string | null
  company_one_liner: string | null
  yc_id: string | null
}

export interface JobDetailResult extends JobResult {
  description: string | null
  interview_process: string | null
  last_active: string | null
  company_website: string | null
  company_team_size: string | null
  company_location: string | null
  company_tags: string[]
  company_founded: string | null
}

/** "18 days" / "3 months" / "about 5 years" / "over 2 years" -> approximate days. */
export function relativeToDays(text: string | null | undefined): number | null {
  if (!text) return null
  const t = text.toLowerCase()
  if (/today|just now|hour|minute/.test(t)) return 0
  const m = t.match(/(\d+)\s*(day|week|month|year)/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  const mult: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 }
  return n * (mult[m[2]] ?? 1)
}

export function approxDate(text: string | null | undefined): string | null {
  const days = relativeToDays(text)
  if (days === null) return null
  return new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10)
}

/** Parse `/companies/<company>/jobs/<code>-<title-slug>` into its parts. */
export function parseJobPath(path: string | null | undefined): { company: string; code: string; slug: string } | null {
  if (!path) return null
  const m = path.match(/\/companies\/([^/]+)\/jobs\/([^/?#]+)/)
  if (!m) return null
  const seg = m[2]
  const dash = seg.indexOf("-")
  return { company: m[1], code: dash === -1 ? seg : seg.slice(0, dash), slug: seg }
}

function nonEmpty(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

export function toResult(j: YcJobPosting): JobResult {
  const parts = parseJobPath(j.url)
  const companySlug = parts?.company ?? (j.companyUrl ? j.companyUrl.replace(/^\/companies\//, "").split(/[/?#]/)[0] : null)
  const url = j.url ? (j.url.startsWith("http") ? j.url : `${BASE_URL}${j.url}`) : ""
  return {
    id: parts ? `${parts.company}/${parts.code}` : `${companySlug ?? "unknown"}/${j.id ?? ""}`,
    title: nonEmpty(j.title) ?? "(untitled)",
    company: nonEmpty(j.companyName),
    company_slug: companySlug || null,
    location: nonEmpty(j.location),
    date: approxDate(j.createdAt),
    date_is_approximate: true,
    posted: nonEmpty(j.createdAt),
    url,
    apply_url: nonEmpty(j.applyUrl),
    employment_type: nonEmpty(j.type),
    role: nonEmpty(j.prettyRole) ?? nonEmpty(j.role),
    role_detail: nonEmpty(j.roleSpecificType),
    salary: nonEmpty(j.salaryRange),
    equity: nonEmpty(j.equityRange),
    min_experience: nonEmpty(j.minExperience),
    visa: nonEmpty(j.visa),
    skills: Array.isArray(j.skills) ? j.skills.filter((s): s is string => typeof s === "string") : [],
    batch: nonEmpty(j.companyBatchName),
    company_one_liner: nonEmpty(j.companyOneLiner),
    yc_id: j.id != null ? String(j.id) : null,
  }
}

export function toDetail(j: YcJobPosting, c: YcCompany | null): JobDetailResult {
  const base = toResult(j)
  return {
    ...base,
    company: base.company ?? nonEmpty(c?.name),
    company_slug: base.company_slug ?? nonEmpty(c?.slug),
    batch: base.batch ?? nonEmpty(c?.batch_name),
    company_one_liner: base.company_one_liner ?? nonEmpty(c?.one_liner),
    description: nonEmpty(j.description),
    interview_process: nonEmpty(j.interview_process),
    last_active: nonEmpty(j.lastActive),
    company_website: nonEmpty(c?.website),
    company_team_size: c?.team_size != null ? String(c.team_size) : null,
    company_location: nonEmpty(c?.location),
    company_tags: Array.isArray(c?.tags) ? c!.tags!.filter((t): t is string => typeof t === "string") : [],
    company_founded: c?.year_founded != null ? String(c.year_founded) : null,
  }
}

/**
 * Accept `<company>/<code>`, `<company>/<code>-<slug>`, a
 * `/companies/<company>/jobs/<code>...` path, or a full ycombinator.com URL. Any
 * other host is rejected so an unrelated apply link is never looked up.
 */
export function normalizeId(input: string): { company: string; seg: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed) || /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(trimmed)) {
    let parsed: URL
    try {
      parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    } catch {
      return null
    }
    if (!/(^|\.)ycombinator\.com$/i.test(parsed.hostname)) return null
    const p = parseJobPath(parsed.pathname)
    return p ? { company: p.company, seg: p.slug } : null
  }

  const p = parseJobPath(trimmed.startsWith("/") ? trimmed : `/${trimmed}`)
  if (p && /^\/?companies\//.test(trimmed)) return { company: p.company, seg: p.slug }

  const pair = trimmed.match(/^([a-z0-9][a-z0-9_-]*)\/([A-Za-z0-9][A-Za-z0-9_-]*)$/i)
  return pair ? { company: pair[1], seg: pair[2] } : null
}

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

/** True when every query word appears in the listing's searchable text. */
export function matchesAllTerms(j: YcJobPosting, terms: string[]): boolean {
  if (terms.length === 0) return true
  const hay = [j.title, j.companyName, j.companyOneLiner, j.roleSpecificType, j.location, ...(j.skills ?? [])]
    .filter((x): x is string => typeof x === "string")
    .join("\n")
  return terms.every((t) => termRegex(t).test(hay))
}

export function withinDays(j: YcJobPosting, days: number): boolean {
  if (!days || days <= 0 || days >= 9999) return true
  const age = relativeToDays(j.createdAt)
  return age !== null && age <= days
}

/** Listing URL for a role/location combination and page. */
export function listingUrl(role: string, location: string | undefined, page: number): string {
  const q = page > 1 ? `?page=${page}` : ""
  if (role === "all") {
    return location ? `${BASE_URL}/jobs/location/${location}${q}` : `${BASE_URL}/jobs`
  }
  return location ? `${BASE_URL}/jobs/role/${role}/${location}${q}` : `${BASE_URL}/jobs/role/${role}${q}`
}
