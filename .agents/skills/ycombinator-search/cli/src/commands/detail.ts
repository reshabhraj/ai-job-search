import {
  BASE_URL,
  extractDataPage,
  htmlFetch,
  normalizeId,
  toDetail,
  writeError,
  type JobDetailResult,
  type YcCompany,
  type YcJobPosting,
} from "../helpers.js"

export interface DetailOpts {
  id: string // <company>/<code>, a /companies/<c>/jobs/<code>... path, or a ycombinator.com URL
  format: "json" | "plain"
}

function renderPlain(job: JobDetailResult): string {
  const lines = [job.title, `${job.company ?? "—"} · ${job.location ?? "—"}`]
  const field = (label: string, value: string | null) => {
    if (value) lines.push(`${label}: ${value}`)
  }
  field("Posted", job.posted ? `${job.posted} ago (about ${job.date})` : null)
  field("Employment", job.employment_type)
  field("Role", [job.role, job.role_detail].filter(Boolean).join(" / ") || null)
  field("Salary", job.salary)
  field("Equity", job.equity)
  field("Experience", job.min_experience)
  field("Visa", job.visa)
  field("Skills", job.skills.length ? job.skills.join(", ") : null)
  field("Company", [job.batch, job.company_one_liner].filter(Boolean).join(" · ") || null)
  field("Website", job.company_website)
  field("Team size", job.company_team_size)
  field("HQ", job.company_location)
  lines.push("", job.description ?? "(no description)")
  if (job.interview_process) lines.push("", "Interview process:", job.interview_process)
  lines.push("", `URL: ${job.url}`, `id: ${job.id}`)
  return lines.join("\n")
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const ref = normalizeId(opts.id)
  if (!ref) {
    writeError(
      `could not parse a YC job from "${opts.id}" - pass <company-slug>/<job-code> or a ycombinator.com job URL`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await htmlFetch(`${BASE_URL}/companies/${ref.company}/jobs/${ref.seg}`)
    if (!html) {
      writeError(`job ${ref.company}/${ref.seg} not found`, "NOT_FOUND")
      return 1
    }
    const dp = extractDataPage(html)
    const posting = dp?.props.job as YcJobPosting | undefined
    if (!dp || !posting) {
      writeError("could not find the job data on the page - ycombinator.com may have changed its markup (see url-reference.md)", "PARSE_FAILED")
      return 1
    }
    const company = (dp.props.company as YcCompany | undefined) ?? null
    const job = toDetail(posting, company)

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
