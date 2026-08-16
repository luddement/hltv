# Molnrendering av Endast frags: arkitektur, IaC och kostnader

## Beslutsstatus

- **Status:** föreslagen målarkitektur och kostnadsunderlag
- **Prisögonblick:** 2026-08-15
- **Förstahandsval för pilot:** Scaleway L4 i Paris eller Warszawa
- **Reservval:** OVHcloud L4 i en EU-region
- **Största leveransrisk:** stabil bildfrekvens i headless Linux, inte GPU-minne
- **Princip:** permanent infrastruktur skapas med Terraform/OpenTofu; ett
  renderjobb skapas aldrig med `terraform apply`

Priser och produktutbud förändras. Beloppen här är budgetvärden, inte offerter.
Kontrollera vald region, kvoter och faktisk faktura före produktionsbeslut.

## Syfte och mål

Den lokala exporten visar att samma **Endast frags**-sekvens som användaren ser
kan sparas som film. Nästa steg är en onlinetjänst där användaren kan beställa
filmen, stänga browserfliken och senare få en nedladdningslänk.

Molnlösningen ska:

- återge exakt samma valda lags frags och samma pre-/post-roll som spelaren;
- följa en stabil lagidentitet även när laget byter T/CT-sida;
- använda härlett lagnamn i UI och filnamn, med `Team 1`/`Team 2` som fallback;
- kunna skala till noll körande GPU-workers;
- starta högst det antal workers som kön kräver;
- skapa video med mätbar FPS, upplösning, codec och bitrate;
- vara reproducerbar utan clickops efter ett minimalt konto-bootstrap;
- hålla demo, analysindex och output inom vald EU-region;
- ha tydliga kostnadsgränser, retention och automatisk städning.

## Nuläge: lokal browserexport

Den nuvarande implementationen finns främst i:

- `src/movie/movie-project.ts`: kvalitetsprofiler och synlig filmtidslinje;
- `src/movie/movie-recorder.ts`: canvas-capture, HUD, WebCodecs/H.264,
  Mediabunny-MP4-muxning och direkt filskrivning;
- `src/App.vue`: exportens livscykel, FPS och Endast frags-flödet.

| Profil | Bild | Mål-FPS | Video | Ljud |
|---|---:|---:|---:|---:|
| 720p | 1280×720 | 60 | 8 Mbit/s | 192 kbit/s |
| 1080p | 1920×1080 | 60 | 12 Mbit/s | 256 kbit/s |
| 1440p | 2560×1440 | 60 | 18 Mbit/s | 256 kbit/s |
| 2160p | 3840×2160 | 30 | 28 Mbit/s | 320 kbit/s |

Viktiga egenskaper och begränsningar:

- Filmen skapas i användarens browser, inte på den lokala Node-servern.
- Exporten går i realtid och browserfliken måste vara öppen och aktiv.
- `Original` och `Ren bild` tar varje `VideoSample` direkt från spelmotorns
  WebGL-canvas. `Cinematic`, `Analyst` och `Movie` ritar först export-HUD:en på
  en separat canvas.
- WebCodecs kodar AVC/H.264 och Mediabunny muxar en vanlig MP4. Hårdvarukodare
  begärs och verifieras först; om browsern inte exponerar den används dess
  standardval, men varje kodad frame räknas fortfarande.
- Varje frame får en explicit, fast timestamp. En 60 FPS-export godkänns bara
  när antalet kodade frames är identiskt med antalet fångade frames.
- Den riktiga WebGL-canvasen startas med `preserveDrawingBuffer`; exporten
  väntar på en synlig frame och provkodar en H.264-frame innan inspelningen
  markeras som startad. Ett rapporterat men trasigt hardware-läge faller
  automatiskt tillbaka till browserns standardkodare.
- Direktkällan skalas i WebCodecs-transformen till vald exportprofil. Därför
  blir 720p exakt 1280×720 även om Xash eller browserfönstret byter canvasstorlek.
- UI-värdet visar faktiskt kodade frames och kodningskön, inte bara
  `requestAnimationFrame`. Om kön ligger mer än två sekunder efter ihållande
  stoppas exporten.
- En verklig fel-export den 2026-08-15 var märkt som 720p60 men innehöll bara
  7 310 frames på 433,371 sekunder, cirka 16,87 faktisk FPS. VP9-filen blev
  1,57 GB och cirka 28,9 Mbit/s trots begärda 8 Mbit/s. Detta är bakgrunden
  till att `MediaRecorder` togs bort från HQ-exporten.
