# Demo archive indexing

The archive pipeline is ordinary deterministic TypeScript/JavaScript. It does
not call an LLM, an AI service, or an external API.

## Scope and outputs

The default archive commands currently select the extracted demos in
`../demos/2004` and `../demos/2005`:

```bash
pnpm archive:index
pnpm archive:rescore
```

`archive:index` parses every `.dem` and writes one complete analysis file per
demo beneath `../demo-analysis`. It also creates `public/demo-index.json`, a
small catalog used by the browser UI. ZIP archives are outside the input set
and are never modified.

Each successful catalog entry contains:

- archive path, byte size and SHA-256;
- recording date inferred from the `-YYMMDDhhmm-` filename stamp;
- map, protocol and HLTV/POV perspective;
- logical team/clan names and all observed player nicknames;
- counts for deaths, scored frags, moments and rounds;
- highest frag, moment and round score.

The full per-demo JSON retains normalized events and every explainable score
reason. This powers the frag list without analyzing the demo again.

## Resume and failure behavior

Before parsing, the indexer compares both the demo SHA-256 and current analyzer
version with the stored analysis. Matching files are skipped. Results are
written after every demo, so an interrupted run can simply be started again.

A malformed demo creates an error JSON and an error catalog row. Processing
continues with the next file. The original `.dem` is never edited.

## Rescoring

`archive:rescore` reads the normalized analysis JSON and runs the current
highlight rules again. It avoids rereading the large demo archive. This is the
normal command after tuning FragScore or RoundScore.

## Useful targeted runs

```bash
# First 10 demos from 2004, useful while developing
node --import ./scripts/hltv-node.mjs scripts/index-demos.mjs parse \
  --year 2004 --limit 10 \
  --catalog /tmp/demo-index.json \
  --analysis /tmp/demo-analysis

# Force a fresh parse even when hash and analyzer version match
node --import ./scripts/hltv-node.mjs scripts/index-demos.mjs parse \
  --year 2004 --year 2005 --force
```

The catalog can be searched by filename, map, clan/team or nickname and sorted
by recording date, highest frag score or highest round score.
