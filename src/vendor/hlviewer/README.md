# Vendored hlviewer.js

Built from [`skyrim/hlviewer.js`](https://github.com/skyrim/hlviewer.js) commit
`7b00235` (package version 0.8.5) and distributed under the adjacent MIT
license.

Local compatibility changes in `FrameDataReader.ts` before building:

1. consume the 21-byte legacy `svc_serverinfo` extra-info block;
2. retain the server's network protocol and actual `maxPlayers` value;
3. use a 5-bit weapon index in `svc_clientdata` when protocol is below 47;
4. use actual `maxPlayers` in baseline and packet-entity decoding;
5. consume the 8-byte payload for `svc_hltv` mode 2;
6. omit the `svc_voiceinit` quality byte below protocol 47.
7. retain registered user-message payloads and expose a compact analysis pass
   that keeps their packet time, directory entry and byte offset.

`Replay` is exported from the bundle to permit parser regression tests. The
modified build parses all of `r60_sthlm.dem` into 317 chunks without losing
network-message alignment. `Replay.parseAnalysisFrames` runs the same protocol
decoder but retains only user-info and registered user messages for indexing.
