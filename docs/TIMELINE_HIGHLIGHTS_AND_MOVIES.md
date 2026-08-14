# Tidslinje, fragganalys och dynamiska CS-filmer

## Syfte

Det här dokumentet beskriver nästa större lager ovanpå HLTV Replay Lab:

1. analysera ett GoldSrc-demo en gång;
2. skapa ett versionsmärkt eventindex;
3. visa en klickbar tidslinje och fraglista;
4. kunna söka till en händelse utan att läsa om hela demot i normal hastighet;
5. rangordna de mest intressanta sekvenserna;
6. använda samma analys för att skapa en dynamisk CS-film.

Planen gäller i första hand Counter-Strike-demos i HLDEMO-format 5 och
nätprotokoll 46–48. All versionsspecifik avkodning ska ligga bakom explicita
kompatibilitetsprofiler. UI, eventmodellen och highlight-logiken ska inte känna
till enskilda demos, kartor, spelarnamn eller lag.

Detta är en målbild och implementationsplan. Spelaren kan nu läsa metadata,
bygga och cacha ett schema-v2-index med spelarsessioner, ronder, DeathMsg,
bombhändelser, POV-perspektiv, FragScore, RoundScore och highlight-moments samt
visa filtrerbara topplistor. Fragklick har en första restart/snabbspolningslösning.
Vanliga fragklick kan använda inspelad POV för fokusspelarens egna frags och
automatiskt följa dödarens player-entity för andra frags med komplett underlag;
den indexerade killer-positionen är fallback när entityn saknas. Protocol-47-POV spelar nu i motorn efter utökat lokalt
signonblock och komplett standard-CS-resursmanifest. Checkpointbaserad seek,
sammanhängande POV-entitytäckning och filmexport återstår.

## Produktmål

En användare ska kunna öppna ett demo och inom kort få:

- en översikt över alla ronder och frags;
- en tidslinje med lagfärger och tydliga eventmarkörer;
- en sorterbar fraglista;
- ett klick som startar uppspelningen några sekunder före valt frag;
- automatiska grupper som dubbelkill, trippelkill och clutch;
- en förklarad ranking av demots bästa moment;
- möjlighet att skapa en shot list och senare en färdig film.

Analysen ska vara deterministisk. Samma demo, analysversion och konfiguration ska
alltid ge samma index och ranking.

## Icke-mål för den första versionen

- Att en språkmodell ensam ska avgöra vad som är coolt.
- Att gissa HP, wallbang, no-scope eller andra signaler som saknas i demot.
- Att direkt stödja alla GoldSrc-moddar.
- Att lova frame-exakt godtycklig seek innan checkpoints finns.
- Att distribuera Counter-Strike-resurser eller upphovsrättsskyddad musik.

## Grundprinciper

### Analysera en gång, återanvänd överallt

Tidslinjen, fraglistan, sökningen, highlight-rankingen och filmgeneratorn ska
läsa samma normaliserade index. Ingen av dessa funktioner ska behöva avkoda
råa demopaket på egen hand.

### Fakta och slutsatser hålls isär

Indexet lagrar både observerade fakta och härledda värden:

- `observed`: värdet fanns uttryckligen i demot;
- `derived`: värdet räknades fram från andra event;
- `unknown`: demot gav inte tillräcklig information.

Exempel: en DeathMsg kan ge killer, victim och vapen direkt. En 1v3-situation
är härledd från round state. HP ska vara `unknown` om gamla HLTV-strömmar inte
skickar spectator-health.

### Inga demo-specifika specialfall

Skillnader ska uttryckas som protokoll- eller resursprofiler. En fix får inte
testa på exempelvis `r60_sthlm.dem`, `de_train` eller ett visst spelarnamn.

### Förklarbar ranking före maskininlärning

Första rankingen ska bestå av synliga regler och vikter. Varje moment får en
lista med orsaker, exempelvis `3 kills på 4,2 s`, `2 headshots` och `1v3`.
Maskininlärning kan senare justera vikterna med mänskliga omdömen.

## Övergripande arkitektur