- Ett andra VP8-försök innehöll 8 302 frames på 433,537 sekunder, cirka
  19,15 FPS. Det höll 7,68 Mbit/s men blev felaktigt 1440×672. Det bekräftade
  att varken codecbyte eller en renderloopsmätare kunde garantera slutfilen.
- Ett automatiserat WebCodecs-prov kodar 300/300 frames på 5,000 sekunder som
  H.264 High, exakt 1280×720 och 60/1 FPS. Ett separat pause/resume-prov gav
  180/180 frames och exakt 3,000 sekunders synlig video.
- 4K-profilen är i dag 30 FPS. 4K60 är ett framtida servermål som måste klara
  benchmark innan det blir ett produktlöfte.
- Sökning mellan frags pausas i filmen men förbrukar fortfarande molntid.

Serverrendering blir en andra backend som använder samma filmplan och analys.
När jobbet och alla inputs är registrerade behöver användarens flik inte vara
öppen.

## Målarkitektur

```text
Browser
  │ skapa renderjobb
  ▼
Applikations-API ─────► Postgres/renderkö
  │                          │
  │ signerad upload          │ köhändelse + reconciliation
  ▼                          ▼
EU Object Storage ◄──── Worker controller
  ▲                          │ leverantörens Instance API
  │                          ▼
  └──────────────── L4 render worker 1..N
                         │
                         ├─ headless Chromium + WebGL/WASM
                         ├─ exakt Endast frags-tidslinje
                         ├─ NVENC/FFmpeg slutkodning
                         └─ upload + ffprobe-manifest
```

### Applikations-API och kö

API:t validerar ägarskap och skapar ett idempotent renderjobb. Browsern får
aldrig långlivade cloud-nycklar; inputs laddas upp via kortlivade signerade
URL:er.

I första versionen räcker en Postgres-tabell med lease, heartbeat och
`FOR UPDATE SKIP LOCKED`. Kön är sanningskällan. Ett anrop till kontrollern är
bara en snabb väckningssignal; schemalagd reconciliation återupptar jobb om
signalen tappas.

### Worker controller

Kontrollern:

1. räknar köade jobb och lediga workers;
2. startar en avstängd worker via leverantörens API;
3. delar inte ut fler jobb än workerprofilens verifierade samtidighet;
4. stoppar workern med **Power Off**, inte debiterad standby, efter fem tomma
   minuter;
5. stoppar eller terminerar workers som passerat maximal körtid;
6. återskapar workers från deklarerad image efter permanent health-fel.

Kontrollern kan vara en liten serverless container eller billig CPU-tjänst.

### Worker och Object Storage

Workern har ingen publik ingress. Den hämtar ett leaseat jobb utgående, laddar
ned signerade inputs, renderar, laddar upp output och rapporterar heartbeat.
Workern är utbytbar och får inte vara sanningskälla för jobbstatus.

Separata prefixes eller buckets används för demo-input, analysindex,
renderoutput och Terraform/OpenTofu-state. State blandas aldrig med
användardata. Lifecycle-regler raderar tillfälliga demos och filmer automatiskt.

## Lagidentitet i renderjobbet

T/CT är en aktuell sida och får aldrig vara lagets permanenta identitet.

```ts
type RenderTeamRef = {
  teamId: string;
  displayName: string;       // exempelvis "crapoffline" eller "aoH"
  filenameSlug: string;      // endast säkra tecken
  nameEvidence: 'derived' | 'fallback';
};
```

Namnrensning påverkar bara presentation. Matchningen över sidbyte använder
spelarsessioner, laghistorik och `teamId`, aldrig den rensade strängen. Om namn
inte kan härledas deterministiskt används `Team 1` respektive `Team 2`.

Renderjobbet låser demo-hash, analysversion och exakt lista av event-ID:n. En
senare parser- eller namnändring får inte tyst ändra en beställd film.

## Renderjobb och tillstånd

```ts
type RenderJob = {
  id: string;
  idempotencyKey: string;
  userId: string;
  demoSha256: string;
  analysisSchemaVersion: number;
  analyzerVersion: string;
  team: RenderTeamRef;
  eventIds: string[];
  preset: 'only-frags';
  quality: '720p' | '1080p' | '1440p' | '2160p' | '2160p60-experimental';
  outputContainer: 'mp4';
  createdAt: string;
};
```

