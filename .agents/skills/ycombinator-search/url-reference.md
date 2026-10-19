# Y Combinator Jobs URL Reference

Public listing and job pages on `https://www.ycombinator.com`. Verified live
2026-09-29 with an honest User-Agent (`Mozilla/5.0 (compatible; ycombinator-search-cli/1.0)`):
all pages below answered 200 with no login.

> Personal use only. `robots.txt` (`User-Agent: *`): `Allow: /`, with disallows only
> for `/verify/*`, `/library?*`-style filtered library URLs and `/companies?*`
> (query strings on the companies directory). None of the paths below are affected.

## Page data model

Every page is an Inertia.js app. The server embeds the page's data as JSON in the
`data-page` attribute of the root `<div>`:

```html
<div id="app" data-page="{&quot;component&quot;:&quot;WaasJobListingsPage&quot;,&quot;props&quot;:{...}}">
```

The CLI extracts that attribute, HTML-unescapes it, and `JSON.parse`s it. No HTML
card parsing is involved, which is why one markup change (the attribute name or the
component's prop names) is the thing to check when this skill breaks.

## Listing pages (used by `search`)

| URL | Component | Jobs per page | Notes |
|-----|-----------|---------------|-------|
| `/jobs/role/<role>?page=N` | `WaasJobListingsPage` | 40 | Role category, all locations |
| `/jobs/role/<role>/<location>?page=N` | `WaasJobListingsPage` | up to 40 | Role + location (the sidebar's link scheme) |
| `/jobs/location/<location>?page=N` | `WaasJobListingsPage` | up to 40 | All roles in one location |
| `/jobs` | `WaasLandingPage` | 20 | Featured jobs only, no filters |

Role slugs (`props.jobRoles`): `software-engineer`, `designer`, `product-manager`,
`recruiting-hr`, `sales-manager`, `marketing`, `support`, `operations`, `science`.

Location slugs (`props.jobLocations` + sidebar): `san-francisco`, `new-york`,
`los-angeles`, `seattle`, `boston`, `austin`, `chicago`, `india`, `remote`.

`/jobs/role/<role>/location/<loc>` and `/jobs/location/<loc>/role/<role>` are 404;
`?location=` and `?query=` query params are ignored. A `page` beyond the last one
returns the same jobs again rather than an empty list, so pagination stops when a
page adds no new ids.

The jobs live in `props.jobPostings`, each:

| Field | Example | Notes |
|-------|---------|-------|
| `id` | `"109279"` | Numeric YC id (not usable in a URL on its own) |
| `title` | `"Forward Deployed Engineer"` | |
| `url` | `"/companies/aviaryai/jobs/m5Dm1Qa-forward-deployed-engineer"` | Job page path; `<code>` = `m5Dm1Qa` |
| `applyUrl` | `"https://account.ycombinator.com/authenticate?..."` | Usually a login redirect |
| `location` | `"Chicago, IL"`, `"US / CA / Remote (US; CA)"` | Free text |
| `type` | `"Full-time"`, `"Contract"`, `"Internship"` | |
| `role` / `prettyRole` | `"eng"` / `"Engineering"` | |
| `roleSpecificType` | `"Full stack"`, `"Machine learning"` | |
| `salaryRange` | `"$80K - $120K"` | May be empty |
| `equityRange` | `"0.01% - 0.10%"` | May be empty |
| `minExperience` | `"3+ years"`, `"Any (new grads ok)"` | |
| `visa` | `"Will sponsor"`, `"US citizen/visa only"`, `"US citizenship/visa not required"` | Feeds the Eligibility Gate |
| `skills` | `["Python", "React"]` | Often empty |
| `companyName`, `companyUrl`, `companyBatchName`, `companyOneLiner` | | `companyUrl` is `/companies/<slug>` |
| `createdAt` | `"18 days"`, `"3 months"`, `"about 5 years"` | Relative age of the posting |
| `lastActive` | `"2 days"` | Company's last activity |

The CLI's `id` is `<company-slug>/<code>` parsed from `url`; `date` is derived from
`createdAt` and flagged approximate.

## Job page (used by `detail`)

```
GET https://www.ycombinator.com/companies/<company-slug>/jobs/<code>-<title-slug>
```

Component `WaasShowJobPage`, props `job` (the listing fields above plus
`description` as **Markdown**, `interview_process`, `hiringManager`) and `company`
(`slug`, `name`, `batch_name`, `one_liner`, `website`, `team_size`, `location`,
`country`, `tags`, `year_founded`, `long_description`). The page also carries a
JSON-LD `JobPosting` block, unused by the CLI.

Whether `/companies/<company>/jobs/<code>` without the title slug resolves is
recorded in the CLI (`detail` tries the short form and reports `NOT_FOUND` on 404).

## Notes

- Honest User-Agent, no cookies, no login.
- Retries 429/5xx with exponential backoff (max 6); 404 returns an empty body.
- `workatastartup.com` (the full-text search) requires a login and is not used.
