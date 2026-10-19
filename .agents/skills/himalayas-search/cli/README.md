# himalayas-cli

Search remote jobs on [Himalayas](https://himalayas.app) from the command line via
its free public JSON API. No authentication, **zero runtime dependencies** (plain
`bun` + `fetch`); `bun install` only pulls TypeScript dev types for `typecheck`.

```bash
bun run src/cli.ts search -q "AI engineer" --strict --jobage 14 --format table
bun run src/cli.ts detail mercuryo/ai-solutions-engineer --format plain
bun run src/cli.ts --help
```

Scripts: `bun run typecheck`, `bun run test` (offline argument checks; set `PORTAL_LIVE_TESTS=1` to add the live smoke tests against the API).

Attribution: Himalayas asks users of its API to link back to the Himalayas job URL
and name Himalayas as the source, and not to repost its jobs to other job sites.
See `../SKILL.md` and `../url-reference.md`.
