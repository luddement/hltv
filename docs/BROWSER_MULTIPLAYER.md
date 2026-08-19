# Live multiplayer i browsern: genomförbarhet och arkitektur

## Beslutsstatus

- **Status:** utredning, inget är implementerat
- **Underlag daterat:** 2026-08-16
- **Bedömning:** spelbar prototyp är ett litet projekt, publik drift är det inte
- **Förstahandsval för transport:** WebRTC DataChannel, unreliable/unordered
- **Största tekniska risk:** latens och jitter genom relayen, inte motorn
- **Största icke-tekniska risk:** distribution av Valves spelresurser till okända
  besökare

Utredningen gäller frågan: hur svårt är det att lägga upp en sida där en besökare
går in och direkt spelar Counter-Strike, till exempel `cs_guardtower`, mot andra
i samma browser-motor som Replay Lab redan använder?

## Nuläge: vad projektet redan har

Följande är kontrollerat i repot, inte antaget.

- **Motorn kör redan i browsern.** `xash3d-fwgs` (Emscripten-byggd Xash3D-FWGS)
  och `cs16-client` finns som beroenden i `package.json` och kopieras till
  `public/` av `setup-xash.sh`.
- **Rendering, ljud och HUD fungerar.** Demouppspelningen bevisar hela
  klientkedjan utom nätverk och inmatning.
- **Asset-pipelinen är klar.** `game-assets-manifest.mjs` monterar bana, `.txt`,
  overview, skybox och WAD-beroenden i browserns filsystem. Kartor slås upp på
  namn plus beräknad GoldSrc-CRC via `game-assets/map-library/`.
- **Serverbinärerna finns redan lokalt.** `game-assets/` innehåller `hlds_run`,
  `hlds_linux`, `engine_i486.so` och `filesystem_stdio.so`, och
  `game-assets/cstrike/dlls/` innehåller `cs.so`, `cs_amd64.so`, `cs.dylib` och
  `mp.dll`. Serversidan kräver alltså ingen ny komponent, bara en värd.
- **`cs_guardtower.bsp` finns på disk** i repots `cstrike/maps/`, med beräknad
  GoldSrc-checksumma `fdc03b7d`. Den används inte av något demo i arkivet.

## Blockeraren: browsern kan inte tala UDP

GoldSrc-netcode är UDP. En browser har inget API för råa UDP-paket. Hela frågan
handlar därför om en relay:

```
browser (WASM-klient) <-- WebRTC/WebSocket --> relay <-- UDP --> hlds + cs.so
```

Relayen är den enda genuint nya komponenten i systemet.

Det avgörande är att det redan är löst uppströms i det beroende projektet
använder. `xash3d-fwgs` beskriver ett *pluggable network layer* som är avsett för
WebSocket, WebRTC eller egen transport, och paketets exempelmapp innehåller en
multiplayer-uppsättning. Valet av fork gjordes för demoprotokoll 46, men det är
samma fork som behövs här.

## Transportval

| Transport | Konsekvens |
| --- | --- |
| WebSocket | Går över TCP. Head-of-line-blocking gör att ett tappat paket håller upp allt efter det. Märks direkt i en twitch-shooter. |
| WebRTC DataChannel | Kan köras unreliable och unordered, alltså semantiskt nära UDP. Mer uppsättning: signalering, ICE, TURN vid behov. |

Rekommendation: WebRTC DataChannel i unreliable/unordered-läge. WebSocket duger
som första felsökningsbara variant, men bör inte vara målbilden.

## Vad som återstår att bygga

1. **Relay-tjänst.** WebRTC in, UDP ut mot hlds. En process per server eller en
   multiplexande process; enklast är en per serverinstans.
2. **En andra WASM-build.** Den nuvarande `xash-protocol46.wasm` är byggd för
   demouppspelning: HLTV-kamera, protokoll 46-quirks och en fast-forward som
   medvetet konsumerar paket utan realtidspacing. Live-spel ska använda
   stock-`xash.wasm` från npm-paketet. Två builds sida vid sida, inte en
   förgrening i klientkoden.
3. **Autentisering utan Steam.** Browserklienter har ingen Steam-biljett. Servern
   måste därför köras no-steam, i praktiken ReHLDS med Reunion, alternativt
   `sv_lan 1` för en helt sluten krets.
4. **Inmatning.** Pointer lock, rå mus-sampling och tangentbindningar. Minsta
   biten, eftersom rendering och ljud redan fungerar.
5. **`cs_guardtower` i kartbiblioteket.** Lägg den under
   `game-assets/map-library/fdc03b7d/cstrike/maps/` på samma sätt som övriga
   custom-banor, så att server och klient serverar exakt samma fil.
6. **Lobby och livscykel**, om det ska vara mer än en enda fast server: starta,
   stoppa och tilldela serverinstanser, samt en sidvy som visar dem.

## Omfattningsnivåer

| Nivå | Innehåll | Storleksordning |
| --- | --- | --- |
| Prototyp | En server, en bana, ingen lobby, känd krets spelare | Helg till en vecka |
| Liten tjänst | Flera samtidiga servrar, lobby, enkel matchmaking | Veckor |
| Publik drift | Robusthet, missbrukshantering, moderering, övervakning | Månader plus löpande drift |

Uppskattningarna gäller arbetsinsats, inte kalendertid, och förutsätter att den
uppströms multiplayer-uppsättningen fungerar som dokumenterad. Om den inte gör
det ligger den verkliga kostnaden i motorbygget, inte i webblagret.

## Risker och förbehåll

- **Latens.** Relayen lägger på ett extra hopp. Med TCP-transport blir det
  omedelbart kännbart; med WebRTC beror det på placering av relayen relativt
  spelarna.
- **Fusk.** En WASM-klient är fullt inspekterbar av den som kör den, och
  klassisk anti-cheat finns inte här. En sluten krets är motmedlet, inte teknik.
- **Drift.** En publik server behöver moderering. Det är återkommande arbete,
  inte en engångsinsats.
- **Rättigheter.** Det här är den avgörande skillnaden mellan "fungerar" och "kan
  vara publikt". En öppen sajt levererar Valves banor, modeller och ljud till vem
  som helst som surfar in. Projektets egen licensnot säger att spelresurser ska
  användas från en installation som användaren har rätt att använda, och det
  villkoret går inte att upprätthålla för anonyma besökare. Med inloggning och en
  sluten krets är läget ett annat. Kommersiella sajter i samma genre opererar i
  den gråzonen; det gör den inte klarlagd.

## Nästa steg om utredningen ska drivas vidare

Bygg nivå ett och inget mer: relay, stock-build, `cs_guardtower`, en fast server.
Syftet är att svara på den enda fråga som inte går att räkna sig till i förväg —
om det faktiskt känns bra att spela genom relayen — innan något större byggs
ovanpå.