```text
DemoSource
   │
   ▼
Header + directory inspection
   │
   ▼
Protocol-aware packet parser
   │
   ├──► normalized events
   ├──► periodic replay checkpoints
   └──► optional thumbnails / preview clips
             │
             ▼
       DemoAnalysisIndex
        │      │       │
        │      │       └──► movie planner / renderer
        │      └──────────► highlight analyzer
        └─────────────────► timeline, filters and frag list
```

### Rekommenderade moduler

```text
src/analysis/
  schema.ts                 Versionsmärkt indexschema
  demo-analyzer.ts          Orkestrering
  packet-decoder/           Protokollprofiler 46–48
  event-normalizer.ts       Råmeddelanden till domänevent
  round-reducer.ts          Härleder rond- och alive-state
  moment-builder.ts         Grupperar event till moment
  highlight-scorer.ts       Förklarbar ranking
  checkpoint-builder.ts     Seekunderlag
  analysis-worker.ts        Kör analys utanför UI-tråden

src/timeline/
  timeline-store.ts
  timeline-layout.ts
  timeline-filters.ts

src/replay/
  replay-controller.ts
  seek-controller.ts
  checkpoint-cache.ts

src/movie/
  shot-planner.ts
  beat-grid.ts
  movie-project.ts
  render-queue.ts
```

Modulnamnen är vägledande. Viktigare än filstrukturen är att paketavkodning,
normalisering, ranking och rendering förblir separata lager.

## Demoidentitet och cache

Varje analys ska identifieras av:

- SHA-256 för hela demofilen;
- demo- och nätprotokoll;
- kartnamn och GoldSrc-kart-CRC;
- analysatorns schemaversion;
- parser-/motorversion;
- konfigurationshash för ranking och checkpoints.

Ett cache-ID kan exempelvis vara:

```text
sha256(demo) + schemaVersion + analyzerVersion + configHash
```

Ändras parsern eller indexschemat ska gamla index migreras eller byggas om. Ett
index från fel demo får aldrig användas bara för att filnamnet är samma.

## Tidsmodell

Flyttal i sekunder räcker för presentation men är olämpliga som primär identitet.
Varje event bör minst ha:

- `demoTimeMs`: monoton demotid i heltalsmillisekunder;
- `packetOrdinal`: paketordning för event med samma tid;
- `directoryEntry`: ursprungligt katalogsegment;
- `byteOffset`: rå position när den är känd;
- `roundId`: härledd rondidentitet;
- `eventId`: stabilt ID inom analysindexet.

Spelaren kan visa `1:37.420`, men sortering och seek använder tid plus paketordning.

## Normaliserat indexschema

Ett förenklat TypeScript-kontrakt:

```ts
type Evidence = 'observed' | 'derived' | 'unknown';

type DemoAnalysisIndex = {
  schemaVersion: 2;
  analyzerVersion: string;
  demo: {
    sha256: string;
    name: string;
    durationMs: number;
    demoProtocol: number;
    networkProtocol: 46 | 47 | 48;
    compatibilityProfile: string;
    mapName: string;
    mapChecksum: number;
    isHltv: boolean;
  };
  players: PlayerIdentity[];
  rounds: RoundSummary[];
  events: ReplayEvent[];
  moments: HighlightMoment[];
  checkpoints: ReplayCheckpointRef[];
  diagnostics: AnalysisDiagnostics;
};
```

### Spelaridentitet

Spelarens slotnummer är inte en stabil identitet genom hela demot. En person kan
ansluta igen eller byta namn. Indexet bör därför skilja på:

- `slot`: motorns aktuella player slot;
- `sessionId`: en sammanhängande anslutning i samma slot;
- `playerId`: analysens bästa stabila identitet;
- namn- och laghistorik med tidsintervall;
- Steam-ID när det faktiskt finns, annars `unknown`.

### Eventtyper

Första versionen bör kunna normalisera:

- `round_start`, `round_end`;
- `player_join`, `player_leave`, `player_rename`;
- `team_change`, `spawn`, `death`;
- `bomb_pickup`, `bomb_drop`, `bomb_plant`, `bomb_defuse`, `bomb_explode`;
- `weapon_fire` när protokollet ger tillförlitlig information;
- `radio`, `chat`;
- `camera_target_change`;
- `score_update`;
- `position_sample` och `view_angle_sample` med kontrollerad frekvens.

