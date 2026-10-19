import {
  PAGE_SIZE,
  SEARCH_PATH,
  apiGet,
  jobSlug,
  normalizeId,
  toDetail,
  writeError,
  type HimalayasJob,
  type JobDetailResult,
  type SearchResponse,
} from "../helpers.js"

export interface DetailOpts {
  id: string // <company>/<job>, a companies/<c>/jobs/<j> path, or a himalayas.app URL
  format: "json" | "plain"
}

/** How many company pages to scan when resolving a job slug (20 jobs each). */
const MAX_COMPANY_PAGES = 5

/**
 * The job pages on himalayas.app answer 403 to non-browser clients, so a job is
 * resolved through the API: list the company's jobs and match the slug.
 */
async function findJob(company: string, job: string): Promise<HimalayasJob | null> {
  for (let page = 1; page <= MAX_COMPANY_PAGES; page++) {
    const p = new URLSearchParams({ company, page: String(page) })
    const resp = await apiGet<SearchResponse>(`${SEARCH_PATH}?${p.toString()}`)
    const jobs = resp?.jobs ?? []
    const hit = jobs.find((j) => jobSlug(j) === job)
    if (hit) return hit
    if (jobs.length < PAGE_SIZE - 5) break
  }
  return null
}

function renderPlain(job: JobDetailResult): string {
  const lines = [job.title, `${job.company ?? "—"} · ${job.location ?? "—"}`]
  const field = (label: string, value: string | null) => {
    if (value) lines.push(`${label}: ${value}`)
  }
  field("Posted", job.date)
  field("Expires", job.expires)
  field("Employment", job.employment_type)
  field("Seniority", job.seniority.length ? job.seniority.join(", ") : null)
  field("Salary", job.salary)
  field("Timezones", job.timezones)
  field("Categories", job.categories.length ? job.categories.join(", ") : null)
  lines.push("", job.description ?? "(no description)", "", `URL: ${job.url}`, `id: ${job.id}`, "Source: Himalayas")
  return lines.join("\n")
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const ref = normalizeId(opts.id)
  if (!ref) {
    writeError(
      `could not parse a Himalayas job from "${opts.id}" - pass <company-slug>/<job-slug> or a himalayas.app job URL`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const hit = await findJob(ref.company, ref.job)
    if (!hit) {
      writeError(`job ${ref.company}/${ref.job} not found (expired postings leave the API)`, "NOT_FOUND")
      return 1
    }
    const job = toDetail(hit)
    if (opts.format === "plain") {
      process.stdout.write(renderPlain(job) + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
