---
name: ycombinator-search
version: 1.0.0
description: >
  Use this skill to search open roles at Y Combinator startups via the public
  "Work at a Startup" listings on ycombinator.com, or to look up a specific YC
  job posting. Global startup jobs (San Francisco, New York, London, India,
  remote and more), with salary, equity, experience and visa-sponsorship fields
  on every listing. Trigger phrases: YC jobs, Y Combinator startups hiring,
  work at a startup, startup jobs, early-stage startup roles, "forward deployed
  engineer at a YC company", founding engineer, look up this YC job posting.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/ycombinator-search/cli/src/cli.ts *)
---

# Y Combinator Jobs Search Skill

Search open roles at **Y Combinator** companies from the public "Work at a
Startup" listing pages on [ycombinator.com/jobs](https://www.ycombinator.com/jobs).
No authentication, no API key, and **zero runtime dependencies**: it runs with
just `bun`. Each listing page embeds its data as JSON, so results are structured
(salary range, equity, minimum experience, visa policy, skills) rather than
scraped from markup.

> Built with `/add-portal` on 2026-09-29. The full-text search on
> workatastartup.com sits behind a login, so this skill uses the public
> role- and location-based listing pages instead and filters keywords
> client-side.

## ⚠️ Personal use only

These are public pages on ycombinator.com, read with an honest User-Agent and
no login. Keep volume low (a few pages per run), do not use it commercially or
for bulk collection, and run it on your own responsibility.

## When to use this skill

- Find open startup roles by role category, keyword, and location (or remote)
- See salary, equity, experience bar and **visa policy** at a glance (the `visa`
  field says `Will sponsor`, `US citizen/visa only`, or `US citizenship/visa not
  required`, which feeds the Eligibility Gate)
- Get the full description of a specific YC job posting

## Commands

### Search job listings

```bash
bun run .agents/skills/ycombinator-search/cli/src/cli.ts search [-q "<keywords>"] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` - keywords. **Client-side**: the listing has no
  free-text search, so every word must appear in the title, company name, company
  one-liner, role detail or skills. Increase `--max-pages` to widen the net.
- `--role <slug>` - listing category. Default `software-engineer`. One of:
  `software-engineer`, `designer`, `product-manager`, `recruiting-hr`,
  `sales-manager`, `marketing`, `support`, `operations`, `science`, or `all`
  (all roles; with no `--location` this reads the 20 featured jobs on `/jobs`).
- `--location <slug>` / `-l <slug>` - one of `san-francisco`, `new-york`,
  `los-angeles`, `seattle`, `boston`, `austin`, `chicago`, `india`, `remote`.
  Other places: leave unset and match the city in `--query` (e.g. `-q "London"`).
- `--remote` - shorthand for `--location remote`.
- `--jobage <days>` - posted within N days. YC shows relative ages ("15 days",
  "3 months"), so this is approximate and applied client-side.
- `--page <n>` - 1-indexed page (40 results per role page).
- `--max-pages <n>` - consecutive pages to read from `--page` (default 1).
- `--limit <n>` / `-n <n>` - cap results emitted (client-side).
- `--format json|table|plain` - default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/ycombinator-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the `id` from a `search` result, `<company-slug>/<job-code>` (e.g.
`aviaryai/m5Dm1Qa`). A full `https://www.ycombinator.com/companies/<company>/jobs/<code>-<slug>`
URL also works. Returns the full description (Markdown, as YC publishes it),
salary, equity, experience, visa policy, skills, and company facts (batch,
website, team size, location, one-liner).

## Usage examples

```bash
# AI engineering roles at YC companies, remote, newest two pages
bun run .agents/skills/ycombinator-search/cli/src/cli.ts search -q "AI" --remote --max-pages 2 --format table

# Forward deployed engineer roles anywhere, three pages deep
bun run .agents/skills/ycombinator-search/cli/src/cli.ts search -q "forward deployed" --max-pages 3 --format table

# Engineering roles in London (no London listing page: match the city in the query)
bun run .agents/skills/ycombinator-search/cli/src/cli.ts search -q "London" --format table

# Data roles in India posted in the last 30 days
bun run .agents/skills/ycombinator-search/cli/src/cli.ts search -q "data" -l india --jobage 30 --format table

# Every remote role regardless of category
bun run .agents/skills/ycombinator-search/cli/src/cli.ts search --role all --remote --format table

# Full details for a specific job
bun run .agents/skills/ycombinator-search/cli/src/cli.ts detail aviaryai/m5Dm1Qa --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default - programmatic use, passing ids to `detail` |
| `table` | Quick human-readable scanning (shows the visa column) |
| `plain` | Reading a single job's full detail (`detail` command) |

Search JSON is `{ "meta": { "count", "page", "pages_read", "role", "location" }, "results": [...] }`;
each result carries at least `id`, `title`, `company`, `location`, `date`, `url`
(missing values are `null`), plus `posted` (YC's relative age), `date_is_approximate`,
`employment_type`, `role`, `role_detail`, `salary`, `equity`, `min_experience`,
`visa`, `skills`, `batch`, `company_one_liner` and `yc_id`. All errors are written
to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is the `data-page` JSON that ycombinator.com embeds in its listing pages
  (`/jobs/role/<role>`, `/jobs/role/<role>/<location>`, `/jobs/location/<location>`)
  and job pages (`/companies/<company>/jobs/<code>-<slug>`). `robots.txt` allows
  these paths. No credentials required.
- **No server-side keyword search.** `--query` filters the fetched pages, so a
  narrow query with `--max-pages 1` can return nothing even when matches exist on
  page 2. Read 2-3 pages for keyword searches.
- **`date` is approximate.** YC publishes relative ages ("18 days", "3 months",
  "about 5 years"); the CLI converts them to a date and marks
  `date_is_approximate: true`. Ages in months or years are coarse.
- Listings are ordered by YC (most active companies first); `--page` beyond the
  end returns the same page again, so the CLI stops when a page adds no new ids.
- `apply_url` on listings often points at a YC login; the `url` is the public job
  page, which is what to store and share.
- Descriptions arrive as Markdown and are passed through unchanged.