```text
queued
  └─► provisioning ─► booting ─► rendering ─► uploading ─► validating ─► complete
             │             │           │            │             │
             └─────────────┴───────────┴────────────┴────► retry_wait ─► queued
                                                               │
                                                               └─► failed

queued | provisioning | booting | rendering ─► canceled
```

Varje försök har ett unikt `attemptId`. Output laddas upp till ett tillfälligt
objektnamn och publiceras atomiskt först efter validering. En retry får därför
inte skapa flera synliga slutresultat.

## Serverns renderpipeline

### Fas 1: återanvänd dagens visuella pipeline

1. Starta Chromium headless med NVIDIA/EGL, inte SwiftShader.
2. Öppna en intern renderroute utan normal UI-navigation.
3. Montera demo, karta och assets från signerade lokala filer.
4. Verifiera demo-SHA-256, kart-CRC och analysversion.
5. Spela samma Endast frags-tidslinje i realtid.
6. Skriv WebM-segment eller annan strömmande mellanfil.
7. Skapa MP4 med FFmpeg och NVIDIA NVENC.
8. Kör `ffprobe` och spara ett maskinläsbart kvalitetsmanifest.

Detta är snabbaste vägen till visuell likhet. Användarens browser kan stängas
efter att jobbet och inputs registrerats.

### Fas 2: deterministisk frame stepping

Realtids-`requestAnimationFrame` kan tappa frames under last. Slutmålet är att
motorn stegas exakt en filmruta åt gången och att varje frame lämnas till
kodaren med explicit timestamp. Servern kan då rendera snabbare eller långsammare
än realtid utan att filmens FPS förändras. 4K60 ska inte markeras stabilt före
denna eller en lika stark lösning.

### Slutvalidering

Ett lyckat jobb kräver:

- spelbar container och korrekt moov/index-metadata;
- rätt upplösning och förväntad bildfrekvens;
- duration inom tolerans mot filmplanen;
- ljudspår när ljud begärts;
- rimlig bitrate och filstorlek;
- noll rapporterade render-/seekfel;
- SHA-256 för slutfilen.

En fil som bara är större än noll byte är inte ett lyckat jobb.

## Samtidighet och FPS

Två L4-workers är första maxpoolen. Samtidighet per L4 är ett benchmarkresultat,
inte en gissning:

- en export per L4 för 1440p60 och 4K som startvärde;
- högst två per L4 testas för 720p60/1080p60;
- fyra beställningar får köa om bara två profiler är verifierade;
- om fyra filmer måste renderas samtidigt startas upp till fyra workers tills
  två-per-GPU har klarat lasttest.

Mät per jobb: efterfrågade/renderade/kodade frames, tappade och duplicerade
frames, FPS-fönster, duration, renderfaktor, start/seek/kodning/upload,
GPU/encoder utilization, VRAM, CPU, RAM och faktisk bitrate.

## Infrastructure as Code utan clickops

### Vad IaC äger

Terraform/OpenTofu äger permanent infrastruktur:

- projekt, IAM och servicekonton där API:t tillåter det;
- nätverk, security groups och utgående gateway/IP;
- buckets, CORS, kryptering och lifecycle-regler;
- container registry och läsbehörigheter;
- worker-controller och dess schema/schedule;
- två förallokerade GPU-workers i avstängt läge;
- loggar, metrics, dashboards och budgetlarm;
- DNS och publika API-resurser hos samma leverantör.

Renderjobb och normal start/stopp är runtime-state och sköts via API, inte
Terraform.

### Minsta ofrånkomliga bootstrap

Följande kan behöva göras en gång:

- skapa kundkonto och godkänna avtal;
- registrera betalmetod och VAT-ID;
- skapa första organisation/projekt och bootstrap-nyckel;
- begära GPU-kvot eller kapacitet;
- lägga CI-hemligheter i vald secret store.

Efter detta ska miljöer, drift och återställning kunna köras från Git och CI.

### Rekommenderad repostruktur

```text
infra/
  bootstrap/
  environments/
    dev/
    prod/
  modules/
    network/
    object-storage/
    render-controller/
    render-worker-pool/
    observability/

render-worker/
  Dockerfile
  entrypoint/
  scripts/
  tests/

src/server/rendering/
  render-job-repository.ts
  render-controller-client.ts
  providers/
    scaleway.ts
    ovh.ts
```

