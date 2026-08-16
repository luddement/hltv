# HLTV Replay Lab

Lokal webbläsarspelare för gamla Counter-Strike/GoldSrc-demos. Spelaren väljer
kompatibilitetsprofil och exakt kartversion från varje demos header. Den är
verifierad med tre separata inspelningar:

- `r60_sthlm.dem`: HLTV, `de_train`, CRC `d870b4a8`
- `smidig2.dem`: POV, `de_train`, CRC `d870b4a8`
- `phil_eco.dem`: POV, historiska `de_inferno`, CRC `e7e42f71`
- renderade spelarmodeller, handhållna vapen, viewmodel, radar och CS-HUD

Demot och spelresurserna läses från datorn och körs lokalt i WebAssembly. De
laddas inte upp till någon extern tjänst.

## Kör på Mac

```bash
cd /Users/ldmnt/Code/hltv/app
pnpm install
pnpm build
pnpm serve
```

Öppna `http://127.0.0.1:4173` och klicka **Spela matchen**. Servern hittar det
medföljande demot och `game-assets/` automatiskt. Sätt exempelvis
`HLTV_PORT=43173 pnpm serve` om du vill använda en annan port.

Det gamla 32-bitars Windows-spelet behöver inte kunna startas på datorn. Det är
Xash3D-FWGS och CS16Client som kör Counter-Strike-klienten i WebGL2.

## Arkitektur

- `src/demo/goldsrc-demo.ts` läser metadata ur GoldSrc-filen med HTTP Range.
- `src/demo/goldsrc-map-crc.ts` verifierar lokalt valda BSP-filer med GoldSrcs
  riktiga multiplayer-CRC, inte filnamn eller generella filhashar.
- `src/analysis/demo-analyzer.ts` återanvänder den protokollkompatibla parsern
  för att bygga ett versionsmärkt eventindex med spelarsessioner, ronder, frags,
  evidensnivåer och stabila källpositioner.
- `src/analysis/round-alive-reducer.ts` härleder testbart rond- och alive-state.
- `src/analysis/highlight-analyzer.ts` bygger förklarbara FragScore, moments och
  lagvisa RoundScore 0–100. POV-demos filtreras automatiskt till inspelarens lag.
- `src/analysis/analysis-worker.ts` läser, hashberäknar, cachar och analyserar
  demot utanför UI-tråden samt rapporterar byte-, katalog- och frame-progress.
- Analysindex cachas lokalt i IndexedDB efter demo-SHA-256, parser-/WASM-version
  och analyskonfiguration. Samma index driver den filtrerbara fraglistan.
- `src/services/demo-engine.ts` monterar demot och startar det i Xash3D.
- Fragklick i HLTV-demos låser native in-eye på dödarens entity-slot och visar
  fraggets observerade vapen; POV-demos fortsätter använda sin inspelade vy.
- Vald plats snabbspolas internt av HLDEMO-läsaren utan den tidigare 15×-
  väggklockegränsen; ett hopp till 40:14 verifieras lokalt på cirka sju sekunder
  inklusive motorstart och montering av resurser.
- Under HLTV-uppspelning växlar `Space` spectatorläge, `WASD + mus` styr Free
  Look och Mus1/Mus2 väljer nästa/föregående levande spelare. Kontrollerna
  aktiveras inte för POV-demos.
- `engine-patches/xash3d-protocol46.patch` är den reproducerbara motorpatchen
  för GoldSrc demoformat 5, protokoll 46 och offline-HLTV-uppspelning.
- `engine-patches/xash-protocol46.wasm` är den byggda motorn; SHA-256:
  `7a00694ccae22b8cbb3254033a602a6ac750f7c27e6909ba1e23e6a13ac8f2c4`.
- `server.mjs` strömmar det stora demot och bara de spelresurser uppspelningen
  behöver. Kartor i `game-assets/map-library/` indexeras efter sin beräknade
  GoldSrc-CRC, så flera historiska versioner av samma kartnamn kan samexistera.
- Vite-pluginen i `vite.config.ts` beräknar den ombyggda motorns `EM_ASM`-
  relokering mot den låsta npm-versionen och exponerar motsvarande alias åt
  sidomodulerna.

## Nästa steg

Fragindex, highlight-ranking och den första restart/snabbspolnings-sökningen är
implementerade.
Den tekniska produktplanen för tidslinje, checkpoints, automatisk
highlight-ranking och dynamiska CS-filmer finns i
[docs/TIMELINE_HIGHLIGHTS_AND_MOVIES.md](docs/TIMELINE_HIGHLIGHTS_AND_MOVIES.md).
Målarkitektur, Infrastructure as Code, leverantörsval, säkerhet och en daterad
kostnadsmodell för serverbaserad Endast frags-rendering finns i
[docs/CLOUD_RENDERING_IAC_AND_COSTS.md](docs/CLOUD_RENDERING_IAC_AND_COSTS.md).
Ett kort nuläge för byte av Codex-session finns i
[docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md).

## Verifiering

```bash
pnpm test
pnpm run check
pnpm run build
```

Den anpassade parsern har även körts genom hela demots katalog: en sammanhängande
replay på 3 168,69 sekunder och 317 katalogsegment. Godtycklig seek och
checkpointing ingår i nästa utvecklingsetapp.

## Licenser

Xash3D-FWGS, CS16Client och övriga tredjepartskomponenter behåller sina egna
licenser i respektive paket. Counter-Strike, Half-Life och GoldSrc tillhör
Valve. Spelresurser ska användas från en installation som användaren har rätt
att använda.
