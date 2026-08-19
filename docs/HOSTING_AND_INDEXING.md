# Hosting och indexering

## Beslutsstatus

- **Status:** infrastruktur uppsatt, instans väntar på kapacitet
- **Datum:** 2026-08-17
- **Leverantör:** Oracle Cloud Always Free, region `eu-stockholm-1`
- **Blockerare:** `Out of host capacity` på Ampere A1 — retry-skript kör
- **Princip:** allt tungt körs på Macen eller i besökarens webbläsare; servern
  delar bara ut filer

Det här dokumentet beskriver var demoarkivet ska bo och hur databasen över det
byggs. Molnrendering av filmer är en separat fråga som ligger i
[CLOUD_RENDERING_IAC_AND_COSTS.md](CLOUD_RENDERING_IAC_AND_COSTS.md).

## Arkivet i siffror

Uppmätt 2026-08-16, innan uppackningen kom igång på allvar.

| | Antal | Komprimerat | Uppackat |
|---|---:|---:|---:|
| ZIP (2004–2007) | 584 | 3,93 GiB | 32,81 GiB |
| BZ2 (2006–2009) | 4 770 | 23,94 GiB | 156,81 GiB |
| Redan uppackade `.dem` | 881 | — | 27,93 GiB |
| **Totalt** | **~6 230** | **27,88 GiB** | **217,56 GiB** |

Två tal styr alla beslut nedan: arkivet är **28 GiB komprimerat** men **218 GiB
uppackat**, och demouppspelningen kräver okomprimerade filer eftersom både
header-läsaren och motormonteringen använder HTTP Range.

## Beslut: hosting

### Varför inte Cloudflare

Cloudflare R2 + Pages + Workers + D1 var rätt när stacken behövde en databas och
ett API. Det behovet försvann när katalogen blev en 4 MiB JSON-fil som följer med
bygget: sökning och filtrering sker i webbläsaren, analysen ligger som statiska
JSON-filer, demos är statiska filer med Range. Serversidan är därmed `nginx` och
ingenting annat.

Med tio interna användare på en oindexerad sajt löser CDN, fri egress och
DDoS-skydd inga problem som finns.

### Varför Oracle Always Free

Gratis, EU-region i Stockholm med lägst latens för användarna, och 2 OCPU /
12 GB / 200 GB räcker med marginal. Gratisnivån halverades i juli 2026 från
4 OCPU / 24 GB — allt nedan är dimensionerat mot de **nya** gränserna.