Okända råmeddelanden ska räknas och rapporteras i diagnostiken, inte ignoreras
tyst om de kan påverka analysens korrekthet.

### Exempel på frag-event

```json
{
  "eventId": "event-1842",
  "type": "death",
  "demoTimeMs": 97340,
  "packetOrdinal": 28191,
  "roundId": "round-3",
  "killerPlayerId": "player-4",
  "victimPlayerId": "player-9",
  "weapon": "deagle",
  "headshot": true,
  "teamKill": false,
  "worldKill": false,
  "positions": {
    "killer": [118.5, -904.0, 72.0],
    "victim": [704.0, -512.25, 16.0],
    "evidence": "derived"
  },
  "healthBefore": {
    "value": null,
    "evidence": "unknown"
  }
}
```

## Analysflöde

### 1. Inspektion

Den befintliga `goldsrc-demo.ts` läser HLDEMO-headern, katalogen, kartan,
protokollet och varaktigheten. Detta blir ingången till analysatorn.

Inspektionen ska avvisa orimliga offsetvärden, längder och antal poster innan
någon större allokering görs.

### 2. Paketavkodning

Parsern går genom katalogsegment och nätmeddelanden utan att rendera. Den ska
återanvända samma protokollregler som uppspelningsmotorn:

- protokoll 46:s fem bitar för weapon index;
- skillnader i serverdata och HLTV-payload;
- user-message-registrering;
- delta tables, baselines och entity updates;
- bevarad paketordning.

Protokollskillnader ska registreras i en profiltabell eller separata decoders,
inte spridas som anonyma `if (protocol < 47)` över hela analyskoden.

### 3. Eventnormalisering

Råmeddelanden omvandlas till ett litet, stabilt domänspråk. Exempelvis blir
olika versioner av DeathMsg samma normaliserade `death`-event.

Normaliseraren ska spara källreferens så att ett fel kan spåras tillbaka till
råpaketet.

### 4. State reduction

En reducer går kronologiskt genom eventen och bygger replay-state:

- aktiv rond och rondresultat;
- lag per spelare;
- alive/dead;
- aktuell position och blickvinkel;
- observerat vapen;
- bombstatus;
- kända respektive okända HP-värden;
- score och deaths.

Round state måste kunna återställas från checkpoint och får inte vara beroende
av att UI:t tidigare har öppnat scoreboarden.

### 5. Momentbyggare

När faktaindexet är klart grupperas event till moment. En första regel:

- starta ett moment vid ett frag;
- lägg till nästa frag av samma spelare om avståndet är högst sex sekunder;
- stäng momentet när tidsfönstret löper ut eller ronden avslutas;
- tillåt ett kortare pre-roll och längre post-roll utan att ändra faktaeventens tid.

Fönstret ska vara konfigurerbart. Momentbyggaren får senare slå ihop närliggande
moments om de ingår i samma clutch eller retake.

## Tidslinjens UX

### Huvudtidslinje

Tidslinjen bör innehålla flera visuella lager:

1. rondband med alternerande bakgrund;
2. röda och blå fragmarkörer;
3. större eller staplade markörer för multikills;
4. bomb plant, defuse och explosion som egna symboler;
5. vald spelares aktivitet;
6. nuvarande uppspelningstid och buffrad/checkpointad del;
7. highlight-score som en diskret heatmap.

Markörer som ligger tätt klustras på översiktsnivå och delas upp när användaren
zoomar in.

### Fraglista

Varje rad visar minst:

```text
1:37.420  Dime → cater  Deagle  HS
```

Listan kan filtreras på:

- spelare;
- lag;
- rond;
- vapen;
- headshot;
- multikill;
- minimum highlight-score;
- eventtyp.

Klick på en fraggrad väljer eventet, flyttar tidslinjen och startar normalt tre
sekunder före fragget. Shift-klick kan lägga momentet i en film- eller spellista.

### Detaljpanel

Ett valt moment visar:

- kills i ordning;
- karta, rond och bombstatus;
- hur många spelare som var vid liv;
- tillgängliga positioner och avstånd;
- highlight-score;
- förklaringar och evidensnivå;
- knappar för `Spela`, `Lägg till i film` och senare `Rendera preview`.

