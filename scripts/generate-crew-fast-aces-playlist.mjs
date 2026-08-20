#!/usr/bin/env node
// Convenience entry point for complete five-kill aces that fit in one scene.
// All arguments are forwarded to the generic crew ace generator.
//
//   node --import ./scripts/hltv-node.mjs scripts/generate-crew-fast-aces-playlist.mjs \
//     --member infe \
//     --out /srv/hltv/generated-playlists/infe-fast-aces.hltv-playlist.json

if (!process.argv.includes('--fast-only')) process.argv.push('--fast-only');
await import('./generate-crew-ace-playlist.mjs');
