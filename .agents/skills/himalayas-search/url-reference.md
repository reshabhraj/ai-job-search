# Himalayas API Reference

Public, unauthenticated JSON API documented at https://himalayas.app/api ("Free
public JSON API - no authentication required"). Verified live 2026-09-29.

> Usage terms stated on the API page: link back to the URL found on Himalayas and
> mention Himalayas as the original source; do not submit Himalayas jobs to
> third-party websites (Jooble, Neuvoo, Google Jobs, LinkedIn Jobs, ...).

## Search (used by `search` and `detail`)

```
GET https://himalayas.app/jobs/api/search
```

| Param | Meaning | Example |
|-------|---------|---------|
| `q` | Free-text query, loosely matched | `AI engineer` |
| `country` | Hiring-country filter: ISO alpha-2, name, slug or abbreviation | `DE`, `Germany` |
| `worldwide` | Keep only worldwide-open roles | `true` |
| `exclude_worldwide` | With `country`: drop worldwide-open roles | `true` |
| `seniority` | One or more of `Entry-level`, `Mid-level`, `Senior`, `Manager`, `Director`, `Executive` (comma-separated) | `Mid-level,Senior` |
| `employment_type` | One or more of `Full Time`, `Part Time`, `Contractor`, `Temporary`, `Intern`, `Volunteer`, `Other` | `Contractor` |
| `company` | One or more canonical company slugs | `linear,vercel` |
| `timezone` | Timezone filter | `-5`, `UTC-5`, `UTC+05:30` |
| `sort` | `relevant`, `recent`, `salaryAsc`, `salaryDesc`, `nameAToZ`, `nameZToA`, `jobs` | `recent` |
| `page` | 1-based results page | `2` |

Quirks verified live:
- **`limit` is ignored** on `/search` (`limit=3` still returned a full page). Page size
  is 20 (some pages return slightly fewer, e.g. 17-18, presumably after server-side
  dedup).
- `totalCount` caps at 5000 for broad queries.
- `q` is loose: `"claude code"` (quoted) returned 1,529 results, most not mentioning it.

## Browse feed (not used by the CLI)

```
GET https://himalayas.app/jobs/api?limit=20&cursor=<nextCursor>
```

Full unfiltered feed with cursor pagination (`limit` max 20, `offset` deprecated).
Documented for completeness; the CLI uses `/search` so filtering happens server-side.

## Response shape (both endpoints)

```json
{
  "updatedAt": 1790570861,
  "offset": 0,
  "limit": 20,
  "totalCount": 5000,
  "nextCursor": "...",            // browse feed only
  "jobs": [ { ...job } ]
}
```

Job object fields:

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | |
| `excerpt` | string | Short plain-text summary |
| `companyName` | string | |
| `companySlug` | string | Canonical slug, usable in `company=` |
| `companyLogo` | string | URL |
| `employmentType` | string | `Full Time`, `Contractor`, ... |
| `minSalary`, `maxSalary` | number or null | |
| `salaryPeriod` | string | e.g. `annual` |
| `currency` | string or null | |
| `seniority` | string[] | e.g. `["Mid-level","Senior"]` |
| `locationRestrictions` | string[] | Country names the employer hires in; empty = worldwide |
| `timezoneRestrictions` | number[] | UTC offsets accepted |
| `categories`, `parentCategories` | string[] | Role taxonomy slugs |
| `description` | string | **Full HTML description** |
| `pubDate` | number | Unix seconds |
| `expiryDate` | number or null | Unix seconds |
| `applicationLink` | string | Himalayas job URL |
| `guid` | string | Himalayas job URL: `https://himalayas.app/companies/<companySlug>/jobs/<jobSlug>` |

There is **no numeric job id**. The CLI derives `id = <companySlug>/<jobSlug>` from
`guid`, and `detail` resolves it by querying `company=<companySlug>` and matching the
job slug (up to 5 pages).

## Job pages

`https://himalayas.app/companies/<companySlug>/jobs/<jobSlug>` returns **403** to a
non-browser User-Agent (bot filter), so the CLI never fetches them. `robots.txt`
allows `/` and disallows only `?page=` listing URLs and `/apply`; the API paths the
CLI uses carry no `page=` query string on the browse feed and use `page=` only on
`/jobs/api/search`, which is not a listing page.

## Notes

- Honest User-Agent: `Mozilla/5.0 (compatible; himalayas-search-cli/1.0)`.
- Retries 429/5xx with exponential backoff (max 6); 404 returns null.
- Descriptions are HTML; the CLI strips them to text with paragraph breaks preserved.
