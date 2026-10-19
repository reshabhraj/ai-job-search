# ycombinator-cli

Search open roles at Y Combinator startups from the command line, using the
public "Work at a Startup" listing pages on ycombinator.com. No authentication,
**zero runtime dependencies** (plain `bun` + `fetch`); `bun install` only pulls
TypeScript dev types for `typecheck`.

```bash
bun run src/cli.ts search -q "AI" --remote --max-pages 2 --format table
bun run src/cli.ts detail aviaryai/m5Dm1Qa --format plain
bun run src/cli.ts --help
```

Scripts: `bun run typecheck`, `bun run test` (offline argument checks; set `PORTAL_LIVE_TESTS=1` to add the live smoke tests against ycombinator.com).

Personal use only: keep volume low. See `../SKILL.md` and `../url-reference.md`.
