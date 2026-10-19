---
name: himalayas-search
version: 1.0.0
description: >
  Use this skill to search live remote job listings worldwide via the Himalayas
  public Remote Jobs API (himalayas.app), or to look up a specific Himalayas
  posting. Remote-only board: every listing is a remote role, filterable by
  keyword, country of hire, worldwide availability, seniority and employment
  type. Trigger phrases: remote jobs, remote job search, work from home jobs,
  fully remote roles, "remote <role> jobs", worldwide remote positions,
  look up this Himalayas job posting.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/himalayas-search/cli/src/cli.ts *)
---

# Himalayas Search Skill

Search live **remote** job listings from [Himalayas](https://himalayas.app) through
its free, documented, public JSON API. No authentication, no API key, and **zero
runtime dependencies**: it runs with just `bun`. Himalayas lists remote roles from
companies worldwide, so the market is chosen per query (`--location` maps to the
country the employer hires in; `--worldwide` keeps only roles open to anyone).

> Built with `/add-portal` on 2026-09-29 from the API documentation at
> https://himalayas.app/api. Unlike the HTML-scraping portals there is no markup to
> parse: results are structured JSON and already carry the full description.

## ℹ️ Attribution and usage terms

Himalayas publishes this API for anyone to use, with two conditions stated on its
API page: **link back to the job's Himalayas URL and name Himalayas as the original
source**, and **do not submit Himalayas jobs to third-party job sites** (Jooble,
Neuvoo, Google Jobs, LinkedIn Jobs and the like). This skill is search + detail
for a personal job hunt, which is within those terms. Keep volume low; the CLI
backs off on 429/5xx.

## When to use this skill

- Search remote openings by keyword, optionally narrowed to a hiring country,
  worldwide-open roles, seniority, or employment type
- Filter by recency (posted within N days) - applied client-side, see Notes
- Get the full description of a specific Himalayas listing

## Commands

### Search job listings

```bash
bun run .agents/skills/himalayas-search/cli/src/cli.ts search [-q "<keywords>"] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` - free-text keyword search (the API's `q`). The
  match is loose (a query of "AI engineer" also returns generic engineer roles);
  add `--strict` to keep only results whose title, excerpt or description contain
  every query word.
- `--location <country>` / `-l <country>` - hiring-country filter (the API's
  `country`): ISO alpha-2 (`DE`, `US`), a country name (`Germany`) or slug. Also
  available as `--country`. Roles with no location restriction are open to any
  country and are always included.
- `--worldwide` - keep only roles open to applicants anywhere.
- `--seniority <levels>` - comma-separated: `Entry-level`, `Mid-level`, `Senior`,
  `Manager`, `Director`, `Executive`.
- `--employment-type <types>` - comma-separated: `Full Time`, `Part Time`,
  `Contractor`, `Temporary`, `Intern`, `Volunteer`, `Other`.
- `--company <slug>` - one or more canonical company slugs (from a result's
  `company_slug`), comma-separated.
- `--sort <order>` - `recent` (default), `relevant`, `salaryAsc`, `salaryDesc`,
  `nameAToZ`, `nameZToA`, `jobs`.
- `--jobage <days>` - posted within N days. The API has no age parameter, so this
  filters client-side on each result's `pubDate`; combine with `--max-pages` to
  scan further back.
- `--page <n>` - 1-indexed page (20 results per page, fixed by the API).
- `--max-pages <n>` - how many consecutive pages to read from `--page` (default 1).
  Useful with `--strict` or `--jobage`, which discard results after fetching.
- `--limit <n>` / `-n <n>` - cap results emitted (client-side).
- `--format json|table|plain` - default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/himalayas-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the `id` from a `search` result, `<company-slug>/<job-slug>` (e.g.
`mercuryo/ai-solutions-engineer`). A full
`https://himalayas.app/companies/<company>/jobs/<job>` URL also works. Returns the
full description (HTML stripped to text), employment type, seniority, salary,
location and timezone restrictions, categories, and the expiry date.

Search results already carry the description in `json` output, so a run of
20 roles is 1 request; reach for `detail` when you have an id from the tracker
or a shared link rather than re-reading a hit `search` just returned.

## Usage examples

```bash
# Remote AI engineer roles posted in the last 14 days, strict keyword match, scanning 3 pages
bun run .agents/skills/himalayas-search/cli/src/cli.ts search -q "AI engineer" --strict --jobage 14 --max-pages 3 --format table

# Remote roles a resident of Germany can take (hiring country Germany or unrestricted)
bun run .agents/skills/himalayas-search/cli/src/cli.ts search -q "analytics engineer" -l Germany --format table

# Worldwide-open, mid-level or senior, full time
bun run .agents/skills/himalayas-search/cli/src/cli.ts search -q "data engineer" --worldwide --seniority "Mid-level,Senior" --employment-type "Full Time" --format table

# Contract work
bun run .agents/skills/himalayas-search/cli/src/cli.ts search -q "technical writer" --employment-type Contractor --format table

# Everything one company currently lists
bun run .agents/skills/himalayas-search/cli/src/cli.ts search --company linear --format table

# Full details for a specific job
bun run .agents/skills/himalayas-search/cli/src/cli.ts detail mercuryo/ai-solutions-engineer --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default - programmatic use; the only format carrying each hit's description |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

Search JSON is `{ "meta": { "count", "page", "pages_read", "total" }, "results": [...] }`;
each result carries at least `id`, `title`, `company`, `location`, `date`, `url`
(missing values are `null`), plus `company_slug`, `employment_type`, `seniority`,
`salary`, `expires`, `excerpt` and `description`. All errors are written to
**stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from `https://himalayas.app/jobs/api/search`, documented and free. No
  credentials required.
- **Page size is fixed at 20**; the API ignores `limit` on the search endpoint, so
  `--limit` trims client-side and `--max-pages` reads further.
- **`q` matching is loose.** The API ranks by relevance but returns many
  partial matches; use `--strict` for an exact all-words filter, or read titles
  before reading bodies.
- **`--jobage` is client-side.** With `--sort recent` (the default) the freshest
  postings come first, so `--jobage 14 --max-pages 2` reads the 40 newest matches
  and keeps those within two weeks.
- `location` is the employer's hiring-country restriction list joined with commas;
  `Worldwide (remote)` means the posting has no restriction. Timezone restrictions
  are exposed as `timezones` in `detail`.
- `date` is the posting's `pubDate` as an ISO date; `expires` is `expiryDate`.
- The **job pages on himalayas.app return 403 to non-browser clients**, which is why
  `detail` resolves the job through the API (`company=<slug>`, then matches the job
  slug) instead of fetching the page. A job that has expired is no longer in the
  API and `detail` reports `NOT_FOUND`.
- Attribution: when a Himalayas posting is presented or tracked, keep its
  Himalayas URL and name Himalayas as the source (the API's stated condition).
