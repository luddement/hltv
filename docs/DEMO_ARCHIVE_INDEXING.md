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

## Side-end scoreboard archive

The scoreboard pipeline saves at most two native 1920×1080 CS frames per
match: the final live round before the side swap, and the match-winning or
final played round after it. Pure knife rounds, pre-live rounds and warmup are
excluded. An observed `Game_will_restart_in` plus an exact MR12/MR15 side swap
is required for `high` confidence; uncertain demos stay in the manifest as
`review` instead of being captured silently.

```bash
# Analyzer 2.5.17+ retains match restart boundaries and recovers old-demo
# round endings from observed TeamScore increments when the win sound is absent.
pnpm archive:index

# Read-only audit. Creates ../side-end-capture-manifest.json.
pnpm archive:scoreboards:audit

# Keep the app running in another terminal, then capture every selected match.
# Review-marked captures receive a review.json sidecar next to the image.
pnpm dev --host 127.0.0.1 --port 43175
pnpm archive:scoreboards:capture

# Optional conservative run which excludes the review queue.
pnpm archive:scoreboards:capture --high-confidence-only
```

The capture job is sequential and resumable. Existing images are skipped and
progress/errors/review counts are checkpointed in `capture-results.json`.
Each match is retried once in a fresh Chromium session after a timeout or
browser failure, so one bad demo cannot turn the remainder of the queue into
cascading errors.
JPEG quality 95 is the storage-friendly default; pass `--format png` for
lossless frames. Capture mode clears chat, join/leave, killfeed and centre-text
buffers immediately before each frame; ordinary interactive playback is not
changed. A versioned `capture.json` beside every pair means images made by an
older renderer are recaptured automatically instead of being mistaken for
current output.

The catalog can be searched by filename, map, clan/team or nickname. Each of
the eight table headings toggles ascending/descending sorting: recording date,
match, map, highest frag score, highest round score, ace count, 0–12 count and
comment count. Missing values remain last in either direction.
