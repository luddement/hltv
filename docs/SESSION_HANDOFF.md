# Session handoff

## Projekt

HLTV Replay Lab är en lokal webbläsarspelare för gamla Counter-Strike/GoldSrc-
demos. Arbetskatalog:

```text
/Users/ldmnt/Code/hltv
```

App:

```text
/Users/ldmnt/Code/hltv/app
```

Lokal server har körts på:

```text
http://127.0.0.1:43173
```

## Nuvarande fungerande läge

- HLDEMO-format 5 och GoldSrc-protokoll 46–48 har kompatibilitetsprofiler.
- `r60_sthlm.dem` spelas i webbläsaren med rätt historisk `de_train`-variant.
- Kartor väljs med GoldSrc-kart-CRC, inte bara filnamn.
- Spelare, viewmodels, vapen, HUD och radar renderas.
- Inspelad HLDEMO-kameraorigin samt pitch/yaw används.
- Viewmodel flyttas tillsammans med den inspelade kameran.
- Gamla replay-menyer undertrycks utan `slot10`, som annars kan gömma vapnet.
- Legacy-scoreboard har lag, färger, score, deaths och latency.
- Saknade TeamInfo/ScoreInfo härleds från spelarmodeller och death-events.
- Okänd spectator-HP visas inte som falsk `(0)`.
- Stale dead-player entities döljs medan riktig ClCorpse-animation tillåts.
- Corpses ligger kvar cirka tio sekunder.
- HUD skalar upp via replayprofilens `hud_scale 1280`.
- Äldre SayText/radio håller på att återfå lagfärgat avsändarnamn och gul text.
- `DemoAnalysisIndex` schema v2 finns i `src/analysis/schema.ts`.
- Den vendorerade, protokollkompatibla HLViewer-parsern har ett kompakt
  `Replay.parseAnalysisFrames`-pass som behåller user-info och råa user messages
  med demotid, paketordning, katalogsegment och byte-offset.
- `demo-analyzer.ts` normaliserar spelarsessioner, namn-/laghistorik, ronder,
  DeathMsg och bomb-/rondhändelser. Observerade och härledda värden har separata
  evidensmarkeringar; saknade Steam-ID:n och spelarreferenser är `unknown`.
- Analysindexet cachas i IndexedDB. Cache-ID:t innehåller demo-SHA-256, schema-,
  analysator- och parserversion, kompatibilitetsprofil, båda WASM-versionerna och
  hashad analyskonfiguration.
- Filinläsning, SHA-256, cacheuppslag, HLViewer-parsning och eventnormalisering
  körs nu i en separat Web Worker. UI-tråden får faktisk progress från lästa byte,
  katalogsegment/demotid och normaliserade analysframes.
- Workern strömmar URL eller `File` till en förallokerad buffer och överför samma
  buffer tillbaka till huvudtråden för uppspelning utan en extra kopia.
- Golden-fixtures för parser-output täcker protokoll 46, 47 och 48 samt suicide,
  reconnect, observerad teamkill, rename och world kill. Binära end-to-end-
  goldens kör dessutom de lokala protokoll 46- och 47-demosen genom HLViewer.
- Suicide och world kill klassas före lagjämförelsen och får härledd
  `teamKill: false`.
- `round-alive-reducer.ts` äger nu rond-, lag- och alive-state och har isolerade
  tester för reset, disconnect, death och round winner.
- `svc_serverinfo.playerIndex` identifierar POV-spelaren utan filnamnsgissning.
  Schema v2 lagrar `hltv`/`pov`, fokusspelare och fokuslagets historik.
- `highlight-analyzer.ts` bygger förklarbara FragScore, multikill-moments och
  lagvisa RoundScore 0–100 med confidence och poängorsaker. POV inkluderar endast
  fokuslaget; egna frags markeras inspelad POV och lagkamratfrags killfeed-only.
- HLTV-UI:t visar toppmoments, toppronder, fragbetyg och T/CT-filter. POV-UI:t
  tillämpar fokuslaget automatiskt.
- Analysator 2.3 mäter player-entity och sparar faktiska positioner/vinklar vid
  varje frag. I det
  lokala POV-demot `cstrike/as.dem` har 5 av 12 lagkamratfrags alla tre signalerna
  i fragpaketet, alltså 42 % första rekonstruktionskandidater.