### Tillgänglighet och styrning

- Markörer får inte enbart skiljas med färg.
- Tangentbord ska kunna gå till föregående/nästa event.
- En tabellvy ska finnas för skärmläsare.
- Tider och filter ska gå att kopiera som länkbart state.

## Seek och checkpoints

### Varför direkt byte-seek inte räcker

GoldSrc-demos är sekventiella och deltakomprimerade. Ett paket kan vara beroende
av delta tables, baselines, entity state och user messages som kom långt tidigare.
Att hoppa direkt till en byte-offset kan därför ge fel värld, HUD eller spelare.

### Fas A: restart och snabbspolning

Första fungerande seek:

1. stoppa aktuell uppspelning;
2. starta demot från början;
3. stäng av rendering och ljud;
4. kör uppspelningen med hög timescale;
5. sakta ner vid `target - preRoll`;
6. slå på rendering och ljud;
7. börja normal uppspelning vid vald punkt.

Detta är enkelt och korrekt men blir långsamt sent i långa demos.

### Fas B: logiska checkpoints

Analysatorn skapar checkpoints exempelvis var femte eller tionde sekund och vid
rondstart. Ett checkpoint behöver minst referera till:

- demotid, paketordning och byte-offset;
- aktiva delta tables och baselines;
- aktuell entity/player state;
- player sessions, lag och alive-state;
- scoreboard och bomb state;
- kamera och clientdata;
- relevanta HUD/user-message-tillstånd;
- parserns protokollspecifika state.

Vid seek laddas närmaste checkpoint före målet och endast den korta återstående
sträckan snabbspolas.

### Fas C: visuell motorsnapshot

För nästintill omedelbar seek kan Xash-motorn exportera och importera en komplett
replay-snapshot. Den måste också hantera temporära entities, corpse-animationer,
ljudkanaler, klient-DLL-state och andra visuella effekter.

En logisk checkpoint är enklare och bör komma först. En motorsnapshot får aldrig
bli det enda analysformatet eftersom den blir hårt kopplad till en WASM-build.

### Seek-acceptanskriterier

- Samma target ger samma spelare, kamera, vapen och score som linjär uppspelning.
- Seek över rondgräns återställer alive- och bomb-state korrekt.
- Ljud från snabbspolningsintervallet spelas inte i efterhand.
- Gamla corpses och temporära effekter läcker inte mellan seeks.
- UI visar tydligt när en dold snabbspolning pågår.

## Highlight-analys

### Kandidatsignaler

| Signal | Källa | Kommentar |
|---|---|---|
| Antal kills | DeathMsg | Stark grundsignal |
| Tid mellan kills | Demotid | Kortare intervall ger högre intensitet |
| Headshots | DeathMsg när tillgängligt | Observerad, aldrig gissad |
| Vapen | DeathMsg/weapon state | Knife, Deagle och liknande kan viktas |
| Opening kill | Round state | Första riktiga fragget i ronden |
| Clutch | Alive-state | Exempelvis 1v3 före första clutch-killen |
| Round win impact | Round end | Momentet kopplas till vunnen/förlorad rond |
| Bomb context | Bomb events | Plant defense, retake, defuse denial |
| Avstånd | Positioner | Endast när båda positionerna är tillförlitliga |
| Flick | View angles + target direction | Kräver stabila vinkel- och positionssamples |
| Låg HP | Health events | `unknown` i demos som saknar HP |
| Eco/upset | Equipment + round state | Senare fas; kräver säker loadoutanalys |
| Wallbang/no-scope | Trace/FOV/events | Får inte antas från enbart vapennamn |

### Basmodell för scoring

En transparent första modell kan vara:

```text
score =
  killCountBase
  + multiKillBonus
  + headshotBonus
  + weaponDifficultyBonus
  + clutchBonus
  + roundImpactBonus
  + bombContextBonus
  + precisionBonus
  - uncertaintyPenalty
```

Alla komponenter normaliseras och begränsas så att en enskild brusig signal
inte kan dominera. Slutscore kan visas som 0–100 men internt behålla delpoäng.

