import {
  extractDataPage,
  htmlFetch,
  listingUrl,
  matchesAllTerms,
  queryTerms,
  toResult,
  withinDays,
  writeError,
  type JobResult,
  type YcJobPosting,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  role: string // a ROLE_SLUGS entry or "all"
  location?: string // a LOCATION_SLUGS entry
  jobage: number // 9999 = no window
  page: number
  maxPages: number
  limit?: number
  format: "json" | "table" | "plain"
}

interface Column {
  header: string
  width: number
  cell: (r: JobResult) => string
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const columns: Column[] = [
    { header: "ID", width: Math.max(2, ...rows.map((r) => r.id.length)), cell: (r) => r.id },
    { header: "TITLE", width: 34, cell: (r) => r.title },
    { header: "COMPANY", width: 18, cell: (r) => r.company ?? "—" },
    { header: "LOCATION", width: 22, cell: (r) => r.location ?? "—" },
    { header: "POSTED", width: 10, cell: (r) => r.posted ?? "—" },
    { header: "VISA", width: 22, cell: (r) => r.visa ?? "—" },
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
        `  ${r.company ?? "—"} · ${r.location ?? "—"} · posted ${r.posted ?? "—"} ago${r.salary ? ` · ${r.salary}` : ""}${r.visa ? ` · ${r.visa}` : ""}`,
        `  id: ${r.id}`,
        `  ${r.url}`,
      ].join("\n"),
    )
    .join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const terms = opts.query ? queryTerms(opts.query) : []
    const collected: JobResult[] = []
    const seen = new Set<string>()
    let pagesRead = 0
    // The landing page (`--role all` without a location) has no pagination.
    const maxPages = opts.role === "all" && !opts.location ? 1 : opts.maxPages

    for (let page = opts.page; page < opts.page + maxPages; page++) {
      const html = await htmlFetch(listingUrl(opts.role, opts.location, page))
      if (!html) {
        if (pagesRead === 0) {
          writeError(
            `listing page not found for role "${opts.role}"${opts.location ? ` in "${opts.location}"` : ""} - check the slugs in --help`,
            "NOT_FOUND",
          )
          return 1
        }
        break
      }
      const dp = extractDataPage(html)
      if (!dp) {
        writeError("could not find the data-page JSON on the listing page - ycombinator.com may have changed its markup (see url-reference.md)", "PARSE_FAILED")
        return 1
      }
      pagesRead++
      const postings = (dp.props.jobPostings as YcJobPosting[] | undefined) ?? []
      let added = 0
      for (const j of postings) {
        if (!withinDays(j, opts.jobage)) continue
        if (!matchesAllTerms(j, terms)) continue
        const r = toResult(j)
        if (seen.has(r.id)) continue
        seen.add(r.id)
        collected.push(r)
        added++
      }
      if (opts.limit !== undefined && collected.length >= opts.limit) break
      // A page past the end repeats earlier jobs; an empty page is the end too.
      if (postings.length === 0) break
      if (added === 0 && terms.length === 0 && opts.jobage >= 9999) break
    }

    const rows = opts.limit !== undefined ? collected.slice(0, opts.limit) : collected

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(rows) + "\n")
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: { count: rows.length, page: opts.page, pages_read: pagesRead, role: opts.role, location: opts.location ?? null },
            results: rows,
          },
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