### Terraform-mönster för Scaleway

Detta visar avsedd form, inte en färdig modul:

```hcl
resource "scaleway_instance_server" "renderer" {
  count = var.render_worker_count

  name  = "renderer-${count.index + 1}"
  type  = "L4-1-24G"
  image = var.renderer_image_id
  state = "stopped"
  tags  = ["renderer", "only-frags", var.environment]

  lifecycle {
    # Runtime-kontrollern äger power state. Annars kan IaC stoppa ett aktivt jobb.
    ignore_changes = [state]
  }
}
```

Scaleway har `started`, `stopped` och `standby`. `standby` är fortsatt
debiterad och ska inte användas för scale-to-zero. Instanstyp och image måste
verifieras i vald availability zone före apply.

### CI/CD och leverantörsabstraktion

- Versionslås Terraform/OpenTofu och providers.
- Kör `fmt`, `validate`, lint och säkerhetsskanning på pull request.
- Visa sparad plan; apply sker från skyddad huvudgren.
- Använd separata dev/prod-states och servicekonton.
- Bygg renderimagen reproducerbart och referera med digest, inte `latest`.
- Smoke-testa Chromium, WebGL renderer, `nvidia-smi` och en kort MP4.
- Kontrollera deklarerad mot faktisk cloud-state regelbundet.

Applikationen ska bara behöva ett tunt kontrakt:

```ts
interface RenderWorkerProvider {
  start(workerId: string): Promise<void>;
  stop(workerId: string): Promise<void>;
  status(workerId: string): Promise<'off' | 'starting' | 'ready' | 'busy' | 'error'>;
}
```

Jobbformat, container och lagring hålls leverantörsoberoende/S3-kompatibla.

## Leverantörsjämförelse

### Rekommenderad ordning

1. **Scaleway:** bäst kombination av EU-ägande, L4-pris, officiell
   Terraform-provider och komplett Instance API.
2. **OVHcloud:** stark reserv med L4, EU-ägande, officiell provider,
   OpenStack-ekosystem och inkluderad utgående trafik i Europa.
3. **GCP:** mogen IaC och orkestrering, men inte EU-ägt och dyrare egress.
4. **AWS:** mogen driftmodell och G6 i Stockholm, men högre pris och egress.
5. **Runpod/DataCrunch:** bra experiment för pris eller serverless, men inte
   primär plattform innan regionlåsning, IaC, browser/EGL och support verifierats.
6. **Hetzner:** intressant vid hög jämn användning och stor trafik, men GPU:n är
   en dedikerad Robot-server, inte en vanlig GPU Cloud-instans.

| Leverantör | Exempel | EU-drift | IaC/API | Scale-to-zero | Kommentar |
|---|---|---|---|---|---|
| Scaleway | L4-1-24G, 8 vCPU, 48 GB | Paris/Warszawa | officiell Terraform + API | Power Off | förstahandsval |
| OVHcloud | l4-1-gpu, 20 vCore, 80 GiB | flera EU-regioner | officiell Terraform + OpenStack | stop/delete | stark reserv |
| GCP | g2-standard-8, 8 vCPU, 32 GiB | flera EU-regioner | mycket mogen | stop/delete/MIG | kontrollera G2-zon |
| AWS | g6.2xlarge, 8 vCPU, 32 GiB | Stockholm m.fl. | mycket mogen | stop/ASG 0 | bra kapacitetsekosystem |
| Runpod | serverless 24 GB-klass | EU måste låsas | API/container | serverless 0 | klassen kan blanda GPU-modeller |
| DataCrunch | L40S serverless | Finland | API/container | serverless 0 | kraftfullare men dyrare |
| Hetzner | GEX44, RTX 4000 Ada 20 GB | Tyskland | Robot API; ej normal hcloud-GPU | avbeställning | bäst som konstant server |

## Prisunderlag

Alla priser är exklusive moms om inte källan uttryckligen visar annat. SEK-
exemplen använder avrundade budgetkurser:

- `1 EUR = 11,0 SEK`
- `1 USD = 9,6 SEK`

ECB visade omkring 11,05 SEK/EUR i slutet av juli 2026. Bokföring ska använda
faktisk fakturakurs.