Priset är kapacitetsbrist: Ampere A1 är i praktiken alltid slutsåld och en
instans måste tjatas fram. Se [Kända problem](#kända-problem).

### Diskkravet

218 GiB får inte plats på 200 GB. Lösningen är **btrfs med `compress=zstd:3`**,
uppmätt ratio **6,02** över tolv riktiga demos, vilket ger **~36 GiB på disk**.
Kärnan dekomprimerar per block, så HTTP Range fungerar oförändrat och appen
märker ingenting. Det är också svaret på "kan vi packa upp dynamiskt vid behov" —
ja, och det är just det här som gör det, på rätt nivå.

Att i stället behålla `.bz2` och packa upp per förfrågan är sämre: bzip2 är inte
sökbart så en Range-förfrågan tvingar fram uppackning av hela filen, bzip2
dekomprimerar bara i 20–40 MB/s, och det kräver en cache med utrymmesstyrning
plus en tjänst som gör jobbet — alltså tillbaka med den backend vi blev av med.

### Kvarstående risk

En VPS är en kopia. Uppackningsskriptet raderar arkivet efter verifiering, så för
2004–2007 blir Macen och servern snart de enda kopiorna av ett oersättligt
arkiv. **Cloudflare R2 som andrakopia kostar ~$3,30/mån** för 218 GB med fri
egress. Det är fortfarande obeslutat.

## Infrastruktur i Oracle Cloud

Uppsatt för hand 2026-08-16. Tenancy `caterpiller`, region `eu-stockholm-1`
(enda availability domain: `iJtZ:EU-STOCKHOLM-1-AD-1`).

| Resurs | Värde |
|---|---|
| VCN | `hltv-vcn`, `10.0.0.0/16`, DNS `hltvvcn.oraclevcn.com` |
| Subnät | `hltv-public`, `10.0.1.0/24`, Public (Regional) |
| Internetgateway | `hltv-igw` |
| Routingregel | `0.0.0.0/0` → `hltv-igw` |
| Security list | TCP 22, 80, 443 — alla med Source Port `All` |

Fyra fällor kostade tid och är värda att komma ihåg:

1. **VCN-wizarden är inte samma sak som "Create VCN".** Den enkla formen skapar
   bara nätet — inget subnät, ingen gateway, ingen routing.
2. **"Use DNS hostnames in this VCN" går inte att ändra efteråt.** Missas den
   står det "DNS isn't enabled for this VCN" och VCN:en måste göras om.
3. **Source Port Range ska vara tomt** i ingress-reglerna. Fylls det i matchar
   regeln bara trafik *från* den porten, och webbläsare ansluter från slumpade
   höga portar. Sajten hade varit onåbar med en konsol som såg helt rätt ut.
4. **OCI har två brandväggslager.** Security list i konsolen *och* instansens
   egen iptables. Bootstrap-skriptet fixar det andra men kommer aldrig åt det
   första.

### Instansen (ej skapad än)

| | |
|---|---|
| Shape | `VM.Standard.A1.Flex`, 2 OCPU / 12 GB |
| Image | Canonical Ubuntu 24.04 Minimal **aarch64** |
| Bootvolym | 50 GB, VPU 10 (Balanced) |
| Datavolym | 150 GB, VPU 10, **Paravirtualized** → `/dev/sdb` |
| Capacity type | On-demand (aldrig Preemptible) |

Ubuntu 26.04 finns ännu inte i Oracles imagelista. 24.04 är LTS till 2029 och
påverkar inte Node-versionen.

SSH-nyckel: `~/.ssh/hltv.key` (rättigheter 400) och `~/.ssh/hltv.key.pub`.
Användarnamn på Canonicals images är `ubuntu`.

## Skript

Allt ligger i `app/scripts/`.

| Fil | Körs på | Gör |
|---|---|---|
| `unpack-demo-zips.py` | båda | Packar upp ZIP till rätt årsmapp utifrån datumstämpeln `-ÅÅMMDDTTMM-`. Raderar arkivet först efter sha256-verifiering |
| `repair-goldsrc-demos.py` | båda | Bygger om saknade demokataloger utan att röra originalen |
| `hltv-node.mjs` | båda | Kör appens analyskedja i vanliga Node. Löser Vites `/@`-alias via `registerHooks` och stubbar `window`/`document` |
| `index-demos.mjs` | servern | `parse` bygger JSON-databasen, `rescore` räknar om poängen utan att röra en demofil |
| `build-asset-manifests.mjs` | Macen | Förberäknar spelresursmanifest per (karta, checksumma) ur demo-index.json |
| `bootstrap-vps.sh` | servern | Paket, Node 26, brandvägg, btrfs+zstd, katalogstruktur, nginx |
| `oci-launch-retry.sh` | Macen | Tjatar tills Oracle släpper ifrån sig en Ampere-instans |

### Databasen

```bash
node --import ./scripts/hltv-node.mjs scripts/index-demos.mjs parse
node --import ./scripts/hltv-node.mjs scripts/index-demos.mjs rescore
```

Två artefakter, med avsikt åtskilda:

- **`public/demo-index.json`** — katalogen, en rad per demo. **~4,1 MiB** för
  6 230 demos, alltså liten nog att följa med bygget in i `dist/`.
- **`demo-analysis/`** — hela analysindexet per demo. Uppmätt **420 MB för 811
  demos**, alltså ~3,3 GB för hela arkivet. Serveras vid behov.

`parse` läser demofilerna och är det dyra steget. `rescore` rör aldrig en
demofil: den läser analysindexen och kör om `buildHighlightAnalysis` med
nuvarande vikter i `highlight-analyzer.ts`. **Ändra reglerna för vad som är en
bra frag, kör `rescore`, och hela databasen är uppdaterad på under en minut** i
stället för en omparsning av 218 GiB.

För att det ska bli *troget* lades `observedShots` till i `DemoAnalysisIndex`
(`schema.ts`, `demo-analyzer.ts`). De byggdes tidigare under parsningen och
slängdes efteråt, vilket hade fått precisionsreglerna — one-shot kills,
time-to-kill, spray-transfer — att tyst försvinna vid omscoring. Verifierat:
poängsumman för ett demo blev **6482 med sparade skott och 6279 utan**, och
omscoring med skotten ger exakt samma summa som den lagrade.

### Manifesten

`server.mjs` bygger `/game-assets-manifest.json` per förfrågan genom att läsa
filsystemet och räkna GoldSrc-CRC. På en ren nginx finns ingen som kör den
koden, och query-parametrar påverkar inte vilken statisk fil som serveras.
`build-asset-manifests.mjs` förberäknar därför en fil per (karta, checksumma)
som arkivet faktiskt innehåller, läst ur `demo-index.json`.

Klienten behöver inte ändras — nginx mappar query-parametrarna:

```nginx
location = /game-assets-manifest.json {
    try_files /game-assets-manifest/$arg_map.$arg_checksum.json
              /game-assets-manifest/$arg_map.00000000.json
              =404;
    default_type application/json;
}
```

Andra raden är fallbacken för demos utan kart-CRC, samma beteende som
`server.mjs` har idag när checksumman är noll.

## Kvarstående steg

1. Vänta ut kapaciteten, eller överväg Pay As You Go (Always Free-resurser
   förblir gratis på ett PAYG-konto, men kapacitetsprioriteten är bättre).
2. Skapa blockvolymen, 150 GB, koppla som Paravirtualized.
3. `sudo ./bootstrap-vps.sh --device /dev/sdb --user <namn>`
4. Öppna 80 och 443 i VCN → Security List (redan gjort, verifiera bara).
5. `rclone copy gdrive:hltv-arkiv.zip /srv/hltv/` — arkivet ligger på Google
   Drive, så överföringen går datacenter-till-datacenter och inte via
   hemmabredbandet.
6. Packa upp: `unpack-demo-zips.py --execute` för ZIP-åren, sedan `bunzip2` för
   BZ2-åren. Båda raderar arkivet efter verifiering, så disken växer mot
   slutmålet i stället för att behöva rymma båda formaten.
7. `parse` på servern, sedan `build-asset-manifests.mjs`.
8. Från Macen: `pnpm build` och `rsync` av `dist/` och `game-assets/`.
9. `compsize /srv/hltv` — ska visa ~17 % av logisk storlek. Gör den inte det är
   `compress`-flaggan inte aktiv och arkivet får inte plats.
10. TLS: `certbot --nginx -d <domän>` när DNS pekar rätt.

### AI-berikning

Körs **på Macen**, efter indexeringen, på den komprimerade JSON-sammanfattningen
per demo — aldrig på demofilen. Hämta hem `demo-index.json`, kör berikningen
lokalt, ladda upp den berikade katalogen.

Vad reglerna inte klarar: naturliga matchtitlar, klannamn över tjugo år av
nickvarianter, fritextsök, taggning av matcher som betydde något. Kostnad med
`claude-opus-5` ≈ **$39**, eller **~$20 via Batches API** (50 % rabatt).
Använd `output_config.format` med JSON-schema så svaren kommer tillbaka
validerade.

## Uppmätta värden

Alla mätta på Apple Silicon 2026-08-16, inte uppskattade.

| Vad | Värde |
|---|---|
| Parsningshastighet | **744 MiB/s** på en kärna (444 MiB-demo på 0,6 s) |
| Topp-RAM vid analys | **1,62 GiB** för arkivets största demo (449 MiB) |
| zstd-3 på demos | ratio **6,02** → 218 GiB blir ~36 GiB |
| bzip2 på demos | ratio **6,55** |
| Katalogstorlek | ~4,1 MiB för 6 230 demos |
| Analysfil per demo | ~530 KB (420 MB / 811 demos) |
| Manifest per karta | ~1 620 filer, ~230 MiB |

Att RAM-toppen är 1,62 GiB är skälet till att servern behöver 4 GB om den ska
köra `parse`. Servera filer klarar den på en bråkdel.

## Kända problem

**Skadade demos.** Minst två filer har trasig katalogoffset och kraschar
parsern med `Orimligt antal demosektioner`. Felet skrivs till analysfilen och
katalogen får `status: "error"`, så en full `parse` fungerar också som
hälsokontroll av arkivet. `repair-goldsrc-demos.py` bygger om kataloger utan att
röra originalen.

**Ampere-kapacitet.** `Out of host capacity` är normaltillståndet.
`oci-launch-retry.sh` roterar fault domains och tjatar. Efter fyra härdningar i
skarp drift tål den:

- *401 under nyckelpropagering* — en nyss uppladdad API-nyckel autentiserar
  slumpmässigt under flera minuter. Alla uppslagningar går via `oci_try`.
- *Nätverks- och serverhickor* — timeouts, `RequestException` och 5xx är
  transienta och får aldrig avbryta.
- *Okända fel* — loggas och försöks om, men avbryter efter fem likadana i rad.
- *Rate-limiting* — mäts över ett **långt** fönster, inte per minut. Det räcker
  inte att backa av en gång; skriptet höjer sin **grundtakt** permanent och
  hittar därmed den hållbara frekvensen själv. Uppmätt landning: ~32 minuter
  mellan försök, vilket ger riktiga svar i stället för 429.

**macOS bash är 3.2.** `mapfile` finns inte. Skript som ska köras på Macen måste
klara det — `oci-launch-retry.sh` använder `while read` av just det skälet.

## Öppna beslut

- R2 som andrakopia av arkivet, eller acceptera en enda kopia.
- Om `public/demo-index.json` ska checkas in (4 MB, ändras vid varje
  regeländring) eller genereras som ett byggsteg.
- Om spelresurserna ska serveras alls, eller om
  `public/local-assets-sw.js` ska vara enda vägen — `game-assets/` är Valves
  material hämtat via steamcmd, och en autentiserad sajt är en annan
  rättighetssituation än en öppen spegel.
- Pay As You Go för kapacitetsprioritet.