Precisionen baseras på observerade `events/<weapon>.sc` per player-entity.
En burst fortsätter medan skottgapet är högst 400 ms: 1 skott ger +15, 2 ger
+10, 3–4 ger +5, 5–8 ger 0 och 9+ ger ett gradvis avdrag ned till −10. Kill
inom 250 ms ger +5. Ett nytt offer inom samma sammanhängande burst ger +12 för
spray-transfer. Saknad skottevidens ger varken bonus eller avdrag.

Exempel på förklaring:

```json
{
  "score": 94,
  "reasons": [
    { "code": "multi_kill", "label": "3 kills på 4,2 sekunder", "points": 28 },
    { "code": "headshots", "label": "2 headshots", "points": 12 },
    { "code": "clutch", "label": "Vinner en 1v3", "points": 34 },
    { "code": "round_win", "label": "Avgör ronden", "points": 20 }
  ],
  "uncertainties": ["health_unknown"]
}
```

### Mångfald i resultatet

En topplista ska inte automatiskt bestå av tio nästan identiska AWP-frags från
samma spelare. Efter grundscore appliceras en presentationsranking som kan:

- begränsa antal moment per spelare;
- blanda clutch, multikill, Deagle, AWP och knife;
- undvika överlappande tidsintervall;
- ge användaren profiler som `Bästa totalt`, `Mest action`, `Bästa per spelare`
  och `Filmisk variation`.

Grundscore får inte skrivas över; presentationsrankingen är ett separat lager.

### Senare maskininlärning

När användare har markerat `bra`, `inte bra` och ändrat ordning kan systemet
samla feature-vektorer och lokala etiketter. En enkel rankingmodell kan sedan
lära vikter. Den ska fortfarande returnera förklaringar och aldrig ersätta
saknade fakta med hallucinerade attribut.

## Previews och thumbnails

Tidslinjen kan fungera utan previews. När seek är stabil kan analysen generera:

- en thumbnail vid varje viktigt event;
- en kontaktkarta per rond;
- en kort, lågupplöst loop för högt rankade moments.

Previews ska skapas från checkpoints eller en renderkö. Att starta en ny full
WASM-instans för varje markör blir för dyrt.

## Dynamisk CS-film

### Movie project

Filmsteget ska skapa ett redigerbart projekt före rendering:

```ts
type MovieProject = {
  version: 1;
  demoHash: string;
  resolution: { width: number; height: number; fps: number };
  soundtrack?: SoundtrackRef;
  shots: MovieShot[];
  overlays: MovieOverlay[];
  transitions: MovieTransition[];
};
```

### Shot plan

Varje highlight omvandlas till en eller flera shots:

- POV med 2–4 sekunders pre-roll;
- eventuell chase/free-camera-establishing shot;
- normal hastighet fram till action;
- valbar slow motion nära träffen;
- post-roll som visar konsekvensen och rondresultatet;
- namn, lag, vapen och fragnummer som overlay.

Shot planner ska välja kamera efter tillgänglig data. POV är säkrast. Fria
kameror kräver korrekt rekonstruerade spelpositioner, kollisionskontroll och en
regel som undviker väggar.

### Musik och beat grid

Musikfilen analyseras till:

- BPM och beatpositioner;
- taktslag och starka downbeats;
- energi över tid;
- möjliga intro-, build-up- och drop-sektioner.

Cuts, första skottet och multikill-toppar kan flyttas inom små toleranser för
att möta beats. Replay-fakta ändras aldrig; bara shotens in-/utpunkt och speed
ramp justeras.

Användaren ansvarar för rättigheter till musiken. En framtida tjänst bör erbjuda
royalty-free-spår eller användarens egen fil, inte paketera kommersiell musik.

### Renderstrategier

1. **Browser preview:** WebGL-canvas + WebCodecs när tillgängligt.
2. **Lokal render worker:** headless Chromium och FFmpeg på användarens dator.
3. **Server render:** isolerad kö med signerade demo-/assetreferenser.

MovieProject ska vara renderaroberoende så att samma klippning kan förhandsvisas
i webbläsaren och slutrenderas i hög kvalitet någon annanstans.

### Film-HUD och visuella presets