- Vapnens nätverkade `.sc`-events indexeras per skytt och skott. FragScore ger
  +15/+10/+5 för 1/2/3–4 skott, 0 för 5–8, gradvis −1 till −10 från 9 skott,
  +5 för kill inom 250 ms och +12 för en observerad spray-transfer. POV-listor
  visar bara fokusspelarens verkligt spelbara frags; HLTV visar alla spelare.
- Fraglistan har ingen separat experimentpanel eller kameraoverlay. Ett vanligt
  klick använder inspelad POV för fokusspelarens egna frags och aktiverar
  automatiskt dödarens entity-kamera för andra frags när position/vinklar finns.
  Kameran följer den levande player-entityn under klippet och faller tillbaka på
  den indexerade fragpositionen om entityn saknas i POV-paketet.
- CS16Client-WASM har reproducerbara, opt-in cvars för kameraoverride och
  entity-följning. Originalets HUD/viewmodel lämnas synliga; de kan inte
  rekonstrueras autentiskt för en lagkamrat ur ett enskilt POV-demo.
- I riktiga HLTV-demos väljer fragklick nu dödarens entity-slot, stänger av
  autodirector och kör native in-eye även när Xash inte sätter GoldSrcs
  `spectate-only`-flagga vid lokal uppspelning. Fraggets observerade vapen laddas
  som viewmodel sist i renderingspasset eftersom äldre HLTV-entities kan bära
  ett stale weaponmodel-fält. Riktiga live-vapenbyten är ännu inte lösta.
- Samma opt-in HLTV-läge bevarar spectator-state över demots player-prediction.
  `Space` växlar first-person/chase/free look/overview, `WASD + mus` flyger i
  Free Look, och Mus1/Mus2 väljer nästa/föregående levande spelare. Cvarn sätts
  explicit till noll för POV-demos vid start och under hela signonperioden.
- Startsidan visar en filtrerbar fraglista med spelare, fritext och headshotfilter.
- Fragklick är kopplat till fas-A-seek: restart, avstängd bild/ljud, snabbspolning
  och normal uppspelning tre sekunder före fragget.

Verifierat i `r60_sthlm.dem`: 243 riktiga DeathMsg-events, 66 headshots, 37
identifierade ronder, 12 spelarsessioner, 5 suicides och 1 world kill. Ett
registreringsmeddelande med namnet DeathMsg räknas korrekt inte som frag. Indexet
laddas från lokal cache vid omladdning. Det lokala protokoll 47-demot `cstrike/as.dem`
ger 45 DeathMsg-events, 12 headshots och 10 spelarsessioner.

Protocol-47-uppspelningen är även visuellt verifierad i Xash: `as.dem` har ett
375 769-byte signonpaket, över motorns tidigare Emscripten-gräns på 196 608 byte.
WebAssembly-bygget tillåter nu 512 KiB och det lokala manifestet inkluderar
standard-CS-modeller, ljud och events i stället för att bara återanvända
protocol-46-demots resurslista. `de_train`, POV/HUD, killfeed, seek till 7:29.879
och den märkta lagkamratkameran renderar utan demo-/JavaScriptfel.

## Reproducerbara motorbyggen

Dokumentation och SHA-256 finns i:

```text
app/engine-patches/README.md
```

Viktiga filer:

```text
app/engine-patches/xash3d-protocol46.patch
app/engine-patches/xash-protocol46.wasm
app/engine-patches/cs16-client-hltv.patch
app/engine-patches/cs16-client-hltv-v14.wasm
app/src/vendor/xash-protocol46.js
```

Temporära källträd som användes för byggen:

```text
/tmp/yohimik-xash3d-fwgs
/tmp/cs16-client-src
```

De kan försvinna vid omstart. Patcharna och de byggda WASM-filerna i repot är
den beständiga källan till ändringarna.

## Beslutat nästa produktsteg

Fortsätt från det nu fungerande versionsmärkta demoindexet, scorelagret och
highlighttopplistorna till en klickbar tidslinje, stabil seek och filmprojekt.
Full plan:

```text
app/docs/TIMELINE_HIGHLIGHTS_AND_MOVIES.md
```

Viktigaste beslutet är att seek ska utvecklas i två steg:

1. första vertikala skivan kan starta om demot och snabbspola dolt;
2. den riktiga lösningen är checkpoints var femte eller tionde sekund samt vid
   rondstart.

Vid klick på ett frag:

1. välj närmaste checkpoint före `fragTime - preRoll`;
2. återställ parser-, entity-, player-, kamera-, HUD-, scoreboard- och bomb-state;
3. snabbspola endast det korta återstående intervallet utan bild eller ljud;
4. slå på rendering och ljud;
5. spela normalt från pre-roll till efter fragget.

Checkpointens cache-ID måste minst innehålla demo-SHA-256, analysversion,
protokollprofil, motor/client-WASM-version och checkpointkonfiguration.

## Rekommenderad start för nästa session

Be nästa Codex-session läsa:

```text
app/docs/SESSION_HANDOFF.md
app/docs/TIMELINE_HIGHLIGHTS_AND_MOVIES.md
app/README.md
app/engine-patches/README.md
```

Föreslagen nästa implementation:

1. mät entity-/positions-/vinkeltäckning över hela pre-/post-roll-fönstret och
   ersätt punktkameran med en interpolerad, tydligt märkt rekonstruktion;
2. komplettera player_join/leave/rename som explicita event samt bombaktör när
   källan tillåter det;
3. ersätt fas-A-seekens tidsuppskattning (GoldSrcs 250 ms-klamp ger cirka 15x
   vid 60 Hz) med motorrapporterad demotid;
4. inför logiska checkpoints och verifiera state mot linjär uppspelning;
5. bygg rondband/tidslinje ovanpå befintliga events, moments och scores.

Användaren har uttryckligen valt checkpointlösningen och vill därefter bygga
automatisk ranking av de coolaste fraggen och dynamiska CS-filmer med musik.

## Kända begränsningar i nya analyslagret

- Parsningen återanvänder HLViewers fulla protokolldecoder och kör i worker.
  Källan läses med stream-progress till en förallokerad `ArrayBuffer`, men själva
  parsern kräver fortfarande hela buffern innan avkodningen börjar.
- Protokoll 48 har en deterministisk golden för normaliseringen men ingen lokal
  binär `.dem`-fixture; den binära decoderns end-to-end-goldens täcker för närvarande
  protokoll 46 och 47.
- `playerId` är för närvarande säkert sessionsbaserat. Steam-ID exponeras inte av
  de observerade fälten och lagras därför som `unknown`; ingen CD-key-hash används
  som dold identitetsgissning.
- Ronder härleds från RoundTime och vinstljud. En påbörjad men ofullständig sista
  rond behålls med okänd vinnare.
- Fragklickets fas-A-sökning kompenserar nu för cirka 1,5 sekunders klient-signon,
  men är fortfarande en tidsuppskattning. Checkpoints och en auktoritativ
  motorklocka krävs fortfarande för seek-acceptanskriterierna i huvudplanen.
- Entityobservationen för POV-lagkamrater gäller ännu bara paketet där fragget
  registreras. Den bevisar inte sammanhängande kamera-, position- eller vinkeldata
  under hela klippets pre-/post-roll.
- Den första kameran är därför ett punktprov: stående ögonhöjd antas (+17 units)
  och riktningen härleds mot offrets observerade position; player-model-vinkeln
  används som fallback. Crouch-state, vapenstate och osedda entities rekonstrueras inte.
- `checkpoints` finns i schema v2 men är tomt tills checkpointbyggaren implementeras.

## Regler som inte ska tappas

- Ingen demo-, karta-, spelare- eller versionsspecifik hårdkodning.
- Saknad data är `unknown`, inte noll eller en gissning.
- Parserfakta, härledda slutsatser och highlight-score ska vara separata lager.
- Samma analysindex ska driva tidslinje, fraglista, ranking och filmprojekt.
- Gamla protokoll måste fortsätta vara isolerade bakom kompatibilitetsprofiler.
- Vapen-/kamerafixen får inte regressera när seek eller checkpoints byggs.

## Verifieringskommandon

```bash
cd /Users/ldmnt/Code/hltv/app
pnpm test
pnpm run check
pnpm run build
HLTV_PORT=43173 pnpm serve
```

Arbetskopian innehåller användarens lokala `cstrike/`-arkiv och andra ocommittade
filer. De får inte raderas, återställas eller massändras.
