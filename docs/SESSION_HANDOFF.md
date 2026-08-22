# Session handoff

Last audited: 2026-08-22 (Europe/Stockholm).

## Project and production

HLTV Replay Lab is a browser-native player and archive for legacy
Counter-Strike/GoldSrc demos. The normal working directory is:

```text
/Users/ldmnt/Code/hltv/app
```

Production is `https://praxxa.pro`. The app runs as `hltv-app.service` behind
Caddy on `79.76.54.16`; the resumable screenshot worker is
`hltv-scoreboard-capture.service`. Deployment uses the checked-in script:

```bash
cd /Users/ldmnt/Code/hltv/app
./scripts/deploy.sh
```

A normal deploy builds and synchronizes the app, engine assets and operational
scripts, then restarts only the app service. It deliberately does not overwrite
the server's authoritative analysis directory or stop the screenshot worker.

## Current working product

- HLDEMO format 5 and GoldSrc network protocols 46–48 have isolated
  compatibility profiles. HLTV and POV demos continue to use their respective
  spectator/playback paths.
- Historical map variants are selected using the recorded GoldSrc map CRC.
- The archive catalog contains 6,226 demos. It supports search, person/clan/year
  filters and eight bidirectional table sorts: date, match, map, top frag, top
  round, ace, 0–12 and comments. Missing values stay last in both directions.
- Demo pages load the versioned analysis index, match comments, highlights,
  round scores, the complete frag table, Only Frags and portable playlists.
- Normal match and frag playback starts the real Xash3D/CS16Client engine in
  WebAssembly. Native HLTV in-eye selection, manual spectator controls, POV
  isolation, HUD presets and seek are active.
- Dynamic cinematic playback is available for supported HLTV highlights,
  rounds and individual frags only when the URL contains exactly `debug=true`.
  It currently plays in the browser and does not create an MP4.
- The cinematic director has six passes, including original POV, tracking,
  fly-by, straight-down God's-eye and impact-oriented views. A complete path is
  sent to CS16Client once per pass; normal playback does not run this override.
- Demo pages show the first-side and second-side/match-end native scoreboard
  images when captured. Both thumbnails link to the original JPEG in a new tab.
- The automated scoreboard renderer selects MR12/MR15 competitive side ends,
  ignores warmup and knife rounds, removes capture-only notifications and writes
  review metadata for uncertain selection or players missing from the final
  native table.

The exact CS16Client/Xash patches, upstream revisions, build order and hashes
are maintained in `engine-patches/README.md`. Do not replace a WASM binary
without updating its reproducible patch and documented SHA-256.

## Verification completed for this handoff

The following passed on 2026-08-22:

```bash
pnpm run check
pnpm test
pnpm build
```

Result: 21 test files passed, 109 tests passed and one fixture-dependent test
was intentionally skipped. The production build completed. Vite reports only
the known warnings about `eval` inside generated, pinned Emscripten glue.

A real production-browser smoke test also verified:

- HTTP 200 for the archive and direct demo routes;
- 50 visible archive rows, search and all eight sort toggles;
- comments API and demo comment form;
- versioned analysis loading;
- both scoreboard JPEGs returning HTTP 200 and opening with `_blank` plus
  `noopener noreferrer`;
- zero cinematic buttons without `debug=true`;
- normal engine startup to `Engine running`;
- debug cinematic startup to `CINEMATIC` with the query string retained;
- no unexpected page errors, failed requests or server 5xx responses.

## Screenshot worker

The full screenshot archive is still being generated in the background. It is
safe to restart: current-version image pairs are skipped using `capture.json`.
Every result is checkpointed in:

```text
/srv/hltv/scoreboard-screenshots/capture-results.json
```

Monitor it with:

```bash
ssh -i ~/.ssh/hltv.key ubuntu@79.76.54.16 \
  'systemctl status hltv-scoreboard-capture.service --no-pager; \
   journalctl -u hltv-scoreboard-capture.service -n 20 --no-pager'
```

`scripts/capture-side-end-scoreboards.mjs` retries a failed match once in a
fresh Chromium session. This prevents a browser crash from cascading into an
error for every remaining demo. The retry path and a real two-image capture
were both integration-tested during this audit.

## Known data exceptions

Five of the 6,226 catalog entries are intentionally marked as errors rather
than guessed or silently dropped:

```text
2004/bajzlan_bhult-0411092252-de_dust2.dem       Bits out of bounds
2006/pxa_wwg_r60-0601100058-de_nuke.dem         Bits out of bounds
2006/bboys_shrimp-0612142150-de_forge.dem        File is larger than 2 GiB
2007/minc-lodd-0702212141-de_dust2.dem           Bits out of bounds
2007/praxxa_ryssfemman-0706020252-de_inferno.dem Bits out of bounds
```

The indexer completed all 6,226 entries despite these five malformed/unsupported
files. Its old transient systemd failure markers were cleared after confirming
that the catalog and analyses were written successfully.

One scoreboard target timed out on both attempts under the hardened worker:

```text
2004/home/infe/hlds/cstrike/caterchryinfe_3on3-0407281433-de_dust2.dem
```

It remains in `capture-results.json` for manual review. The worker immediately
continued through the existing image pairs and captured the next uncaptured
match, confirming that this data-specific failure does not block the queue.

## Operations and important files

```text
README.md                                      User-facing/current overview
docs/DEMO_ARCHIVE_INDEXING.md                  Index and scoreboard operations
engine-patches/README.md                       Reproducible engine/client builds
src/App.vue                                    Main archive and player UI
src/archive/demo-catalog.ts                    Catalog filtering and sorting
src/analysis/match-side-ends.ts                MR12/MR15 capture selection
src/movie/ace-cinematic-director.ts            Dynamic cinematic plans
scripts/capture-side-end-scoreboards.mjs       Resumable capture worker
scripts/deploy.sh                              Production deployment
```

Useful production checks:

```bash
ssh -i ~/.ssh/hltv.key ubuntu@79.76.54.16 \
  'systemctl is-active caddy hltv-app.service hltv-scoreboard-capture.service; \
   systemctl --failed --no-legend; df -h /srv/hltv'
```

The 2026-08-22 audit showed all three services active, no failed units, no app
warnings or recent HTTP 5xx responses, and approximately 70 GB free on the
archive volume.

## Rules that must be preserved

- Never hardcode behavior for one demo, map, player or year.
- Missing evidence remains unknown/review; it must not become zero or a guess.
- Keep parser facts, derived conclusions and highlight scoring separate.
- Never alter or delete the source `.dem` archive during indexing or capture.
- Preserve ordinary demo/frag playback when changing debug cinematics.
- Keep cinematic controls hidden unless the parsed route has exact
  `debug=true`.
- Keep automated scoreboard presentation separate from interactive controls.
- Do not deploy local analysis implicitly; server analysis is authoritative.
- Existing/unknown working-tree files belong to the user and must be preserved.

Before any future handoff, run the three verification commands, smoke-test one
normal and one `debug=true` demo in production, inspect failed units and record
the current screenshot progress.
