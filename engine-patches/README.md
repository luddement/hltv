# Xash3D protocol 46 build

The browser player uses a locally rebuilt `xash.wasm` from the `merged`
branch of [yohimik/xash3d-fwgs](https://github.com/yohimik/xash3d-fwgs),
commit `f85aa0c`. Apply `xash3d-protocol46.patch` before the normal Emscripten
build with Emscripten 4.0.23. The bundled binary has SHA-256
`7a00694ccae22b8cbb3254033a602a6ac750f7c27e6909ba1e23e6a13ac8f2c4`.

The patch keeps protocol 48 support and adds the legacy protocol 46 demo
variants used by `r60_sthlm.dem`: the demo header/version checks, serverdata
security payload, five-bit weapon indices, old voice initialization, the
early HLTV listen payload, synchronized camera origins and team scoreboards.
Its Replay Lab fast-forward target consumes packets
without realtime pacing, and the recorded demo camera yields to the client's
native spectator camera while player switching or free look is active. Native
HLTV playback also prevents the recorded local player's stale muzzleflash bit
from being recopied onto the selected spectator viewmodel every frame. The
browser build disables SDL's redundant Retina high-DPI framebuffer so a
1997×900 canvas no longer renders internally at 3994×1800. The Emscripten build
accepts local HLDEMO signon
messages up to 512 KiB, covering protocol-47 POV demos whose resource block is
larger than Xash's normal 192 KiB network initialization limit. The Valve HLDEMO
container adapter is isolated from Xash and Quake demo readers and accepts
GoldSrc network protocols 46–48; protocol-specific packet quirks remain gated.

Xash3D-FWGS is GPL-3.0 licensed. The upstream source, exact commit and local
patch are recorded here so the bundled WebAssembly binary is reproducible.

The matching Emscripten JavaScript glue is stored in
`src/vendor/xash-protocol46.js` and aliased in `vite.config.ts`. Regenerate the
WASM and glue together: the numeric EM_ASM addresses are build-specific.
The Vite compatibility transform calculates the relocation against the pinned
upstream runtime and aliases its side-module addresses dynamically.

`cs16-client-hltv-v16.wasm` is rebuilt from CS16Client `15278ca`. It adds the
`hltv_legacy_scoreboard` compatibility cvar and the independent
`hltv_compact_scoreboard` presentation cvar. The latter removes spectator-only
HP/Money columns without activating legacy player/team inference. It also keeps
scoreboard visibility in the HUD traversal
before the first legacy ScoreInfo message, restores team mode from authoritative
TeamInfo messages, and falls back to recorded player models and death events when
an early HLTV stream omits TeamInfo/ScoreInfo. Replayed menus are suppressed
without issuing weapon-slot commands, and unknown spectator health is omitted
instead of being presented as zero. Legacy SayText payloads regain the original
team-colored sender name with yellow message text. An opt-in, presentation-only
camera override accepts a reconstructed entity origin and angle for short POV
feasibility probes; it is disabled during normal replay. Apply
`cs16-client-hltv.patch` to that exact commit to reproduce it.
The camera follows the killer's live player entity when it is present in the
recorded packet and falls back to the indexed frag position otherwise. HLTV
replays expose `hltv_spec_player <slot>` for native in-eye spectator mode,
including when Xash local demo playback does not set GoldSrc's spectate-only
flag. Replay Lab supplies the selected frag weapon as a fallback for sparse
legacy entity packets. When the followed entity carries its live weapon model,
native playback follows every switch, including knife and grenade.
Native HLTV mode also preserves local spectator state during demo prediction,
enabling first-person/chase/free-look modes, WASD free-flight, and next/previous
player cycling without affecting POV demos. In-eye highlight playback suppresses
the spectator picture-in-picture renderer and its black-bar backgrounds. It also
resets stale second-pass render state and restores a full-screen viewport every
native HLTV frame, preventing split or partially black frames while player
selection and fast-forward state settle. It also suppresses
the automatic dead-spectator scoreboard while retaining the explicit Tab view.
While the automatic director is active, legacy chase-mode commands retain their
target changes but render in-eye, avoiding cameras embedded in killed players;
manual HLTV spectator controls still disable the director and select any mode.
Local HLDEMO playback additionally clears the stale local-player muzzleflash
bit on the client side before rendering. The selected HLTV weapon only replaces
the viewmodel identity. Both native spectator paths leave sequence, frame and
animation time to recorded weapon events. Native HLTV supplies one animation
clock and one muzzle token per real first-person weapon event, so missing local
clientdata cannot pin a firing studio event to every rendered frame. A
frag-selected weapon is applied independently of the recorded observer mode.
Per-player FOV updates from the HLTV stream drive native in-eye playback, so
recorded sniper zoom and the scope overlay follow the selected player instead
of the director camera. Custom presentation modes draw a weapon-dependent CS
crosshair from that same live model; knife, grenades and sniper rifles suppress
the regular sight, while firearms retain their period-specific base gap.
The app keeps all native spectator cvars disabled for POV demos, which
retain the original CS/Xash view, animation and weapon pipeline.
Its SHA-256 is
`1978070449258c185ba88a5d0c2ec1b5c39b1550f2b5d68385806163f061627c`.