Filmverktyget ska kunna lägga samma polerade lager direkt över liveuppspelningen
i browsern och över slutrenderingen. Första presetfamiljer:

- `Clean broadcast`: lagfärger, rundscore, bombtimer, kompakt killfeed och
  diskret player card;
- `Cinematic minimal`: nästan HUD-fritt, endast namn/vapen vid POV-byte och
  korta ace-/clutch-callouts;
- `Fragmovie neon`: animerad typografi, träff-/impactmarkörer, multikillkedja,
  speed ramps och färgaccent synkad mot musik;
- `Tactical/X-ray`: lagkonturer, granatbanor, siktlinjer och positioner när
  analysens evidens räcker;
- `Director clean`: helt ren bild för extern redigering.

Kameralagret bör senare stödja dolly, orbit och establishing shots, automatisk
bullet-time runt verifierade träffar samt mjuka övergångar mellan POV, chase och
freecam. Alla lager ska vara valbara och hålla typografi, motion och färgprofil
konsekventa i både interaktiv browseruppspelning och exporterad film.

## Lokal tjänst och framtida online-API

För lokal användning kan indexet lagras i IndexedDB eller bredvid demot. En
framtida onlinetjänst kan exponera:

```text
POST /api/demos                         registrera/ladda upp demo
GET  /api/demos/:id/analysis            hämta indexstatus
GET  /api/demos/:id/timeline            hämta kompakt timeline
GET  /api/demos/:id/events              filtrerade event
POST /api/demos/:id/analyze              starta/bygg om analys
POST /api/demos/:id/movie-projects       skapa shot list
POST /api/movie-projects/:id/renders     starta render
```

Stora positionssamples bör ligga i separata binära chunks. Timeline och fraglista
ska inte behöva ladda hela rörelsespåret.

## Prestanda

### Browseranalys

- Kör parser och scoring i Web Worker.
- Streama demo via Range eller `File.stream()`.
- Skicka progress per katalogsegment och demotid.
- Undvik att kopiera stora `ArrayBuffer`; överför ägarskap.
- Spara delresultat per avslutat segment.
- Begränsa positionssamples adaptivt, exempelvis högre frekvens nära action.

### Indexstorlek

Frag-, rond- och bombindex är litet. Positioner och vinklar dominerar storleken.
De kan komprimeras genom:

- delta encoding;
- kvantiserade koordinater och vinklar;
- chunkning per rond eller tidsfönster;
- lägre sampling när ingen action sker;
- separat lazy-loadad binary blob.

## Robusthet och säkerhet

Demofiler är opålitlig binär input. Parsern måste:

- bounds-checka varje läsning;
- begränsa strängar, antal entities, user messages och katalogposter;
- avvisa offsetoverflow och negativa längder;
- inte skapa filvägar direkt från demonamn;
- kunna avbrytas;
- rapportera partiell analys utan att kalla den komplett;
- fuzztestas med trunkerade och muterade fixtures.

En serveranalysator ska köras isolerat med CPU-, minnes- och tidsgränser.

## Diagnostik och datakvalitet

Varje analys ska summera:

- antal avkodade paket och user messages;
- okända eller avvisade meddelanden;
- antal ronder, frags och spelarsessioner;
- tidsintervall med saknad entity state;
- vilka features som kunde respektive inte kunde beräknas;
- checkpoint coverage;
- parserwarnings med byte-offset och packet ordinal.

UI:t kan visa exempelvis:

```text
Analyskvalitet: 92 %
HP: saknas i detta demo
Positioner: 99,4 % coverage
Headshot-data: tillgänglig
Ronder: 24/24 kompletta
```

## Teststrategi

### Fixtures

Minst en fixture per relevant kombination:

- HLTV protokoll 46;
- POV protokoll 46 om tillgängligt;
- protokoll 47;
- protokoll 48;
- flera kart-CRC-varianter;
- reconnect/name change;
- suicide, teamkill och world kill;
- bomb plant, defuse och explosion;
- demo utan TeamInfo/ScoreInfo;
- demo utan spectator-health;
- trunkerad/korrupt fil.

### Golden index