| Leverantör | Listpris | Cirka SEK/GPU-h | Prisnot |
|---|---:|---:|---|
| Scaleway L4 | €0,79/h | 8,69 kr | GPU-FAQ anger minutdebitering |
| OVHcloud L4 | €0,83/h | 9,13 kr | minutgranularitet på Public Cloud |
| GCP g2-standard-8 | $0,853624/h | 8,19 kr | publicerat referenspris; region påverkar |
| AWS g6.2xlarge Stockholm | cirka $1,0369/h | 9,95 kr | indikativt; verifiera AWS Calculator/API |
| Runpod serverless 24 GB-klass | $0,69/h | 6,62 kr | per sekund; inte garanterat enbart L4 |
| DataCrunch L40S serverless | $1,29/h | 12,38 kr | Spot cirka $0,65/h |
| Hetzner GEX44 | €232,30/mån | fast | €114 setup; annan GPU-klass |

Priskällor:

- [Scaleway GPU-priser](https://www.scaleway.com/en/pricing/gpu/)
- [Scaleway GPU-billing och power state](https://www.scaleway.com/en/docs/instances/faq/)
- [OVHcloud Public Cloud-priser](https://www.ovhcloud.com/en-ie/public-cloud/prices/)
- [GCP accelerator-optimerade priser](https://cloud.google.com/products/compute/pricing/accelerator-optimized)
- [AWS G6-specifikation](https://aws.amazon.com/ec2/instance-types/g6/)
- [AWS Price List API](https://aws.amazon.com/aws-cost-management/aws-price-list-api/)
- [Runpod serverless-priser](https://www.runpod.io/product/serverless)
- [DataCrunch serverless-priser](https://datacrunch.io/inference)
- [Hetzner-prisändring 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- [ECB:s referenskurser](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)

### Viktig Scaleway-reservation

Scaleways GPU-FAQ säger att GPU Instances faktureras per minut. Deras generella
billing-FAQ säger samtidigt att varje separat resursperiod kan ha minst 60
minuters debitering. Innan sub-timmespriset används kommersiellt ska ett verkligt
test göras: starta en L4-worker, kör 10–15 minuter, Power Off och kontrollera
preliminär samt slutlig faktura.

Budgetera tills dess både:

- **användningsbaserat:** faktisk minutkostnad;
- **konservativt:** minst €0,79 per kall Scaleway-startperiod.

Fem minuters idle-timeout och köbatchning minskar risken att flera jobb utlöser
varsin minimiavgift.

## Filstorlek från dagens profiler

```text
byte = sekunder × (video-bitrate + audio-bitrate) / 8
```

Teoretisk storlek för tio minuters synlig film:

| Profil | Cirka MB | Cirka GiB |
|---|---:|---:|
| 720p60 | 614 MB | 0,57 GiB |
| 1080p60 | 919 MB | 0,86 GiB |
| 1440p60 | 1 369 MB | 1,28 GiB |
| 4K30 | 2 124 MB | 1,98 GiB |

Codec och MediaRecorder kan avvika från begärd bitrate. Tabellen är en
kapacitetsuppskattning, inte kvalitetskontroll. Framtida 4K60 vid 40–60 Mbit/s
video blir ungefär 3,0–4,5 GB per tio minuter.

## Kostnad per jobb

```text
billedHours = (boot + visibleMovie + hiddenSeek + finalize + idleTail) / 3600
computeCost = billedHours × workerHourlyPrice
deliveryCost = downloadedGiB × egressPrice
```

Exempel: tio minuters film och totalt fem minuters boot, seek, slutkodning och
idle-tail ger 15 minuters debiterad GPU-tid.

| Leverantör | Compute för 15 min | Cirka SEK |
|---|---:|---:|
| Scaleway | €0,1975 | 2,17 kr, eller konservativt 8,69 kr vid 60 min minimum |
| OVHcloud | €0,2075 | 2,28 kr |
| GCP | $0,2134 | 2,05 kr |
| AWS Stockholm | $0,2592 | 2,49 kr |
| Runpod serverless | $0,1725 | 1,66 kr |
| DataCrunch L40S | $0,3225 | 3,10 kr |

Detta är compute, inte total kostnad. Egress kan vara lika stor eller större.

## Lagring och nedladdning

### Scaleway

Standard One Zone kostar cirka €0,00803/GB/månad och Standard Multi-AZ cirka
€0,01606/GB/månad. 75 GB egress ingår per månad; därefter kostar egress
€0,01/GB. [Aktuella lagringspriser](https://www.scaleway.com/en/pricing/storage/).

### OVHcloud

Utgående publik trafik för Public Cloud-instanser och normal Object Storage är
inkluderad i europeiska regioner enligt aktuell prislista. Det är särskilt
intressant när samma stora film laddas ned flera gånger.

### Google Cloud

Premium Tier till Europa kostar $0,12/GiB för första nivån efter den fria första
GiB:n och sjunker vid högre volym.
[GCP nätverkspriser](https://cloud.google.com/vpc/network-pricing).

### AWS

AWS inkluderar 100 GB utgående internettrafik per månad aggregerat över flera
tjänster. Därefter gäller region- och volympris.
[AWS EC2 data transfer](https://aws.amazon.com/ec2/pricing/on-demand/).

### Retention

Med 24 timmars standardretention är lagring normalt billig. Hundra filmer à
2 GB per månad är 200 GB skapad data, men jämnt fördelat och raderat efter ett
dygn bara cirka 6,7 GB genomsnittligt lagrat. Nedladdningen är fortfarande
200 GB om varje film hämtas en gång.

## Månadsscenarier

Antaganden:

- tio minuters synlig film;
- 15 minuters total GPU-väggtid per jobb;
- en nedladdning per film;
- cirka 2 GB output, motsvarande dagens 4K30;
- moms, kontrollplan, databas och små API-kostnader är exkluderade;
- användningsbaserad debitering, inte eventuell minimitimme per kall start.

### Compute

| Volym | GPU-timmar | Scaleway | OVH | GCP | AWS | Runpod | DataCrunch |
|---|---:|---:|---:|---:|---:|---:|---:|
| 100 filmer/mån | 25 h | 217 kr | 228 kr | 205 kr | 249 kr | 166 kr | 310 kr |
| 1 000 filmer/mån | 250 h | 2 173 kr | 2 283 kr | 2 049 kr | 2 489 kr | 1 656 kr | 3 096 kr |

Om 100 Scaleway-jobb startar i helt isolerade billingperioder och 60-minuters
minimum tillämpas blir konservativ compute cirka **869 kr**, inte 217 kr.
Tätare jobb delar en varm period och närmar sig användningsvärdet.

### Ungefärlig egress för 4K30-output

| Volym | Data | Scaleway | OVHcloud | GCP | AWS |
|---|---:|---:|---:|---:|---:|
| 100 filmer | 200 GB | cirka 14 kr | inkluderad | cirka 229 kr | första 100 GB fria, sedan regionspris |
| 1 000 filmer | 2 TB | cirka 212 kr | inkluderad | cirka 2 209 kr | region- och volympris |

GCP-exemplet använder $0,12/GiB upp till första TiB-nivån och $0,11/GiB för
nästa. Decimal GB och GiB är förenklade, så fakturan avviker något.

### Två workers alltid på

| Leverantör | Två workers × 730 h/mån |
|---|---:|
| Scaleway | cirka 12 687 kr/mån |
| OVHcloud | cirka 13 330 kr/mån |
| GCP | cirka 11 964 kr/mån |
| AWS Stockholm | cirka 14 533 kr/mån |
| Runpod 24 GB-klass | cirka 9 671 kr/mån |
| DataCrunch L40S | cirka 18 081 kr/mån |

Hetzners två GEX44 kostar cirka €464,60 eller 5 111 kr/mån plus setup första
månaden, men RTX 4000 Ada är inte prestandamässigt identisk med L4.

### Hetzner-brytpunkt

En GEX44 på €232,30/månad motsvarar ungefär 294 Scaleway L4-timmar à €0,79.
Hetzner blir ekonomiskt intressant när:

- en worker används runt 300 timmar per månad;
- obegränsad trafik sparar mer än skillnaden;
- GEX44 klarar samma FPS och samtidighet;
- setupavgift och längre provisioning kan accepteras.

Den är inte förstahandsval för sporadiska jobb eller snabb scale-to-zero.

## Kostnader utanför GPU-tabellen

En komplett produktbudget inkluderar också:

- API/controller-compute och Postgres/renderkö;
- object storage, registry, blockvolymer och snapshots;
- egress och eventuellt CDN;
- publika IPv4-adresser;
- loggar, metrics, backup och supportplan;
- moms, betalprovider och misslyckade/retryade jobb;
- abuse, extrema demoformat och filmer som aldrig hämtas.

Kontrollplanen bör först budgeteras som ett litet fast intervall, exempelvis
100–500 kr/månad, och ersättas med faktisk mätdata efter pilot.

## FinOps-regler

- Sätt globalt maxantal GPU-workers i IaC och leverantörskvot.
- Sätt maximal render-väggtid och stoppa zombieprocesser.
- Ha separata dev-/prodbudgetar med webhooklarm.
- Tagga resurser med miljö, jobbtyp och kostnadsägare.
- Logga `gpuSeconds`, `outputBytes` och `downloadBytes` per jobb.
- Räkna självkostnad per användare och kvalitetsprofil.
- Radera avbrutna multipart uploads automatiskt.
- Standardretention är 24 timmar; längre retention är explicit produktval.
- Skicka inte filmen genom API-servern; använd signerad Object Storage-URL/CDN.
- Använd Spot först när jobb kan checkpointas eller startas om idempotent.
- Optimera fem minuters idle-tail från faktisk trafik och billinggranularitet.

## Säkerhet, integritet och rättigheter

README anger i dag att demos och spelresurser körs lokalt och inte laddas upp.
Molnrendering ändrar detta och måste vara ett uttryckligt opt-in med uppdaterad
integritetstext.

Krav:

- EU-region för demo, index, logs och output;
- TLS och kryptering i vila;
- kortlivade signerade URL:er;
- worker får bara läsa sitt jobs inputs och skriva sitt tillfälliga output;
- ingen permanent cloud-nyckel i browser eller rendercontainer;
- privata workers utan publik ingress;
- loggar utan signerade URL:er, demo-bytes eller hemligheter;
- automatisk och användarstyrd omedelbar radering;
- auditlogg för jobbstatus och objektåtkomst;
- dokumenterat personuppgiftsbiträdesavtal och underleverantörer;
- användaren måste ha rätt till demo, spelresurser, logotyper och musik.

Counter-Strike/Valve-assets får inte automatiskt paketeras i en publik image
utan separat licensbedömning. Ett alternativ är rättmätiga användarlevererade
assets eller en privat åtkomststyrd assetbundle som juridiskt godkänts.

## Felhantering

Retrybara fel:

- tillfällig GPU-kapacitetsbrist;
- boot timeout;
- nätverks- eller tillfälligt Object Storage-fel;
- Spot-interruption;
- controller restart medan jobbet har giltig lease.

Icke-retrybara utan ändrad input:

- fel demo-hash eller kart-CRC;
- saknade eller otillåtna assets;
- analysversion som inte stöds;
- deterministiskt motor-/parserfel;
- upprepad identisk kvalitetsvalideringsmiss.

Efter worker-krasch går jobbet till `retry_wait`. Ett nytt försök återanvänder
aldrig en halvfärdig synlig fil. Max försök och maximal total GPU-tid begränsas.

## Observability och acceptanskriterier

Dashboarden visar minst:

- kölängd och äldsta jobb;
- workers per power state;
- startlatens, renderfaktor och jobbduration;
- success/retry/failure/cancel-rate;
- FPS och tappade frames per profil;
- GPU-timmar och kostnadsestimat per dag;
- output-, lagrings- och egressvolym;
- workers igång utan giltig lease.

Pilotens acceptanskriterier:

1. Samma demo/team ger samma eventordning och duration lokalt och i molnet.
2. Lagidentiteten överlever T/CT-byte och namnet blir korrekt eller
   deterministiskt `Team 1`/`Team 2`.
3. 1080p60 har rätt upplösning, duration och bildfrekvens utan synliga hopp.
4. 4K30 klarar minst tio minuters film på en L4 utan workerfel.
5. En avstängd worker ger ingen GPU-compute-debitering.
6. En stängd browser påverkar inte ett registrerat serverjobb.
7. Worker kill/uploadfel återupptas utan dubbelt slutresultat.
8. Lifecycle raderar inputs och output vid rätt tid.
9. `terraform plan` efter runtime-start/stopp är tom för power state.
10. Fakturan ligger inom 20 procent av telemetribaserad kalkyl.

4K60 blir produktionsprofil först efter soak-test med noll tappade frames och
godkänd ljudsynk.

## Införandeplan

### Etapp 0: kostnads- och kapacitetsprov

- Skapa Scaleway-konto/projekt och GPU-kvot.
- Kör 10–15 minuter på L4 och Power Off.
- Bekräfta billinggranularitet, bootlatens och availability.
- Kör samma test på OVHcloud vid kapacitets- eller FPS-problem.

### Etapp 1: reproducerbar worker

- Dockerisera renderroute, Chromium, FFmpeg och NVENC.
- Pinna browser, NVIDIA userspace, motor-WASM och app-build.
- Lägg smoke-test och `ffprobe`-manifest i CI.
- Verifiera 720p60, 1080p60 och 4K30 med samma demo.

### Etapp 2: IaC-grund

- Lägg `infra/` med separata dev/prod-states.
- Skapa nätverk, buckets, IAM, registry och avstängd worker.
- Lägg budgetlarm och automatisk städning.
- Dokumentera enda konto-bootstrapen.

### Etapp 3: kö och controller

- Implementera jobbtabell, leases och heartbeats.
- Implementera Scaleway-adapter för start/stop/status.
- Lägg idle-timeout och hard runtime limit.
- Lägg reconciliation och idempotenta retries.

### Etapp 4: produktintegration

- Lägg explicita cloud-uploadvillkor i UI.
- Skapa jobb från exakt vald `teamId` och filmplan.
- Visa köstatus och tillåt att browsern stängs.
- Leverera signerad länk och retentionstid.

### Etapp 5: last, kostnad och reservleverantör

- Testa två samtidiga exporter per L4 utan att anta att de fungerar.
- Lasttesta två workers och fyra beställningar.
- Jämför uppmätt kostnad med scenario.
- Implementera OVH-adapter eller dokumenterad recovery-procedur.

### Etapp 6: 4K60

- Implementera deterministisk frame stepping eller motsvarande.
- Välj H.264/HEVC/AV1-produktprofil och kompatibilitet.
- Benchmarka kvalitet, encoding speed, storlek och uppspelning.
- Aktivera först efter soak-test och kostnadsbeslut.

## Tagna beslut

- Pilot: Scaleway L4, OVHcloud som reserv.
- Ingen Kubernetes i första versionen.
- Två förallokerade men normalt avstängda workers.
- IaC äger resurser; runtime-controller äger power state.
- Power state ignoreras i Terraform lifecycle.
- Jobb/output är idempotenta och hash-/versionslåsta.
- Team väljs med stabil `teamId`, aldrig enbart T/CT eller lagnamn.
- Output valideras med metadata, inte endast filstorlek.
- Dagens 4K är 30 FPS; 4K60 är separat benchmarkad etapp.

## Öppna beslut före produktion

- Exakt Scaleway-billing efter sub-timmes GPU-test.
- Paris eller Warszawa utifrån kvot, latency och kapacitet.
- Om workerimagen juridiskt får innehålla nödvändiga spelassets.
- Standardretention och eventuell betald längre lagring.
- H.264 som standard eller även HEVC/AV1 som premium.
- En eller två samtidiga 1080p60-exporter per L4.
- Direkt Object Storage eller CDN för output.
- Prisnivå som täcker retries, support och marginal.

## Tekniska källor och underhåll

- [Scaleway Terraform-provider](https://registry.terraform.io/providers/scaleway/scaleway/latest/docs)
- [Scaleway GPU Instances](https://www.scaleway.com/en/docs/gpu/)
- [Scaleway Instance-billing](https://www.scaleway.com/en/docs/instances/reference-content/understanding-instance-pricing/)
- [OVHcloud Terraform-provider](https://registry.terraform.io/providers/ovh/ovh/latest)
- [OpenStack Terraform-provider](https://registry.terraform.io/providers/terraform-provider-openstack/openstack/latest)
- [GCP stoppade VM-kostnader](https://docs.cloud.google.com/compute/docs/reference/rest/v1/instances/stop)
- [AWS EC2 instance lifecycle](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html)
- [Hetzner GPU-server](https://www.hetzner.com/dedicated-rootserver/gex44/)

Granska dokumentet när leverantör/region väljs, ett pris ändras, en ny
kvalitetsprofil släpps, verklig telemetri avviker mer än 20 procent eller
retention, dataplacering eller assetmodell ändras.
