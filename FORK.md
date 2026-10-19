# About this fork

This is an extended fork of **[AI Job Search](https://github.com/MadsLorentzen/ai-job-search)** by Mads Lorentzen, maintained by [Reshabh Raj](https://github.com/reshabhraj). Everything in the original [README](README.md) applies; this page lists what the fork adds. Both the original and this fork are MIT-licensed (see [LICENSE](LICENSE)).

## What this fork adds

| Area | Addition |
|---|---|
| ATS bullet check | `tools/verify_pdf.py --plain-bullets` fails when a list marker in the PDF text layer is not a plain bullet. The stock moderncv banking style puts a FontAwesome circle there that extracts as U+1F7E4 (an emoji), which some viewers and applicant-tracking systems show as "O" or a box. |
| Stock CV fix | A `\labelitemi` override in `cv/main_example.tex` and `05-cv-templates.md` restores a plain `•` bullet, so the stock CV passes `--plain-bullets`. |
| Readable contact links | LinkedIn and GitHub URLs are printed as the visible link text instead of a "LinkedIn" label, so an ATS can read them. `/apply` checks this when the CV lists those links. |
| Template-aware page limits | `/apply`, `/add-template` and the CLAUDE.md checklist follow the active template's page limit instead of a fixed 2 pages. |
| One-page CV template | `templates/cv/jake-onepage/`: a single-column, one-page CV based on Jake's Resume (MIT). Switch with `/add-template --use jake-onepage`; `/add-template --use default` switches back to the stock 2-page CV. |
| CV writing guidance | Profile statement of 3 sentences (65-85 words) with the numbers kept in the bullets, 5 competencies, and no References section unless a posting asks for one. |
| Two more job boards | `himalayas-search` (remote jobs worldwide through Himalayas' public API) and `ycombinator-search` (Y Combinator "Work at a Startup" listings). Both run with plain `bun`. |

## Getting started

1. Clone this repository rather than the original, so you get the additions:

   ```bash
   git clone https://github.com/reshabhraj/ai-job-search.git
   ```

2. Follow the original [Quick start](README.md) and [SETUP.md](SETUP.md): install the prerequisites, run `python tools/install_portal_clis.py`, then run `/setup` in Claude Code to fill in your profile.
3. Prefer a one-page CV? Run `/add-template --use jake-onepage` once after `/setup`.

Your profile, CVs and applications stay on your machine: the profile files ship as placeholders, and the folders that hold your generated documents and job data are git-ignored. If you publish your own copy, read the README's notes on forks first, since GitHub forks are always public.

## Notes

- **Live job-board tests are opt-in.** `bun test` in the two new CLIs runs offline argument checks; `PORTAL_LIVE_TESTS=1 bun test` adds a few live requests. Both sites are for personal use: keep volume low and follow Himalayas' attribution terms (link back to the posting and name Himalayas as the source).
- **Problems with a feature from the table above:** open an issue on this repository. Everything else belongs to the original project; see its [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
- **Updates:** the fork is synced with the original from time to time, so its fixes and features arrive here too.
