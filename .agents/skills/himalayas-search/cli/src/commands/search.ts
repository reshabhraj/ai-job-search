import {
  PAGE_SIZE,
  SEARCH_PATH,
  apiGet,
  matchesAllTerms,
  queryTerms,
  toResult,
  withinDays,
  writeError,
  type JobResult,
  type SearchResponse,
} from "../helpers.js"

export const SORT_ORDERS = ["recent", "relevant", "salaryAsc", "salaryDesc", "nameAToZ", "nameZToA", "jobs"] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

export interface SearchOpts {
  query?: string
  country?: string
  worldwide: boolean
  seniority: string[]
  employmentType: string[]
  company: string[]
  sort: SortOrder
  jobage: number // 9999 = no window
  page: number
  maxPages: number
  limit?: number
  strict: boolean
  format: "json" | "table" | "plain"
}

function buildPath(opts: SearchOpts, page: number): string {
  const p = new URLSearchParams()
  if (opts.query) p.set("q", opts.query)
  if (opts.country) p.set("country", opts.country)
  if (opts.worldwide) p.set("worldwide", "true")
  if (opts.seniority.length) p.set("seniority", opts.seniority.join(","))
  if (opts.employmentType.length) p.set("employment_type", opts.employmentType.join(","))
  if (opts.company.length) p.set("company", opts.company.join(","))
  p.set("sort", opts.sort)
  p.set("page", String(page))
  return `${SEARCH_PATH}?${p.toString()}`
}

function shortDate(date: string | null): string {
  return date ?? "—"
}

interface Column {
  header: string
  width: number
  cell: (r: JobResult) => string
}

// The ID column is sized to the longest id so it is never truncated - a cut id
// cannot be passed to `detail`; the other columns truncate for scanning.
function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const columns: Column[] = [
    { header: "ID", width: Math.max(2, ...rows.map((r) => r.id.length)), cell: (r) => r.id },
    { header: "TITLE", width: 38, cell: (r) => r.title },
    { header: "COMPANY", width: 20, cell: (r) => r.company ?? "—" },
    { header: "LOCATION", width: 22, cell: (r) => r.location ?? "—" },
    { header: "DATE", width: 10, cell: (r) => shortDate(r.date) },
  ]
  const row = (cells: string[]) =>
    cells.map((c, i) => c.slice(0, columns[i].width).padEnd(columns[i].width)).join("  ")
  const header = row(columns.map((c) => c.header))
  const body = rows.map((r) => row(columns.map((c) => c.cell(r))))
  return [header, "-".repeat(header.length), ...body].join("\n")
}

function renderPlain(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  return rows
    .map((r) =>
      [
        r.title,
        `  ${r.company ?? "—"} · ${r.location ?? "—"} · ${shortDate(r.date)}${r.employment_type ? ` · ${r.employment_type}` : ""}`,
        `  id: ${r.id}`,
        `  ${r.url}`,
      ].join("\n"),
    )
    .join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const terms = opts.strict && opts.query ? queryTerms(opts.query) : []
    const collected: JobResult[] = []
    const seen = new Set<string>()
    let total: number | null = null
    let pagesRead = 0

    for (let page = opts.page; page < opts.page + opts.maxPages; page++) {
      const resp = await apiGet<SearchResponse>(buildPath(opts, page))
      if (!resp) {
        writeError(`${SEARCH_PATH} not found - the Himalayas API may have moved; check url-reference.md`, "SEARCH_FAILED")
        return 1
      }
      pagesRead++
      const jobs = resp.jobs ?? []
      if (typeof resp.totalCount === "number") total = resp.totalCount
      if (jobs.length === 0) break

      for (const j of jobs) {
        if (!withinDays(j, opts.jobage)) continue
        if (!matchesAllTerms(j, terms)) continue
        const r = toResult(j)
        if (seen.has(r.id)) continue
        seen.add(r.id)
        collected.push(r)
      }
      if (opts.limit !== undefined && collected.length >= opts.limit) break
      if (jobs.length < PAGE_SIZE - 5) break // a short page is the last page
    }

    const rows = opts.limit !== undefined ? collected.slice(0, opts.limit) : collected

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(rows) + "\n")
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: rows.length, page: opts.page, pages_read: pagesRead, total }, results: rows },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
