# Template: jake-onepage

- **Type:** CV
- **Source extension:** .tex
- **Engine/toolchain:** lualatex
- **Page limit:** 1 page
- **Fonts:** Latin Modern (system font, ships with every TeX distribution)
- **Class/packages:** `article` class; latexsym, fullpage, titlesec, marvosym, color, verbatim, enumitem, hyperref, fancyhdr, babel, tabularx, iftex (all standard)

Based on Jake's Resume by Jake Gutierrez (https://github.com/jakegut/resume, MIT), itself based on sb2nov/resume (MIT). Both license notices are in `LICENSE` next to this file. Switch to this template with `/add-template --use jake-onepage`; `/add-template --use default` switches back to the stock 2-page moderncv.

## Compile command

    cd cv && rm -f <file>.pdf && mkdir -p build && lualatex -interaction=nonstopmode -output-directory=build <file>.tex && mv build/<file>.pdf ./

## Style rules

- Black on white, no colour, no icons. Section titles are small caps with a full-width rule. Single column throughout.
- Section order: Header, Summary, Technical Skills, Experience, Education, Languages and Honors. No Projects section unless the candidate has a real one; no References section.
- Header: name, then one line with location, phone, email, `linkedin.com/in/...` and `github.com/...` separated by `\textbar{}`. Every contact detail is printed as text; the LinkedIn and GitHub link text is the URL path, never a label like "LinkedIn".
- One-page budget (this replaces the stock 2-page table in `05-cv-templates.md`):

  | Section | Budget |
  |---|---|
  | Summary | 2 sentences, at most 45 words; scope and specialisation only, no metrics a bullet already carries |
  | Technical Skills | exactly 4 lines, each `\textbf{Label}{: keyword, keyword, ...}`, posting terms where truthfully applicable |
  | Most recent / most relevant role | 4 bullets |
  | Second role | 3 bullets |
  | Older role | 2 bullets |
  | Every bullet | at most 2 rendered lines |
  | Education | one `\resumeSubheading` per entry (degree and dates; no description line) |
  | Languages and Honors | 2 lines |

- **Optional data-protection consent footer:** `template.tex` carries a commented-out `\fancyfoot[C]{\scriptsize [DATA_PROTECTION_CONSENT]}` line. Some European employers expect a short consent line (permission to process the personal data in the CV under the GDPR, plus national privacy law where it applies); uncomment it and fill in the wording that market expects. It sits in the footer area, so it costs no body space. Leave it commented out where it is not expected. No photo by default.
- When the page overflows, cut with the relevance-weighted rule in `05-cv-templates.md`; never shrink margins, font size or `\vspace`.
- Bullets: `\resumeItem{...}` inside `\resumeItemListStart ... \resumeItemListEnd`. Start each with an action verb; name Claude Code for any agentic-coding claim.
- Dates: a single ASCII hyphen with spaces, `Mar 2026 - Present`, `2021 - 2022`. Never `--`.

## Known pitfalls

- **Paper size.** Ships `a4paper` (the original uses `letterpaper`). For US or Canadian employers, change it to `letterpaper` in the tailored file; page size does not affect ATS parsing, only print margins.
- **pdfTeX-only lines.** The original's `\input{glyphtounicode}` and `\pdfgentounicode=1` are pdfTeX primitives and error under lualatex. They are wrapped in `\ifpdftex ... \fi` (needs `\usepackage{iftex}`). Under lualatex the text layer is correct without them (verified: pypdf extracts clean text, `•` bullets, URLs).
- **PDF title.** `\hypersetup{pdftitle=...}` is required: Poppler's `pdftotext -bbox`, which `tools/verify_layout.py` uses, aborts on a PDF with no title on older Poppler builds.
- **Header separator.** Uses `\textbar{}` instead of the original's math `$|$`, so the separator is a plain text character in the layer.
- **`\resumeSubheading` argument order differs by section.** Experience: `{Title}{Dates}{Organisation}{Location}`. Education: `{Institution}{Location}{Degree}{Dates}`. Mixing them up puts dates on the wrong side with a clean compile.
- **Unbreakable entries.** `\resumeSubheading` is a `tabular*`, so a heading never splits from itself, but on a one-page CV the real risk is overflow to page 2: `verify_pdf.py --pages 1` catches it.
- **Under-filled page.** `verify_layout.py`'s thin-last-page check only fires on documents with more than one page, so a half-empty one-pager passes silently. The visual read is the only guard; restore the highest-relevance cut bullet if the page ends above roughly 85% of its height.
- **Layout script calibration.** `verify_layout.py` thresholds are tuned to moderncv. This template has no page-number footer, so a "footer collision" report for text near the bottom margin is a phantom; confirm by the visual read.
- **Bullets.** Item markers are the original's level-2 `$\bullet$`, which extracts as U+2022 and passes `--plain-bullets`. Do not add icon packages (fontawesome) to this template: icon glyphs reach the layer as emoji or private-use code points.
- **Escaping.** Same as the stock template: `\&`, `\%`, `\$`, `\#`, `\_` in body text. An unescaped `%` silently deletes the rest of the line.