Små anonymiserade eller lokala demos får en golden JSON med förväntade event.
Testet jämför eventtyp, tid, spelare, vapen och rond. Ändringar i golden-filer ska
kräva en motiverad schema- eller parserändring.

### Seek-verifiering

För valda tidpunkter jämförs linjär uppspelning och seek från checkpoint:

- kameraorigin och vinklar;
- synliga entities och animationer;
- viewmodel och vapen;
- scoreboard/alive-state;
- bombstatus;
- HUD-läge.

Bilddiff kan komplettera statejämförelsen men får inte vara det enda testet.

### Highlight-verifiering

Scoringtest använder syntetiska eventsekvenser så att en 1v3, ett vanligt frag
och en trippelkill får förväntade delpoäng och förklaringar. Vikter snapshots-
testas separat från eventparsern.

## Etappindelning

### Etapp 1: faktaindex och fraglista

Leverans:

- versionsmärkt schema;
- parserprogress i worker;
- spelare, ronder och DeathMsg;
- fraglista med filter;
- export/import av index-JSON.

Klart när alla kända frags i testdemos kan jämföras mot demots kill feed och
analysen kan köras två gånger med identiskt resultat.

### Etapp 2: visuell tidslinje

Leverans:

- rondband;
- lagfärgade fragmarkörer;
- bombhändelser;
- zoom, hover och urval;
- länkbart valt event.

### Etapp 3: fungerande seek

Leverans:

- restart + dold snabbspolning;
- pre-roll;
- seekstatus i UI;
- korrekt ljudhantering.

### Etapp 4: checkpoints

Leverans:

- checkpointformat;
- cache per demo-/motorversion;
- seek från närmaste checkpoint;
- determinismtest mot linjär uppspelning.

### Etapp 5: highlight-ranking

Leverans:

- momentgruppering;
- transparent 0–100-score;
- orsaker och osäkerheter;
- topplistor och variationsprofiler;
- manuell markering och omordning.

### Etapp 6: filmprojekt och preview

Leverans:

- redigerbar shot list;
- POV-klipp med pre-/post-roll;
- enkla overlays och transitions;
- musikens beat grid;
- lågupplöst preview.

### Etapp 7: högkvalitativ render

Leverans:

- reproducerbar lokal/serverbaserad render;
- hög upplösning och stabil FPS;
- ljudmix;
- MP4-export;
- renderlogg kopplad till MovieProject-version.

## Genomförd första implementation

Den första vertikala skivan blev:

1. definiera och versionshöja till schema v2;
2. extrahera DeathMsg med demotid och packet ordinal;
3. härleda spelarsessioner, lag och ronder;
4. lagra index lokalt;
5. visa en enkel fraglista;
6. klicka en fraggrad och göra restart + snabbspolning till tre sekunder före;
7. jämföra resultatet med linjär uppspelning.

Det bevisar hela kedjan från rå demo till användbar navigation. Förklarbar
scoring och POV-/HLTV-perspektiv är därefter implementerade; fria kameror,
checkpoints och filmrendering återstår.

## Beslut som bör vara konfigurerbara

- pre-roll och post-roll;
- multikillfönster;
- checkpointintervall;
- scoringvikter;
- presentationsprofil och max moment per spelare;
- positionssamplingsfrekvens;
- lokal kontra serverbaserad analys;
- preview- och slutrenderingskvalitet.

Konfigurationen ska ingå i cacheidentiteten när den påverkar analysresultatet.

## Öppna tekniska frågor

- Ska den första paketparsern vara ren TypeScript eller en delad WASM-modul från
  motorlogiken?
- Vilken minsta state behövs för en korrekt logisk checkpoint i CS16Client?
- Kan user-message-registrering och delta tables exporteras stabilt från Xash?
- Hur mycket positionssampling behövs för bra flick- och kamerabedömning?
- Ska corpse/temp-entity-state återskapas eller rensas vid seek nära en kill?
- Vilken renderstrategi ger stabilast frame pacing på Mac och i headless Linux?
- Vilka demos kan lagligt användas som permanenta automatiska testfixtures?

Dessa frågor blockerar inte etapp 1. Faktaindex och fraglista kan byggas först och
ger mätdata som gör checkpoint- och renderbesluten betydligt enklare.
