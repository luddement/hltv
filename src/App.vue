<template>
  <main :class="['app-shell', `interface-${interfaceTheme}`, { 'engine-open': engineVisible }]">
    <section v-if="!engineVisible" class="workspace">
      <header class="topbar">
        <a class="brand" href="#" aria-label="HLTV Replay Lab">
          <span class="brand-mark"><i></i><i></i><i></i></span>
          <span>HLTV</span>
          <span class="brand-muted">Replay Lab</span>
        </a>
        <div class="topbar-actions">
          <label class="interface-theme-select">
            <span>Tema</span>
            <select :value="interfaceTheme" @change="onInterfaceThemeSelect">
              <option value="replay">Replay Lab</option>
              <option value="quakenet">QuakeNet XP</option>
            </select>
          </label>
          <div class="runtime-pill"><span></span> Kör lokalt i din browser</div>
        </div>
      </header>

      <div v-if="interfaceTheme === 'replay'" class="hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">GoldSrc archive player / build 001</p>
          <h1>Gamla matcher.<br /><em>Nytt liv.</em></h1>
          <p class="lede">
            Öppna klassiska HLTV-demos direkt på din Mac. Inga uppladdningar,
            ingen videokonvertering—originalmotorn kör matchen lokalt.
          </p>
        </div>

        <aside class="signal-card" aria-label="Systemstatus">
          <div class="radar">
            <span class="radar-ring radar-ring-one"></span>
            <span class="radar-ring radar-ring-two"></span>
            <span class="radar-sweep"></span>
            <span class="radar-dot dot-one"></span>
            <span class="radar-dot dot-two"></span>
            <span class="radar-dot dot-three"></span>
          </div>
          <div class="signal-copy">
            <span>Engine</span>
            <strong>Xash3D + CS 1.6</strong>
            <small>Native HUD · versionsprofiler</small>
          </div>
        </aside>
      </div>

      <section v-else class="mirc-shell" aria-label="QuakeNet och mIRC 6 i Windows XP-stil">
        <div class="mirc-titlebar">
          <span class="mirc-icon">m</span>
          <strong>mIRC v6.16 - [#replaylab]</strong>
          <div class="mirc-window-controls"><button type="button" aria-label="Minimera">_</button><button type="button" aria-label="Maximera">□</button><button class="close" type="button" aria-label="Stäng">×</button></div>
        </div>
        <div class="mirc-menubar"><span>File</span><span>View</span><span>Favorites</span><span>Tools</span><span>Commands</span><span>Window</span><span>Help</span></div>
        <div class="mirc-toolbar">
          <button class="mirc-tool mirc-tool-connect" type="button" aria-label="Connect"><span></span></button>
          <button class="mirc-tool mirc-tool-favorites" type="button" aria-label="Favorites"><span></span></button>
          <button class="mirc-tool mirc-tool-folder" type="button" aria-label="Open folder"><span></span></button><i></i>
          <div><span>irc.quakenet.org</span><strong>#replaylab</strong></div>
          <small>QuakeNet · Connected</small>
        </div>
        <div class="mirc-channel-tabs"><button>Status</button><button class="active">#replaylab</button><button>@highlights</button><button>Notify List</button></div>
        <div class="mirc-main">
          <div class="mirc-chat">
            <div class="mirc-topic"><span>#replaylab</span> old demos never die | !top5 !score !play</div>
            <div class="mirc-lines">
              <p><time>[{{ mircClock }}]</time> <b class="irc-blue">* Now talking in #replaylab</b></p>
              <p><time>[{{ mircClock }}]</time> <b class="irc-green">* Topic is 'HLTV Replay Lab // GoldSrc archive player'</b></p>
              <p><time>[{{ mircClock }}]</time> <b class="irc-gray">-Q- Welcome to QuakeNet. You are now authed.</b></p>
              <p><time>[{{ mircClock }}]</time> <b class="irc-red">&lt;@ReplayBot&gt;</b> demo loaded: <b>{{ demoInfo?.name ?? 'waiting_for_demo.dem' }}</b></p>
              <p><time>[{{ mircClock }}]</time> <b class="irc-blue">&lt;+m0nkey&gt;</b> !top5</p>
              <template v-if="topMoments.length">
                <p v-for="(moment, index) in topMoments" :key="moment.momentId" class="mirc-highlight-line">
                  <time>[{{ mircClock }}]</time>
                  <b class="irc-red">&lt;@ReplayBot&gt;</b>
                  <span class="irc-rank">#{{ index + 1 }}</span>
                  <b class="irc-nick">{{ playerLabel(moment.killerPlayerId, moment.startTimeMs) }}</b>
                  — <b class="irc-score">{{ moment.rating.score }}/100</b>
                  — {{ moment.eventIds.length }} {{ moment.eventIds.length === 1 ? 'frag' : 'frags' }}
                  — {{ moment.rating.reasons.slice(0, 2).map((entry) => entry.label).join(' / ') }}
                </p>
              </template>
              <p v-else><time>[{{ mircClock }}]</time> <b class="irc-red">&lt;@ReplayBot&gt;</b> indexing demo, hold on...</p>
              <p><time>[{{ mircClock }}]</time> <b class="irc-blue">&lt;+m0nkey&gt;</b> gamla matcher. nytt liv.</p>
              <p><time>[{{ mircClock }}]</time> <b class="irc-green">* @ReplayBot sets mode: +o movie-maker</b></p>
            </div>
            <div class="mirc-input"><span>&gt;</span><strong>type /play #1 to watch the frag_</strong></div>
          </div>
          <aside class="mirc-nicks">
            <strong>#replaylab: {{ analysisIndex?.players.length ?? 0 }}</strong>
            <span class="op">@Q</span><span class="op">@ReplayBot</span><span class="voice">+m0nkey</span>
            <span v-for="player in killerPlayers.slice(0, 9)" :key="player.playerId">{{ playerLabel(player.playerId) }}</span>
          </aside>
        </div>
        <div class="mirc-statusbar"><span>#replaylab</span><span>{{ analysisIndex?.demo.isHltv ? 'HLTV' : 'POV' }}</span><span>{{ displayDeathEvents.length }} frags</span><span>Lag: 0.0%</span><strong>Online 02:41:37</strong></div>
      </section>

      <section class="setup-panel">
        <div class="setup-heading">
          <div>
            <p class="step-label">Match setup</p>
            <h2>Förbered uppspelningen</h2>
          </div>
          <div class="privacy-note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 10V8a5 5 0 0 1 10 0v2m-11 0h12v10H6z" />
            </svg>
            Filer lämnar aldrig datorn
          </div>
        </div>

        <div class="setup-columns">
          <article :class="['setup-card', { complete: demoInfo }]">
            <div class="card-number">01</div>
            <div class="card-body">
              <div class="card-title-row">
                <div>
                  <span class="card-kicker">Demo</span>
                  <h3>Välj matchfil</h3>
                </div>
                <span v-if="demoInfo" class="checkmark">✓</span>
              </div>

              <div v-if="demoLoading" class="skeleton-block">
                <span></span><span></span><span></span>
              </div>
              <div v-else-if="demoInfo" class="file-ticket">
                <div class="file-icon">DEM</div>
                <div class="file-main">
                  <strong>{{ demoInfo.name }}</strong>
                  <span>{{ formatBytes(demoInfo.size) }} · {{ demoInfo.magic }}</span>
                </div>
                <span class="ready-label">Redo</span>
              </div>
              <p v-else class="error-copy">{{ demoError }}</p>

              <dl v-if="demoInfo" class="metadata-grid">
                <div><dt>Karta</dt><dd>{{ demoInfo.mapName }}</dd></div>
                <div><dt>Längd</dt><dd>{{ formatDuration(demoInfo.duration) }}</dd></div>
                <div><dt>Nätprotokoll</dt><dd>{{ demoInfo.networkProtocol }}</dd></div>
                <div><dt>Typ</dt><dd>{{ analysisIndex ? (analysisIndex.demo.isHltv ? 'HLTV' : 'POV') : 'Analyserar…' }}</dd></div>
                <div><dt>Frames</dt><dd>{{ formatNumber(demoInfo.frameCount) }}</dd></div>
                <div><dt>Kart-CRC</dt><dd>{{ formatGoldSrcChecksum(demoInfo.mapChecksum) }}</dd></div>
              </dl>

              <button class="secondary-button" type="button" @click="demoInput?.click()">
                Välj en annan .dem
              </button>
              <input
                ref="demoInput"
                class="sr-only"
                type="file"
                accept=".dem"
                @change="onDemoSelected"
              />
            </div>
          </article>

          <div class="connector" aria-hidden="true"><span>→</span></div>

          <article :class="['setup-card', { complete: gameReady }]">
            <div class="card-number">02</div>
            <div class="card-body">
              <div class="card-title-row">
                <div>
                  <span class="card-kicker">Spelresurser</span>
                  <h3>Counter-Strike-resurser</h3>
                </div>
                <span v-if="gameReady" class="checkmark">✓</span>
              </div>

              <button
                v-if="!gameFiles.length"
                class="folder-drop"
                type="button"
                @click="selectGameFolder"
              >
                <span class="folder-icon"></span>
                <strong>Öppna spelmapp</strong>
                <small>Mappen som innehåller valve/ och cstrike/</small>
              </button>

              <div v-else class="folder-summary">
                <div class="folder-icon small"></div>
                <div>
                  <strong>{{ gameFolderName }}</strong>
                  <span>{{ formatNumber(gameFiles.length) }} filer · {{ formatBytes(gameBytes) }}</span>
                </div>
                <button type="button" @click="selectGameFolder">Byt mapp</button>
              </div>

              <ul class="asset-checks">
                <li :class="{ found: assetStatus.valve }"><span></span> valve/</li>
                <li :class="{ found: assetStatus.cstrike }"><span></span> cstrike/</li>
                <li :class="{ found: assetStatus.map && mapChecksumMatches }"><span></span> {{ requiredMapName }}.bsp · {{ requiredMapChecksum }}</li>
              </ul>
              <p v-if="gameError" class="error-copy">{{ gameError }}</p>

              <input
                ref="folderInput"
                class="sr-only"
                type="file"
                multiple
                webkitdirectory
                @change="onFolderInput"
              />
            </div>
          </article>
        </div>

        <div class="compatibility-strip">
          <span class="compat-icon">{{ demoInfo?.networkProtocol ?? '–' }}</span>
          <div>
            <strong>Versionsprofil väljs från demots header</strong>
            <p v-if="demoInfo">Demoformat {{ demoInfo.demoProtocol }} · GoldSrc protocol {{ demoInfo.networkProtocol }} · {{ demoInfo.directory.length }} sektioner</p>
            <p v-else>Protocol 46, 47 och 48 har separata kompatibilitetslägen</p>
          </div>
          <span class="compat-state">{{ demoInfo ? 'Matchad' : 'Väntar' }}</span>
        </div>

        <section v-if="demoInfo" class="analysis-panel" aria-labelledby="frag-heading">
          <div class="analysis-heading">
            <div>
              <p class="step-label">Demoindex v2</p>
              <h2 id="frag-heading">Frags i matchen</h2>
            </div>
            <div v-if="analysisIndex" class="analysis-stats">
              <span><strong>{{ displayDeathEvents.length }}</strong> frags</span>
              <span><strong>{{ analysisIndex.rounds.length }}</strong> ronder</span>
              <span><strong>{{ analysisIndex.players.length }}</strong> spelare</span>
            </div>
          </div>

          <div v-if="analysisLoading" class="analysis-state">
            <span class="spinner"></span>
            <div class="analysis-progress-copy">
              <strong>{{ analysisProgressLabel }}</strong>
              <small>{{ analysisProgressDetail }}</small>
              <div
                v-if="analysisProgressPercent !== null"
                class="analysis-progress-track"
                role="progressbar"
                aria-label="Analysförlopp"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="analysisProgressPercent"
              >
                <span :style="{ width: `${analysisProgressPercent}%` }"></span>
              </div>
            </div>
          </div>
          <p v-else-if="analysisError" class="analysis-error">{{ analysisError }}</p>
          <template v-else-if="analysisIndex">
            <div v-if="topMoments.length || topRounds.length" class="highlight-overview">
              <section>
                <div class="highlight-title">
                  <div><span>Highlights</span><strong>Bästa spelbara moments</strong></div>
                  <small>{{ analysisPerspectiveLabel }}</small>
                </div>
                <button
                  v-for="moment in topMoments"
                  :key="moment.momentId"
                  class="highlight-card"
                  type="button"
                  :disabled="!canLaunch"
                  @click="playMoment(moment)"
                >
                  <span class="score-badge">{{ moment.rating.score }}</span>
                  <span class="highlight-copy">
                    <strong>{{ playerLabel(moment.killerPlayerId, moment.startTimeMs) }} · {{ moment.eventIds.length }} {{ moment.eventIds.length === 1 ? 'frag' : 'frags' }}</strong>
                    <small>{{ moment.rating.reasons.slice(0, 2).map((entry) => entry.label).join(' · ') }}</small>
                  </span>
                  <span class="highlight-meta">{{ teamLabel(moment.team) }} · {{ momentVisibilityLabel(moment) }}</span>
                </button>
              </section>
              <section>
                <div class="highlight-title">
                  <div><span>Ronder</span><strong>Bästa lagrundor</strong></div>
                  <small>0–100</small>
                </div>
                <button
                  v-for="rating in topRounds"
                  :key="`${rating.roundId}-${rating.team}`"
                  class="highlight-card"
                  type="button"
                  :disabled="!canLaunch"
                  @click="playRatedRound(rating)"
                >
                  <span class="score-badge">{{ rating.score }}</span>
                  <span class="highlight-copy">
                    <strong>{{ roundLabel(rating.roundId) }} · {{ teamLabel(rating.team) }}</strong>
                    <small>{{ rating.reasons.slice(0, 2).map((entry) => entry.label).join(' · ') || 'Låg informationsnivå' }}</small>
                  </span>
                  <span class="highlight-meta">{{ Math.round(rating.confidence * 100) }} % säkerhet</span>
                </button>
              </section>
            </div>

            <div class="frag-filters">
              <label v-if="analysisIndex.demo.perspective.kind === 'hltv'">
                <span>Lag</span>
                <select v-model="highlightTeam">
                  <option value="all">Båda lag</option>
                  <option value="TERRORIST">T</option>
                  <option value="CT">CT</option>
                </select>
              </label>
              <label>
                <span>Spelare</span>
                <select v-model="fragPlayer">
                  <option value="all">Alla spelare</option>
                  <option v-for="player in killerPlayers" :key="player.playerId" :value="player.playerId">
                    {{ playerLabel(player.playerId) }}
                  </option>
                </select>
              </label>
              <label>
                <span>Sök</span>
                <input v-model.trim="fragSearch" type="search" placeholder="Namn eller vapen" />
              </label>
              <label>
                <span>Sortering</span>
                <select v-model="fragSort">
                  <option value="time">Matchtid</option>
                  <option value="score">Bäst betyg</option>
                </select>
              </label>
              <label class="headshot-filter">
                <input v-model="headshotsOnly" type="checkbox" />
                Bara headshots
              </label>
              <span class="filter-result">{{ filteredDeaths.length }} träffar</span>
            </div>

            <div class="frag-reel-launcher">
              <div>
                <span>Snabbgranskning</span>
                <strong>Se filtrerade POV-frags i följd</strong>
                <small v-if="analysisIndex.demo.perspective.kind === 'hltv'">
                  First person följer killern · endast frags med verifierad HLTV-POV
                </small>
                <small v-else>3 s före och efter · luckor över 10 s hoppas över</small>
              </div>
              <button
                type="button"
                :disabled="!canStartFragReel"
                @click="playFragReel"
              ><span class="play-icon"></span> Endast frags · {{ fragReelDeaths.length }}</button>
            </div>

            <div class="frag-list" role="table" aria-label="Fraglista">
              <div class="frag-header" role="row">
                <span>Tid</span><span>Frag</span><span>Vapen</span><span>Rond</span><span>Betyg</span>
              </div>
              <button
                v-for="death in filteredDeaths"
                :key="death.eventId"
                :class="['frag-row', { selected: selectedFragId === death.eventId }]"
                type="button"
                role="row"
                :disabled="!canLaunch"
                @click="playFrag(death)"
              >
                <time>{{ formatEventTime(death.demoTimeMs) }}</time>
                <span class="frag-players">
                  <b :class="teamClass(death.killerPlayerId, death.demoTimeMs)">{{ death.worldKill ? 'Världen' : playerLabel(death.killerPlayerId, death.demoTimeMs, death.killerSlot) }}</b>
                  <i>→</i>
                  <b :class="teamClass(death.victimPlayerId, death.demoTimeMs)">{{ playerLabel(death.victimPlayerId, death.demoTimeMs, death.victimSlot) }}</b>
                  <em v-if="death.headshot">HS</em>
                </span>
                <span class="frag-weapon">{{ death.weapon || 'okänt' }}</span>
                <span>{{ roundLabel(death.roundId) }}</span>
                <span class="frag-score">
                  <b>{{ fragRatingById.get(death.eventId)?.score ?? '–' }}</b>
                  <i>▶</i>
                </span>
              </button>
              <p v-if="!filteredDeaths.length" class="empty-frags">Inga frags matchar filtren.</p>
            </div>
            <p class="analysis-footnote">
              {{ analysisCacheHit ? 'Laddat från lokalt index.' : 'Analyserat och sparat lokalt.' }}
              Klicka på ett frag för att starta tre sekunder före händelsen.
            </p>
          </template>
        </section>

        <section class="hud-setup" aria-labelledby="hud-heading">
          <div class="hud-setup-copy">
            <p class="step-label">Presentation</p>
            <h2 id="hud-heading">Välj HUD</h2>
            <span>Kan bytas direkt under uppspelningen.</span>
          </div>
          <div class="hud-preset-grid" role="radiogroup" aria-label="HUD-läge">
            <button
              v-for="preset in hudPresets"
              :key="preset.id"
              :class="['hud-preset-button', { active: hudPreset === preset.id }]"
              type="button"
              role="radio"
              :aria-checked="hudPreset === preset.id"
              @click="setHudPreset(preset.id)"
            >
              <i>{{ preset.short }}</i>
              <strong>{{ preset.label }}</strong>
              <small>{{ preset.detail }}</small>
            </button>
          </div>
        </section>

        <div class="launch-row">
          <div class="launch-copy">
            <strong>{{ launchHint.title }}</strong>
            <span>{{ launchHint.detail }}</span>
          </div>
          <button
            class="launch-button"
            type="button"
            :disabled="!canLaunch"
            @click="playMatch"
          >
            <span v-if="launching" class="spinner"></span>
            <span v-else class="play-icon"></span>
            {{ launching ? 'Laddar motorn…' : 'Spela matchen' }}
          </button>
        </div>
      </section>

      <footer>
        <span>Runs on Xash3D-FWGS + CS16Client</span>
        <span>GoldSrc lives forever.</span>
      </footer>
    </section>

    <section v-show="engineVisible" :class="['engine-stage', `hud-${hudPreset}`]">
      <canvas
        ref="engineCanvas"
        id="canvas"
        class="engine-canvas emscripten"
        tabindex="0"
        @contextmenu.prevent
      ></canvas>

      <div v-if="launching" class="engine-loader">
        <div class="loader-ring"></div>
        <strong>{{ loadingLabel }}</strong>
        <span>{{ loadingProgress ? `${formatNumber(loadingProgress)} resurser` : 'Initierar CS-klienten…' }}</span>
      </div>

      <div v-else-if="seeking" class="seek-loader">
        <div class="loader-ring"></div>
        <strong>Snabbspolar till vald plats</strong>
        <span>Bild och ljud är avstängda under uppbyggnaden.</span>
      </div>

      <div
        v-if="customCrosshairVisible"
        class="replay-crosshair"
        aria-hidden="true"
      ><i></i><i></i><i></i><i></i></div>

      <div
        v-if="customHudVisible && activeHudDeath"
        :key="activeHudDeath.eventId"
        :class="['replay-hud', { 'hud-exiting': hudEventExiting }]"
        aria-live="polite"
      >
        <div v-if="hudPreset === 'cinematic'" class="cinematic-hud">
          <div class="cinematic-topline">
            <span>{{ demoInfo?.mapName }}</span>
            <b>{{ roundLabel(activeHudDeath.roundId) }}</b>
            <time>{{ formatEventTime(hudDemoTimeMs) }}</time>
          </div>
          <div class="cinematic-lower-third">
            <div class="hud-score-orbit"><strong>{{ activeHudRating?.score ?? '–' }}</strong><small>/100</small></div>
            <div>
              <span>{{ hudPhaseLabel }}</span>
              <strong>{{ playerLabel(activeHudDeath.killerPlayerId, activeHudDeath.demoTimeMs, activeHudDeath.killerSlot) }}</strong>
              <p>{{ activeHudWeaponSummary }}</p>
            </div>
          </div>
          <div v-if="hudFragLanded" class="cinematic-kill-confirm">
            <span>{{ activeHudDeath.headshot ? 'HEADSHOT' : 'FRAG' }}</span>
            <strong>{{ playerLabel(activeHudDeath.victimPlayerId, activeHudDeath.demoTimeMs, activeHudDeath.victimSlot) }}</strong>
          </div>
        </div>

        <div v-else-if="hudPreset === 'analyst'" class="analyst-hud">
          <div class="analyst-header">
            <div><span>Replay analysis</span><strong>{{ demoInfo?.mapName }} · {{ roundLabel(activeHudDeath.roundId) }}</strong></div>
            <div class="analyst-score"><strong>{{ activeHudRating?.score ?? '–' }}</strong><span>FRAG SCORE</span></div>
          </div>
          <div class="analyst-situation">
            <section class="analyst-team ct">
              <span>CT ALIVE</span>
              <strong>{{ activeHudDeath.aliveBefore.counterTerrorists.value ?? '–' }}</strong>
            </section>
            <div class="analyst-focus">
              <span>{{ hudPhaseLabel }}</span>
              <strong>{{ playerLabel(activeHudDeath.killerPlayerId, activeHudDeath.demoTimeMs, activeHudDeath.killerSlot) }}</strong>
              <p>{{ weaponLabel(activeHudDeath.weapon) }} → {{ playerLabel(activeHudDeath.victimPlayerId, activeHudDeath.demoTimeMs, activeHudDeath.victimSlot) }}</p>
              <div class="analyst-meter"><i :style="{ width: `${activeHudRating?.score ?? 0}%` }"></i></div>
            </div>
            <section class="analyst-team t">
              <span>T ALIVE</span>
              <strong>{{ activeHudDeath.aliveBefore.terrorists.value ?? '–' }}</strong>
            </section>
          </div>
          <div class="analyst-metrics">
            <div v-for="metric in activeHudReasons" :key="metric.code">
              <strong>{{ metric.points > 0 ? `+${metric.points}` : metric.points }}</strong>
              <span>{{ metric.label }}</span>
            </div>
          </div>
          <div class="analyst-timeline">
            <span>−3.0 s</span><i><b :style="{ left: `${hudTimelinePercent}%` }"></b></i><span>FRAG</span>
          </div>
        </div>

        <div v-else-if="hudPreset === 'movie'" class="movie-hud">
          <div class="movie-bars"></div>
          <div class="movie-title-card">
            <span>{{ hudPhaseLabel }}</span>
            <strong>{{ playerLabel(activeHudDeath.killerPlayerId, activeHudDeath.demoTimeMs, activeHudDeath.killerSlot) }}</strong>
            <p>{{ activeHudDeath.headshot ? 'HEADSHOT' : weaponLabel(activeHudDeath.weapon) }} · {{ activeHudRating?.score ?? '–' }}/100</p>
          </div>
          <div v-if="hudFragLanded" class="movie-kill-card">
            <span>{{ weaponLabel(activeHudDeath.weapon) }}</span>
            <strong>{{ playerLabel(activeHudDeath.victimPlayerId, activeHudDeath.demoTimeMs, activeHudDeath.victimSlot) }}</strong>
          </div>
        </div>
      </div>

      <div class="engine-toolbar">
        <button type="button" @click="closeEngine">← Tillbaka</button>
        <div>
          <span :class="['engine-light', { live: engineStarted }]"></span>
          {{ engineStarted ? 'Motor igång' : 'Startar…' }}
        </div>
        <div v-if="fragReelActive" class="frag-reel-status">
          ENDAST FRAGS <strong>{{ fragReelIndex + 1 }}/{{ fragReelDeaths.length }}</strong>
        </div>
        <button v-if="fragReelActive" type="button" @click="stopFragReel">Avsluta fragsläge</button>
        <label class="engine-hud-select">
          <span>HUD</span>
          <select :value="hudPreset" @change="onHudSelect">
            <option v-for="preset in hudPresets" :key="preset.id" :value="preset.id">{{ preset.label }}</option>
          </select>
        </label>
        <button type="button" @click="consoleOpen = !consoleOpen">Diagnostik</button>
      </div>

      <aside v-if="consoleOpen" class="console-panel">
        <div class="console-output">
          <p v-for="(line, index) in logs" :key="index" :class="{ error: line.error }">
            {{ line.message }}
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
  import {
    analyzeDemoInWorker,
    type WorkerAnalysisRun,
  } from '/@/analysis/analysis-worker-client';
  import type { AnalysisProgress } from '/@/analysis/analysis-worker-protocol';
  import type {
    DeathEvent,
    DemoAnalysisIndex,
    HighlightMoment,
    HistoryEntry,
    RoundRating,
  } from '/@/analysis/schema';
  import { isDeathEvent } from '/@/analysis/schema';
  import {
    type DemoSource,
    type GoldSrcDemo,
    formatBytes,
    formatDuration,
    inspectDemoFile,
    inspectDemoUrl,
  } from '/@/demo/goldsrc-demo';
  import {
    formatGoldSrcChecksum,
    goldSrcMapChecksum,
  } from '/@/demo/goldsrc-map-crc';
  import {
    fragWeaponLabel,
    fragWeaponViewModel,
  } from '/@/demo/weapon-presentation';
  import {
    HUD_EVENT_FADE_MS,
    HUD_EVENT_HOLD_MS,
    selectHudTimelineEvent,
  } from '/@/demo/hud-timeline';
  import { formatDemoTime } from '/@/demo/demo-time';
  import {
    FRAG_REEL_PREROLL_MS,
    isFragReelEligible,
    nextFragReelAction,
  } from '/@/demo/frag-reel';
  import type { GameAssetEntry } from '/@/services/local-asset-mount';
  import DemoEngine, { type DemoEngineOptions } from '/@/services/demo-engine';
  import openDirectory from '/@/utils/directory-open';

  type LogLine = { message: string; error: boolean };
  type HudPreset = 'original' | 'cinematic' | 'analyst' | 'movie' | 'clean';
  type InterfaceTheme = 'replay' | 'quakenet';

  const hudPresets: Array<{
    id: HudPreset;
    short: string;
    label: string;
    detail: string;
  }> = [
    { id: 'original', short: 'CS', label: 'Original', detail: 'Klassisk CS-HUD' },
    { id: 'cinematic', short: '01', label: 'Cinematic', detail: 'Ren fragpresentation' },
    { id: 'analyst', short: '02', label: 'Analyst', detail: 'Score och situation' },
    { id: 'movie', short: '03', label: 'Movie', detail: 'Filmisk lower third' },
    { id: 'clean', short: '00', label: 'Ren bild', detail: 'Ingen HUD' },
  ];

  const bundledDemo: DemoSource = {
    kind: 'url',
    name: 'r60_sthlm.dem',
    url: '/demos/r60_sthlm.dem',
  };

  const demoInput = ref<HTMLInputElement>();
  const folderInput = ref<HTMLInputElement>();
  const engineCanvas = ref<HTMLCanvasElement>();
  const demoInfo = ref<GoldSrcDemo>();
  const demoSource = ref<DemoSource>(bundledDemo);
  const demoLoading = ref(true);
  const demoError = ref('');
  const gameFiles = ref<GameAssetEntry[]>([]);
  const gameError = ref('');
  const mapChecksumMatches = ref(false);
  const launching = ref(false);
  const engineVisible = ref(false);
  const engineStarted = ref(false);
  const loadingProgress = ref(0);
  const logs = ref<LogLine[]>([]);
  const consoleOpen = ref(false);
  const seeking = ref(false);
  const analysisLoading = ref(false);
  const analysisError = ref('');
  const analysisIndex = shallowRef<DemoAnalysisIndex>();
  const analysisBuffer = shallowRef<ArrayBuffer>();
  const analysisCacheHit = ref(false);
  const analysisProgress = ref<AnalysisProgress>();
  const fragPlayer = ref('all');
  const highlightTeam = ref<'all' | 'TERRORIST' | 'CT'>('all');
  const fragSearch = ref('');
  const headshotsOnly = ref(false);
  const fragSort = ref<'time' | 'score'>('time');
  const selectedFragId = ref('');
  const hudPreset = ref<HudPreset>('cinematic');
  const interfaceTheme = ref<InterfaceTheme>('replay');
  const scoreboardHeld = ref(false);
  const fragReelActive = ref(false);
  const fragReelSeeking = ref(false);
  const fragReelIndex = ref(0);
  const hudPlaybackStartMs = ref(0);
  const hudPlaybackStartedAt = ref(0);
  const hudNow = ref(0);
  let hudClockFrame = 0;
  let analysisRequest = 0;
  let assetRequest = 0;
  let activeAnalysisRun: WorkerAnalysisRun | undefined;

  const deathEvents = computed(() => analysisIndex.value?.events.filter(isDeathEvent) ?? []);
  const fragRatingById = computed(() => new Map(
    analysisIndex.value?.fragRatings.map((rating) => [rating.eventId, rating]) ?? [],
  ));
  const customHudVisible = computed(() =>
    !launching.value
    && !seeking.value
    && !scoreboardHeld.value
    && hudPreset.value !== 'original'
    && hudPreset.value !== 'clean');
  const customCrosshairVisible = computed(() =>
    !launching.value
    && !seeking.value
    && !scoreboardHeld.value
    && hudPreset.value !== 'clean'
    && engineStarted.value);
  const hudDemoTimeMs = computed(() => hudPlaybackStartedAt.value
    ? hudPlaybackStartMs.value + Math.max(0, hudNow.value - hudPlaybackStartedAt.value)
    : hudPlaybackStartMs.value);
  const hudDeathEvents = computed(() => analysisIndex.value?.demo.perspective.kind === 'pov'
    ? deathEvents.value.filter((death) =>
        fragRatingById.value.get(death.eventId)?.visibility === 'recorded_pov')
    : deathEvents.value);
  const activeHudDeath = computed(() => selectHudTimelineEvent(
    fragReelActive.value ? fragReelDeaths.value : hudDeathEvents.value,
    hudDemoTimeMs.value,
  ));
  const activeHudRating = computed(() => activeHudDeath.value
    ? fragRatingById.value.get(activeHudDeath.value.eventId)
    : undefined);
  const hudFragLanded = computed(() => activeHudDeath.value
    ? hudDemoTimeMs.value >= activeHudDeath.value.demoTimeMs
    : false);
  const hudEventExiting = computed(() => activeHudDeath.value
    ? hudFragLanded.value
      && hudDemoTimeMs.value - activeHudDeath.value.demoTimeMs
        >= HUD_EVENT_HOLD_MS - HUD_EVENT_FADE_MS
    : false);
  const hudPhaseLabel = computed(() => hudFragLanded.value
    ? activeHudDeath.value?.headshot ? 'HEADSHOT CONFIRMED' : 'FRAG CONFIRMED'
    : 'FRAG INCOMING');
  const activeHudReasons = computed(() => activeHudRating.value?.reasons.slice(0, 4) ?? []);
  const activeHudPrimaryMetrics = computed(() => {
    const reasons = activeHudRating.value?.reasons ?? [];
    const preferred = ['precision_one_shot', 'precision_two_shots', 'fast_kill', 'headshot', 'clutch_kill'];
    return preferred
      .flatMap((code) => reasons.find((entry) => entry.code === code)?.label ?? [])
      .slice(0, 3);
  });
  const activeHudWeaponSummary = computed(() => [
    activeHudDeath.value ? fragWeaponLabel(activeHudDeath.value.weapon) : '',
    ...activeHudPrimaryMetrics.value,
  ].filter(Boolean).join(' · '));
  const hudTimelinePercent = computed(() => {
    const death = activeHudDeath.value;
    if (!death) return 0;
    return Math.max(0, Math.min(100,
      (hudDemoTimeMs.value - (death.demoTimeMs - 3_000)) / 3_000 * 100));
  });
  const displayDeathEvents = computed(() => {
    if (analysisIndex.value?.demo.perspective.kind === 'pov') {
      return deathEvents.value.filter((death) =>
        fragRatingById.value.get(death.eventId)?.visibility === 'recorded_pov');
    }
    if (highlightTeam.value === 'all') return deathEvents.value;
    return deathEvents.value.filter((death) =>
      fragRatingById.value.get(death.eventId)?.team === highlightTeam.value);
  });
  const playerById = computed(() => new Map(
    analysisIndex.value?.players.map((player) => [player.playerId, player]) ?? [],
  ));
  const killerPlayers = computed(() => {
    const ids = new Set(displayDeathEvents.value.flatMap((event) =>
      event.killerPlayerId ? [event.killerPlayerId] : [],
    ));
    return analysisIndex.value?.players.filter((player) => ids.has(player.playerId)) ?? [];
  });

  const historyValueAt = <T>(history: HistoryEntry<T>[], atMs?: number): T | undefined => {
    if (atMs === undefined) return history.at(-1)?.value;
    return history.find((entry) =>
      entry.fromMs <= atMs && (entry.toMs === null || atMs < entry.toMs),
    )?.value ?? history.at(-1)?.value;
  };

  const playerHistory = (
    playerId: string | null,
    atMs?: number,
  ): { name?: string; team?: string } => {
    if (!playerId) return {};
    const player = playerById.value.get(playerId);
    if (!player) return {};
    const session = atMs === undefined
      ? player.sessions.at(-1)
      : player.sessions.find((entry) =>
          entry.joinedAtMs <= atMs && (entry.leftAtMs === null || atMs <= entry.leftAtMs),
        ) ?? player.sessions.at(-1);
    return session ? {
      name: historyValueAt(session.names, atMs),
      team: historyValueAt(session.teams, atMs),
    } : {};
  };

  const playerLabel = (playerId: string | null, atMs?: number, slot?: number): string =>
    playerHistory(playerId, atMs).name ?? (slot ? `Okänd #${slot}` : 'Okänd');
  const teamClass = (playerId: string | null, atMs: number): string => {
    const team = playerHistory(playerId, atMs).team;
    return team === 'TERRORIST' ? 'team-t' : team === 'CT' ? 'team-ct' : '';
  };
  const roundLabel = (roundId: string | null): string => {
    const round = analysisIndex.value?.rounds.find((entry) => entry.roundId === roundId);
    return round ? `R${round.number}` : '–';
  };
  const teamLabel = (team: 'TERRORIST' | 'CT'): string =>
    team === 'TERRORIST' ? 'T' : 'CT';
  const topMoments = computed(() => [...(analysisIndex.value?.moments ?? [])]
    .filter((moment) => {
      const visibility = fragRatingById.value.get(moment.eventIds[0])?.visibility;
      return visibility === 'hltv_replay' || visibility === 'recorded_pov';
    })
    .filter((moment) => highlightTeam.value === 'all' || moment.team === highlightTeam.value)
    .sort((left, right) => right.rating.score - left.rating.score)
    .slice(0, 5));
  const topRounds = computed(() => [...(analysisIndex.value?.roundRatings ?? [])]
    .filter((rating) => rating.score > 0)
    .filter((rating) => highlightTeam.value === 'all' || rating.team === highlightTeam.value)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5));
  const analysisPerspectiveLabel = computed(() => {
    const perspective = analysisIndex.value?.demo.perspective;
    if (!perspective) return '';
    if (perspective.kind === 'hltv') return 'Båda lag · HLTV-underlag';
    const teams = Array.from(new Set(perspective.focusTeamHistory.map((entry) => entry.value)));
    return teams.length === 1
      ? `POV · endast inspelad spelare (${teamLabel(teams[0] as 'TERRORIST' | 'CT')})`
      : 'POV · endast inspelad spelare';
  });
  const momentVisibilityLabel = (moment: HighlightMoment): string => {
    const firstRating = fragRatingById.value.get(moment.eventIds[0]);
    if (firstRating?.visibility === 'recorded_pov') return 'Inspelad POV';
    if (firstRating?.visibility === 'killfeed_only') {
      return firstRating.reconstruction.position
        ? 'Lagkamrat · entitydata finns'
        : 'Endast killfeed';
    }
    if (firstRating?.visibility === 'hltv_replay') return 'Verifierad HLTV-POV';
    if (firstRating?.visibility === 'hltv_director') return 'HLTV-direktör · POV saknas';
    return 'Bild okänd';
  };
  const formatEventTime = formatDemoTime;
  const filteredDeaths = computed(() => {
    const query = fragSearch.value.toLocaleLowerCase('sv-SE');
    const matches = displayDeathEvents.value.filter((death) => {
      if (fragPlayer.value !== 'all' && death.killerPlayerId !== fragPlayer.value) return false;
      if (headshotsOnly.value && !death.headshot) return false;
      if (!query) return true;
      return [
        death.weapon,
        playerLabel(death.killerPlayerId, death.demoTimeMs, death.killerSlot),
        playerLabel(death.victimPlayerId, death.demoTimeMs, death.victimSlot),
      ].some((value) => value.toLocaleLowerCase('sv-SE').includes(query));
    });
    return fragSort.value === 'score'
      ? [...matches].sort((left, right) =>
          (fragRatingById.value.get(right.eventId)?.score ?? -1)
          - (fragRatingById.value.get(left.eventId)?.score ?? -1))
      : matches;
  });
  const fragReelDeaths = computed(() => {
    const perspective = analysisIndex.value?.demo.perspective.kind;
    if (!perspective) return [];
    return filteredDeaths.value
      .filter((death) => isFragReelEligible(
        perspective,
        fragRatingById.value.get(death.eventId)?.visibility,
      ))
      .sort((left, right) => left.demoTimeMs - right.demoTimeMs);
  });

  const normalizedGamePaths = computed(() =>
    gameFiles.value.map((entry) => entry.path.toLowerCase().replace(/\\/g, '/')),
  );

  const requiredMapName = computed(() => demoInfo.value?.mapName.toLowerCase() || 'de_train');
  const requiredMapChecksum = computed(() =>
    formatGoldSrcChecksum(demoInfo.value?.mapChecksum ?? 0),
  );
  const assetStatus = computed(() => ({
    valve: normalizedGamePaths.value.some((path) => path.includes('/valve/')),
    cstrike: normalizedGamePaths.value.some((path) => path.includes('/cstrike/')),
    map: normalizedGamePaths.value.some((path) =>
      path.endsWith(`/cstrike/maps/${requiredMapName.value}.bsp`),
    ),
  }));

  const gameReady = computed(
    () => assetStatus.value.valve && assetStatus.value.cstrike && assetStatus.value.map && mapChecksumMatches.value,
  );
  const gameBytes = computed(() =>
    gameFiles.value.reduce(
      (total, entry) => total + ('file' in entry ? entry.file.size : entry.size),
      0,
    ),
  );
  const gameFolderName = computed(() =>
    'url' in (gameFiles.value[0] ?? {})
      ? 'Valve HLDS · lokalt installerat'
      : gameFiles.value[0]?.path.split('/')[0] ?? 'Spelmapp',
  );
  const canLaunch = computed(
    () => Boolean(demoInfo.value && gameReady.value && !launching.value),
  );
  const canStartFragReel = computed(() =>
    canLaunch.value && fragReelDeaths.value.length > 0);
  const loadingLabel = computed(() =>
    loadingProgress.value ? 'Monterar Counter-Strike' : 'Startar Xash3D',
  );
  const launchHint = computed(() => {
    if (!demoInfo.value) {
      return { title: 'Demot saknas', detail: 'Välj en giltig GoldSrc .dem-fil.' };
    }
    if (!gameFiles.value.length) {
      return { title: 'Ett steg kvar', detail: 'Välj din gamla Half-Life/CS-mapp.' };
    }
    if (!gameReady.value) {
      return { title: 'Ofullständig spelmapp', detail: `valve/, cstrike/ och ${requiredMapName.value}.bsp krävs.` };
    }
    return { title: 'Allt är redo', detail: 'Matchen körs lokalt med WebAssembly.' };
  });

  const formatNumber = (value: number): string => value.toLocaleString('sv-SE');
  const mircClock = computed(() => new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()));

  const onInterfaceThemeSelect = (event: Event) => {
    const theme = (event.target as HTMLSelectElement).value as InterfaceTheme;
    interfaceTheme.value = theme;
    window.localStorage.setItem('replay-lab-interface-theme', theme);
  };
  const weaponLabel = fragWeaponLabel;

  const applyEngineHudPreset = () => {
    if (!engineStarted.value) return;
    if (scoreboardHeld.value) {
      DemoEngine.execute('hud_draw 1');
      return;
    }
    const original = hudPreset.value === 'original';
    DemoEngine.execute(`hud_draw ${original ? 1 : 0}`);
    // Custom presentation modes render their own sight because hud_draw 0 also
    // suppresses GoldSrc's native crosshair. Clean intentionally shows none.
    DemoEngine.execute(`crosshair ${original ? 1 : 0}`);
  };

  const showScoreboard = (event: KeyboardEvent) => {
    if (event.code !== 'Tab' || !engineVisible.value || !engineStarted.value) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (scoreboardHeld.value || event.repeat) return;
    scoreboardHeld.value = true;
    DemoEngine.execute('hud_draw 1');
    DemoEngine.execute('+showscores');
  };

  const hideScoreboard = (event?: KeyboardEvent) => {
    if (event && event.code !== 'Tab') return;
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (!scoreboardHeld.value) return;
    scoreboardHeld.value = false;
    if (engineStarted.value) {
      DemoEngine.execute('-showscores');
      applyEngineHudPreset();
      engineCanvas.value?.focus();
    }
  };
  const hideScoreboardOnBlur = () => hideScoreboard();

  const setHudPreset = (preset: HudPreset) => {
    hudPreset.value = preset;
    window.localStorage.setItem('replay-lab-hud-preset', preset);
    applyEngineHudPreset();
  };

  const onHudSelect = (event: Event) => {
    setHudPreset((event.target as HTMLSelectElement).value as HudPreset);
    engineCanvas.value?.focus();
  };

  const tickHudClock = (now: number) => {
    hudNow.value = now;
    updateFragReel();
    hudClockFrame = window.requestAnimationFrame(tickHudClock);
  };
  const analysisProgressPercent = computed(() => {
    const progress = analysisProgress.value;
    if (!progress || progress.current === null || progress.total === null || progress.total <= 0) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(progress.current / progress.total * 100)));
  });
  const analysisProgressLabel = computed(() => {
    switch (analysisProgress.value?.phase) {
      case 'reading': return 'Läser demot i bakgrunden';
      case 'hashing': return 'Verifierar demots identitet';
      case 'cache': return 'Söker i det lokala indexet';
      case 'parsing': return 'Avkodar demopaket';
      case 'indexing': return 'Normaliserar matchhändelser';
      case 'saving': return 'Sparar demoindexet lokalt';
      default: return 'Startar analysworkern';
    }
  });
  const analysisProgressDetail = computed(() => {
    const progress = analysisProgress.value;
    if (!progress) return 'Förbereder analysen utan att blockera gränssnittet…';
    if (progress.phase === 'reading' && progress.current !== null && progress.total !== null) {
      return `${formatBytes(progress.current)} av ${formatBytes(progress.total)}`;
    }
    if (progress.phase === 'parsing') {
      const segment = progress.directoryEntry === undefined
        ? ''
        : `Sektion ${progress.directoryEntry + 1} av ${progress.directoryCount ?? '–'}`;
      const time = progress.demoTimeMs === undefined
        ? ''
        : ` · demotid ${formatEventTime(progress.demoTimeMs)}`;
      return `${segment}${time}` || 'Läser protokollmeddelanden…';
    }
    if (progress.phase === 'indexing' && progress.current !== null && progress.total !== null) {
      return `${formatNumber(progress.current)} av ${formatNumber(progress.total)} analysframes`;
    }
    if (progress.phase === 'hashing') return 'Beräknar SHA-256 för cacheidentiteten…';
    if (progress.phase === 'cache') return 'Kontrollerar IndexedDB…';
    if (progress.phase === 'saving') return 'Indexet blir tillgängligt vid nästa omladdning…';
    return 'Analyserar demot lokalt…';
  });

  const analyzeSelectedDemo = async (selectedDemo: GoldSrcDemo, source: DemoSource) => {
    activeAnalysisRun?.cancel();
    const request = ++analysisRequest;
    analysisLoading.value = true;
    analysisError.value = '';
    analysisIndex.value = undefined;
    analysisBuffer.value = undefined;
    analysisCacheHit.value = false;
    analysisProgress.value = undefined;
    selectedFragId.value = '';
    fragPlayer.value = 'all';
    highlightTeam.value = 'all';
    const run = analyzeDemoInWorker(selectedDemo, source, (progress) => {
      if (request === analysisRequest) analysisProgress.value = progress;
    });
    activeAnalysisRun = run;
    try {
      const { buffer, index, cacheHit } = await run.promise;
      if (request !== analysisRequest) return;
      analysisBuffer.value = buffer;
      analysisIndex.value = index;
      analysisCacheHit.value = cacheHit;
    } catch (error) {
      if (request !== analysisRequest) return;
      analysisError.value = error instanceof Error
        ? error.message
        : 'Kunde inte analysera demot.';
    } finally {
      if (activeAnalysisRun === run) activeAnalysisRun = undefined;
      if (request === analysisRequest) {
        analysisLoading.value = false;
        analysisProgress.value = undefined;
      }
    }
  };

  const loadBundledDemo = async () => {
    demoLoading.value = true;
    demoError.value = '';
    try {
      demoInfo.value = await inspectDemoUrl(bundledDemo.name, bundledDemo.url);
      demoSource.value = bundledDemo;
      void analyzeSelectedDemo(demoInfo.value, bundledDemo);
      await loadInstalledGameAssets();
    } catch (error) {
      demoInfo.value = undefined;
      demoError.value = error instanceof Error ? error.message : 'Kunde inte läsa demot.';
    } finally {
      demoLoading.value = false;
    }
  };

  const onDemoSelected = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (engineStarted.value || engineVisible.value || DemoEngine.running) closeEngine();
    demoLoading.value = true;
    demoError.value = '';
    mapChecksumMatches.value = false;
    gameFiles.value = [];
    try {
      const inspected = await inspectDemoFile(file);
      demoInfo.value = inspected;
      demoSource.value = { kind: 'file', name: file.name, file };
      void analyzeSelectedDemo(inspected, demoSource.value);
      await loadInstalledGameAssets(inspected);
    } catch (error) {
      demoInfo.value = undefined;
      demoError.value = error instanceof Error ? error.message : 'Kunde inte läsa demot.';
    } finally {
      demoLoading.value = false;
    }
  };

  const entryBuffer = async (entry: GameAssetEntry): Promise<ArrayBuffer> => {
    if ('file' in entry) return entry.file.arrayBuffer();
    const response = await fetch(entry.url);
    if (!response.ok) throw new Error(`Kunde inte läsa ${entry.path}.`);
    return response.arrayBuffer();
  };

  const acceptGameFiles = async (
    files: GameAssetEntry[],
    selectedDemo = demoInfo.value,
  ) => {
    gameError.value = '';
    mapChecksumMatches.value = false;
    if (!files.length) {
      gameFiles.value = [];
      gameError.value = 'Mappen innehåller inga filer.';
      return;
    }

    const normalized = files.map((entry) => entry.path.toLowerCase().replace(/\\/g, '/'));
    const hasValve = normalized.some((path) => path.includes('/valve/'));
    const hasCstrike = normalized.some((path) => path.includes('/cstrike/'));
    if (!hasValve || !hasCstrike) {
      gameFiles.value = files;
      gameError.value = 'Välj rotmappen som innehåller både valve/ och cstrike/.';
      return;
    }

    if (!selectedDemo) {
      gameFiles.value = files;
      gameError.value = 'Välj ett demo innan kartversionen kontrolleras.';
      return;
    }

    const mapSuffix = `/${selectedDemo.mapName.toLowerCase()}.bsp`;
    const candidates = files.filter((_, index) => normalized[index].endsWith(mapSuffix));
    if (!candidates.length) {
      gameFiles.value = files;
      gameError.value = `${selectedDemo.mapName}.bsp saknas.`;
      return;
    }

    let exactMap: GameAssetEntry | undefined;
    if (selectedDemo.mapChecksum === 0) {
      // Early demos commonly leave the header CRC at 00000000.  In that case
      // there is no recorded revision to compare against, so use the installed
      // map rather than treating zero as a real checksum.
      exactMap = candidates[0];
    } else {
      for (const candidate of candidates) {
        try {
          if (goldSrcMapChecksum(await entryBuffer(candidate)) === selectedDemo.mapChecksum) {
            exactMap = candidate;
            break;
          }
        } catch {
          // Continue through any other historical variants in the selected root.
        }
      }
    }

    if (!exactMap) {
      gameFiles.value = files;
      gameError.value = `${selectedDemo.mapName}.bsp finns, men inte version ${formatGoldSrcChecksum(selectedDemo.mapChecksum)}.`;
      return;
    }

    const firstPath = files[0].path.replace(/\\/g, '/');
    const root = firstPath.includes('/') ? firstPath.slice(0, firstPath.indexOf('/')) : '';
    const canonicalPath = `${root ? `${root}/` : ''}cstrike/maps/${selectedDemo.mapName.toLowerCase()}.bsp`;
    const candidateSet = new Set(candidates);
    gameFiles.value = [
      ...files.filter((entry) => !candidateSet.has(entry)),
      { ...exactMap, path: canonicalPath },
    ];
    mapChecksumMatches.value = true;
  };

  const loadInstalledGameAssets = async (selectedDemo = demoInfo.value) => {
    if (!selectedDemo) return;
    const request = ++assetRequest;
    try {
      const response = await fetch(
        `/game-assets-manifest.json?map=${encodeURIComponent(selectedDemo.mapName.toLowerCase())}&checksum=${formatGoldSrcChecksum(selectedDemo.mapChecksum)}`,
      );
      if (!response.ok) return;
      const files = (await response.json()) as GameAssetEntry[];
      // Discard a late response if another demo was selected while assets were
      // being fetched. This prevents the previous map from being mounted into
      // the newly selected recording.
      if (request !== assetRequest) return;
      if (files.length) await acceptGameFiles(files, selectedDemo);
    } catch {
      // Dev-server or a copied static build without the optional local asset server.
    }
  };

  const selectGameFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      folderInput.value?.click();
      return;
    }
    const files = await openDirectory({ recursive: true });
    if (files) await acceptGameFiles(files);
  };

  const onFolderInput = async (event: Event) => {
    const list = Array.from((event.target as HTMLInputElement).files ?? []);
    await acceptGameFiles(
      list.map((file) => ({
        file,
        path: file.webkitRelativePath || file.name,
      })),
    );
  };

  const addLog = (message: string, error: boolean) => {
    logs.value.push({ message, error });
    if (logs.value.length > 250) logs.value.shift();
  };

  const launchDemo = async (
    startAtMs = 0,
    reconstructionCamera?: DemoEngineOptions['reconstructionCamera'],
  ) => {
    const selectedDemo = demoInfo.value;
    if (!canLaunch.value || !selectedDemo) return;
    launching.value = true;
    engineVisible.value = true;
    engineStarted.value = false;
    logs.value = [];
    loadingProgress.value = 0;
    seeking.value = startAtMs > 0;
    await nextTick();

    try {
      if (!engineCanvas.value) throw new Error('WebGL-ytan kunde inte skapas.');
      await DemoEngine.start({
        canvas: engineCanvas.value,
        gameFiles: gameFiles.value,
        demoSource: demoSource.value,
        demoBuffer: analysisBuffer.value,
        compatibilityProfile: selectedDemo.compatibilityProfile,
        isHltv: selectedDemo.isHltv,
        startAtMs,
        reconstructionCamera,
        onSeekStateChange: (value) => {
          seeking.value = value;
          if (!value) {
            hudPlaybackStartedAt.value = performance.now();
            applyEngineHudPreset();
          }
        },
        onLog: addLog,
        onProgress: ({ current }) => { loadingProgress.value = current; },
      });
      engineStarted.value = true;
      if (startAtMs === 0) hudPlaybackStartedAt.value = performance.now();
      applyEngineHudPreset();
      engineCanvas.value.focus();
      addLog('Xash3D och den riktiga Counter-Strike-klienten är startade.', false);
    } catch (error) {
      fragReelActive.value = false;
      fragReelSeeking.value = false;
      addLog(error instanceof Error ? error.message : 'Motorn kunde inte starta.', true);
      consoleOpen.value = true;
    } finally {
      launching.value = false;
    }
  };

  const killerCameraFor = (
    death: DeathEvent,
    startAtMs: number,
  ): DemoEngineOptions['reconstructionCamera'] | undefined => {
    const rating = fragRatingById.value.get(death.eventId);
    if (!rating || rating.visibility === 'recorded_pov') return undefined;
    const nativeHltv = rating.visibility === 'hltv_replay';
    const position = rating.reconstruction.positionValue;
    const entityAngles = rating.reconstruction.angleValue;
    if (!nativeHltv
      && (!position || !entityAngles
        || !position.every(Number.isFinite) || !entityAngles.every(Number.isFinite))) {
      return undefined;
    }
    const origin: [number, number, number] = position
      ? [position[0], position[1], position[2] + 17]
      : [0, 0, 0];
    const victimPosition = death.entityObservation.victim.positionValue;
    const killerLabel = playerLabel(
      death.killerPlayerId,
      death.demoTimeMs,
      death.killerSlot,
    );
    const victimLabel = playerLabel(
      death.victimPlayerId,
      death.demoTimeMs,
      death.victimSlot,
    );
    const angles: [number, number, number] = victimPosition
      ? (() => {
          const dx = victimPosition[0] - origin[0];
          const dy = victimPosition[1] - origin[1];
          const dz = victimPosition[2] + 17 - origin[2];
          const horizontal = Math.hypot(dx, dy);
          return [
            -Math.atan2(dz, horizontal) * 180 / Math.PI,
            Math.atan2(dy, dx) * 180 / Math.PI,
            0,
          ];
      })()
      : entityAngles
        ? [-entityAngles[0] * 3, entityAngles[1], 0]
        : [0, 0, 0];
    return {
      origin,
      angles,
      entityIndex: death.killerSlot,
      nativeHltv,
      weapon: fragWeaponViewModel(death.weapon),
      label: `${killerLabel} mot ${victimLabel}`,
      activateAfterMs: nativeHltv
        ? Math.max(250, death.demoTimeMs - startAtMs - 500)
        : Math.max(250, death.demoTimeMs - startAtMs - 1_250),
      durationMs: 5_000,
    };
  };

  const playFrag = (death: DeathEvent) => {
    fragReelActive.value = false;
    selectedFragId.value = death.eventId;
    const startAtMs = Math.max(0, death.demoTimeMs - 3_000);
    hudPlaybackStartMs.value = startAtMs;
    void launchDemo(startAtMs, killerCameraFor(death, startAtMs));
  };

  const playMatch = () => {
    fragReelActive.value = false;
    hudPlaybackStartMs.value = 0;
    void launchDemo();
  };

  const playFragReel = () => {
    const first = fragReelDeaths.value[0];
    if (!canStartFragReel.value || !first) return;
    fragReelActive.value = true;
    fragReelSeeking.value = false;
    fragReelIndex.value = 0;
    selectedFragId.value = first.eventId;
    const startAtMs = Math.max(0, first.demoTimeMs - FRAG_REEL_PREROLL_MS);
    hudPlaybackStartMs.value = startAtMs;
    const camera = killerCameraFor(first, startAtMs);
    if (camera?.nativeHltv) camera.activateAfterMs = 0;
    void launchDemo(startAtMs, camera);
  };

  const focusFragReelDeath = (death: DeathEvent | undefined) => {
    if (!death || analysisIndex.value?.demo.perspective.kind !== 'hltv') return;
    const camera = killerCameraFor(death, Math.max(0, death.demoTimeMs - FRAG_REEL_PREROLL_MS));
    if (!camera?.nativeHltv) return;
    DemoEngine.execute('-showscores');
    DemoEngine.execute('hltv_reconstruction_camera 0');
    DemoEngine.execute('spec_autodirector 0');
    DemoEngine.execute('set spec_pip_internal 0');
    DemoEngine.execute('spec_pip 0');
    DemoEngine.execute(`hltv_native_weapon ${camera.weapon}`);
    DemoEngine.execute(`hltv_spec_player ${camera.entityIndex}`);
  };

  const stopFragReel = () => {
    fragReelActive.value = false;
    fragReelSeeking.value = false;
    addLog('Endast frags avslutat; vanlig uppspelning fortsätter.', false);
    engineCanvas.value?.focus();
  };

  const updateFragReel = () => {
    if (!fragReelActive.value
      || fragReelSeeking.value
      || launching.value
      || seeking.value
      || !engineStarted.value) return;

    const action = nextFragReelAction(
      fragReelDeaths.value,
      fragReelIndex.value,
      hudDemoTimeMs.value,
    );
    if (action.type === 'wait') return;
    if (action.type === 'complete') {
      addLog(`Endast frags klart: ${fragReelDeaths.value.length} frags visade.`, false);
      closeEngine();
      return;
    }

    fragReelIndex.value = action.index;
    const next = fragReelDeaths.value[action.index];
    if (next) selectedFragId.value = next.eventId;
    if (action.type === 'advance') {
      focusFragReelDeath(next);
      return;
    }

    fragReelSeeking.value = true;
    seeking.value = true;
    addLog(`Endast frags: hoppar till ${formatEventTime(action.targetMs)}.`, false);
    void DemoEngine.seekTo(action.targetMs)
      .then(() => {
        hudPlaybackStartMs.value = action.targetMs;
        hudPlaybackStartedAt.value = performance.now();
        seeking.value = false;
        fragReelSeeking.value = false;
        focusFragReelDeath(next);
        applyEngineHudPreset();
        engineCanvas.value?.focus();
      })
      .catch((error) => {
        fragReelActive.value = false;
        seeking.value = false;
        fragReelSeeking.value = false;
        addLog(error instanceof Error ? error.message : 'Kunde inte hoppa till nästa frag.', true);
      });
  };

  const playMoment = (moment: HighlightMoment) => {
    fragReelActive.value = false;
    selectedFragId.value = moment.eventIds[0] ?? '';
    hudPlaybackStartMs.value = moment.startTimeMs;
    const death = deathEvents.value.find((entry) => entry.eventId === moment.eventIds[0]);
    void launchDemo(
      moment.startTimeMs,
      death ? killerCameraFor(death, moment.startTimeMs) : undefined,
    );
  };

  const playRatedRound = (rating: RoundRating) => {
    fragReelActive.value = false;
    const round = analysisIndex.value?.rounds.find((entry) => entry.roundId === rating.roundId);
    if (round) {
      hudPlaybackStartMs.value = Math.max(0, round.startTimeMs - 1_000);
      void launchDemo(hudPlaybackStartMs.value);
    }
  };

  function closeEngine() {
    if (scoreboardHeld.value && engineStarted.value) DemoEngine.execute('-showscores');
    scoreboardHeld.value = false;
    fragReelActive.value = false;
    fragReelSeeking.value = false;
    engineVisible.value = false;
    launching.value = false;
    DemoEngine.stop();
    engineStarted.value = false;
    seeking.value = false;
    hudPlaybackStartedAt.value = 0;
  }

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
    if (message.includes('not valid for pointer lock')) return;
    addLog(`Laddningsfel: ${message}`, true);
  };

  onMounted(() => {
    const savedHud = window.localStorage.getItem('replay-lab-hud-preset');
    if (hudPresets.some((preset) => preset.id === savedHud)) hudPreset.value = savedHud as HudPreset;
    const savedTheme = window.localStorage.getItem('replay-lab-interface-theme');
    if (savedTheme === 'replay' || savedTheme === 'quakenet') interfaceTheme.value = savedTheme;
    hudClockFrame = window.requestAnimationFrame(tickHudClock);
    loadBundledDemo();
    window.addEventListener('keydown', showScoreboard, true);
    window.addEventListener('keyup', hideScoreboard, true);
    window.addEventListener('blur', hideScoreboardOnBlur);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
  });
  onBeforeUnmount(() => {
    activeAnalysisRun?.cancel();
    window.cancelAnimationFrame(hudClockFrame);
    DemoEngine.stop();
    window.removeEventListener('keydown', showScoreboard, true);
    window.removeEventListener('keyup', hideScoreboard, true);
    window.removeEventListener('blur', hideScoreboardOnBlur);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  });
</script>
