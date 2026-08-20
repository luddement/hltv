<template>
  <main :class="['app-shell', `interface-${interfaceTheme}`, { 'engine-open': engineVisible }]">
    <section v-if="!engineVisible" class="workspace">
      <header class="topbar">
        <a class="brand" href="#" aria-label="PRAXXA HLTV Player">
          <span class="brand-mark"><i></i><i></i><i></i></span>
          <span>PRAXXA</span>
          <span class="brand-muted">HLTV Player</span>
        </a>
        <div class="topbar-actions">
          <div class="runtime-pill"><span></span> Runs locally in your browser</div>
        </div>
      </header>

      <div v-if="interfaceTheme === 'replay'" class="hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">PRAXXA HLTV Player / build 001</p>
          <h1>Old matches.<br /><em>New life.</em></h1>
          <p class="lede">
            Open classic HLTV demos directly in your browser. No uploads,
            no video conversion—the original engine runs the match locally.
          </p>
        </div>

        <aside class="signal-card" aria-label="System status">
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
            <small>Native HUD · version profiles</small>
          </div>
        </aside>
      </div>

      <section v-else class="mirc-shell" aria-label="QuakeNet and mIRC 6 in the Windows XP style">
        <div class="mirc-titlebar">
          <span class="mirc-icon">m</span>
          <strong>mIRC v6.16 - [#replaylab]</strong>
          <div class="mirc-window-controls"><button type="button" aria-label="Minimize">_</button><button type="button" aria-label="Maximize">□</button><button class="close" type="button" aria-label="Close">×</button></div>
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
              <p><time>[{{ mircClock }}]</time> <b class="irc-green">* Topic is 'PRAXXA HLTV Player // classic matches, new life'</b></p>
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
                  — {{ moment.rating.reasons.slice(0, 2).map(scoreReasonLabel).join(' / ') }}
                </p>
              </template>
              <p v-else><time>[{{ mircClock }}]</time> <b class="irc-red">&lt;@ReplayBot&gt;</b> indexing demo, hold on...</p>
              <p><time>[{{ mircClock }}]</time> <b class="irc-blue">&lt;+m0nkey&gt;</b> old matches. new life.</p>
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
            <h2>Prepare playback</h2>
          </div>
          <div class="privacy-note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 10V8a5 5 0 0 1 10 0v2m-11 0h12v10H6z" />
            </svg>
            Files never leave your device
          </div>
        </div>

        <section class="archive-browser" aria-labelledby="archive-heading">
          <div class="archive-heading">
            <div>
              <p class="step-label">Demo archive</p>
              <h2 id="archive-heading">Find a match worth watching</h2>
              <small v-if="demoCatalog">
                {{ demoCatalog.demoCount }} indexed demos · generated {{ formatArchiveDate(demoCatalog.generatedAt) }}
              </small>
              <small v-else>Dates, clans, players and every scored frag in one catalog.</small>
            </div>
            <span class="archive-result-count">{{ filteredArchiveDemos.length }} matches</span>
          </div>

          <div class="archive-filters">
            <label>
              <span>Search demos, clans or players</span>
              <input v-model.trim="archiveSearch" type="search" placeholder="crapoffline, luddi, de_nuke…" />
            </label>
            <label>
              <span>Year</span>
              <select v-model="archiveYear">
                <option value="all">All years</option>
                <option v-for="year in archiveYears" :key="year" :value="year">{{ year }}</option>
              </select>
            </label>
            <label>
              <span>Sort demos</span>
              <select v-model="archiveSort">
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="frag-desc">Highest frag score</option>
                <option value="round-desc">Highest round score</option>
              </select>
            </label>
          </div>

          <div v-if="catalogLoading" class="archive-state">
            <span class="spinner"></span> Loading demo catalog…
          </div>
          <p v-else-if="catalogError" class="analysis-error">{{ catalogError }}</p>
          <template v-else>
            <div class="archive-list" role="table" aria-label="Indexed demos">
              <div class="archive-row archive-row-header" role="row">
                <span>Date</span><span>Match</span><span>Map</span><span>Top frag</span><span>Top round</span><span></span>
              </div>
              <button
                v-for="entry in visibleArchiveDemos"
                :key="entry.path"
                class="archive-row"
                type="button"
                role="row"
                :disabled="entry.status === 'error' || archiveSelectionPath !== ''"
                :title="entry.error ?? `Open ${entry.filename}`"
                @click="loadArchiveDemo(entry)"
              >
                <time>{{ formatArchiveDate(entry.recordedAt) }}</time>
                <span class="archive-match">
                  <strong>{{ demoCatalogMatchup(entry) }}</strong>
                  <small>{{ entry.filename }} · {{ entry.fragCount ?? 0 }} scored frags</small>
                </span>
                <span>{{ entry.map ?? '–' }}</span>
                <b>{{ entry.topFragScore ?? '–' }}</b>
                <b>{{ entry.topRoundScore ?? '–' }}</b>
                <span class="archive-open">
                  {{ archiveSelectionPath === entry.path ? 'Loading…' : entry.status === 'error' ? 'Error' : 'Open' }}
                </span>
              </button>
            </div>
            <div v-if="visibleArchiveDemos.length < filteredArchiveDemos.length" class="archive-more">
              <span>Showing {{ visibleArchiveDemos.length }} of {{ filteredArchiveDemos.length }}</span>
              <button type="button" @click="archiveResultLimit += 50">Show 50 more</button>
            </div>
            <p v-else-if="!filteredArchiveDemos.length" class="empty-frags">No demos match the filters.</p>
          </template>
        </section>

        <div class="setup-columns">
          <article :class="['setup-card', { complete: demoInfo }]">
            <div class="card-number">01</div>
            <div class="card-body">
              <div class="card-title-row">
                <div>
                  <span class="card-kicker">Demo</span>
                  <h3>Select match file</h3>
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
                <span class="ready-label">Ready</span>
              </div>
              <p v-else class="error-copy">{{ demoError }}</p>

              <dl v-if="demoInfo" class="metadata-grid">
                <div><dt>Map</dt><dd>{{ demoInfo.mapName }}</dd></div>
                <div><dt>Duration</dt><dd>{{ formatDuration(demoInfo.duration) }}</dd></div>
                <div><dt>Network protocol</dt><dd>{{ demoInfo.networkProtocol }}</dd></div>
                <div><dt>Type</dt><dd>{{ analysisIndex ? (analysisIndex.demo.isHltv ? 'HLTV' : 'POV') : 'Analyzing…' }}</dd></div>
                <div><dt>Frames</dt><dd>{{ formatNumber(demoInfo.frameCount) }}</dd></div>
                <div><dt>Map CRC</dt><dd>{{ formatGoldSrcChecksum(demoInfo.mapChecksum) }}</dd></div>
              </dl>

              <button class="secondary-button" type="button" @click="demoInput?.click()">
                Select another .dem
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

          <!-- Spelresurserna hämtas numera från servern per demo, så den
               manuella mappväljaren behövs inte i normalfallet. Kortet är dock
               enda stället som visar VARFÖR resurserna inte duger — checklistan
               och gameError — och canLaunch kräver gameReady. Därför döljs det
               när allt stämmer och dyker upp när motorn inte kan starta. -->
          <article v-if="!gameReady" :class="['setup-card', { complete: gameReady }]">
            <div class="card-number">02</div>
            <div class="card-body">
              <div class="card-title-row">
                <div>
                  <span class="card-kicker">Game assets</span>
                  <h3>Counter-Strike assets</h3>
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
                <strong>Open game folder</strong>
                <small>The folder containing valve/ and cstrike/</small>
              </button>

              <div v-else class="folder-summary">
                <div class="folder-icon small"></div>
                <div>
                  <strong>{{ gameFolderName }}</strong>
                  <span>{{ formatNumber(gameFiles.length) }} files · {{ formatBytes(gameBytes) }}</span>
                </div>
                <button type="button" @click="selectGameFolder">Change folder</button>
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
            <strong>Version profile selected from the demo header</strong>
            <p v-if="demoInfo">Demo format {{ demoInfo.demoProtocol }} · GoldSrc protocol {{ demoInfo.networkProtocol }} · {{ demoInfo.directory.length }} sections</p>
            <p v-else>Protocols 46, 47 and 48 use separate compatibility modes</p>
          </div>
          <span class="compat-state">{{ demoInfo ? 'Matched' : 'Waiting' }}</span>
        </div>

        <section v-if="demoInfo" class="analysis-panel" aria-labelledby="frag-heading">
          <div class="analysis-heading">
            <div>
              <p class="step-label">Demoindex v2</p>
              <h2 id="frag-heading">Match frags</h2>
            </div>
            <div v-if="analysisIndex" class="analysis-stats">
              <span><strong>{{ displayDeathEvents.length }}</strong> frags</span>
              <span><strong>{{ analysisIndex.rounds.length }}</strong> rounds</span>
              <span><strong>{{ analysisIndex.players.length }}</strong> players</span>
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
                aria-label="Analysis progress"
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
                  <div><span>Highlights</span><strong>Best playable moments</strong></div>
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
                    <small>{{ moment.rating.reasons.slice(0, 2).map(scoreReasonLabel).join(' · ') }}</small>
                  </span>
                  <span class="highlight-meta">{{ logicalTeamNameForPlayer(moment.killerPlayerId) }} · {{ momentVisibilityLabel(moment) }}</span>
                </button>
              </section>
              <section>
                <div class="highlight-title">
                  <div><span>Rounds</span><strong>Best team rounds</strong></div>
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
                    <strong>{{ roundLabel(rating.roundId) }} · {{ roundTeamLabel(rating) }}</strong>
                    <small>{{ rating.reasons.slice(0, 2).map(scoreReasonLabel).join(' · ') || 'Limited information' }}</small>
                  </span>
                  <span class="highlight-meta">{{ Math.round(rating.confidence * 100) }}% confidence</span>
                </button>
              </section>
            </div>

            <div class="frag-filters">
              <div class="frag-filter-fields">
                <label v-if="analysisIndex.demo.perspective.kind === 'hltv'">
                  <span>Team · controls Only Frags</span>
                  <select :value="highlightTeam" @change="onHighlightTeamSelect">
                    <option value="all">{{ logicalMatchupLabel }}</option>
                    <option v-for="team in logicalTeamIndex.teams" :key="team.id" :value="team.id">
                      {{ team.name }}
                    </option>
                  </select>
                </label>
                <label>
                  <span>Player · controls Only Frags</span>
                  <select :value="fragPlayer" @change="onFragPlayerSelect">
                    <option value="all">All players</option>
                    <option v-for="player in killerPlayers" :key="player.playerId" :value="player.playerId">
                      {{ playerLabel(player.playerId) }}
                    </option>
                  </select>
                </label>
                <label>
                  <span>Search</span>
                  <input v-model.trim="fragSearch" type="search" placeholder="Name or weapon" />
                </label>
                <label>
                  <span>List sorting</span>
                  <select v-model="fragSort">
                    <option value="time">Match time</option>
                    <option value="score">Highest score</option>
                  </select>
                  <small>Changes the list only · playback stays chronological</small>
                </label>
              </div>
              <div class="frag-filter-meta">
                <label class="headshot-filter">
                  <input v-model="headshotsOnly" type="checkbox" />
                  Headshots only
                </label>
                <span class="filter-result">{{ filteredDeaths.length }} results</span>
              </div>
            </div>

            <div id="only-frags" class="frag-reel-launcher">
              <div class="frag-reel-copy">
                <span>Only Frags playback</span>
                <strong>Watch every frag by the selected player or team</strong>
                <small v-if="analysisIndex.demo.perspective.kind === 'hltv'">
                  {{ fragReelTeamLabel }} · first person follows the killer · continuous when the next frag is within 10 seconds
                </small>
                <small v-else>Continuous when the next frag is within 10 seconds · longer gaps are skipped</small>
                <small>3-second lead-in before the first frag and tail after the final frag.</small>
                <small>Playback always follows match time, regardless of list sorting.</small>
              </div>
              <div class="frag-reel-controls">
                <button
                  type="button"
                  :disabled="!canStartFragReel || movieExportRunning"
                  @click="() => playFragReel()"
                ><span class="play-icon"></span> Only Frags · {{ fragReelTeamShortLabel }} · {{ fragReelDeaths.length }}</button>
              </div>
            </div>

            <div class="frag-list" role="table" aria-label="Frag list">
              <div class="frag-header" role="row">
                <label class="movie-select-all" title="Select or deselect every visible movie frag">
                  <input
                    type="checkbox"
                    :checked="movieAllFragsSelected"
                    :indeterminate.prop="movieSomeFragsSelected"
                    :disabled="!movieSelectableFragIds.size || movieExportRunning"
                    aria-label="Select or deselect every visible movie frag"
                    @change="onMovieSelectAllCheckbox"
                  />
                  <span>Movie</span>
                </label>
                <span>#</span><span>Time</span><span>Frag</span><span>Weapon</span><span>Round</span><span>Score</span><span></span>
              </div>
              <template v-for="(death, index) in filteredDeaths" :key="death.eventId">
                <!-- Raden är medvetet inte klickbar. Hela ytan som träffyta
                     gjorde det för lätt att starta uppspelning av misstag när
                     man egentligen skulle kryssa i en ruta eller läsa poängen.
                     Uppspelning kräver nu ett tryck på play-knappen. -->
                <div
                  :class="['frag-row', { selected: selectedFragId === death.eventId, disabled: !canLaunch }]"
                  role="row"
                >
                  <label
                    class="movie-frag-checkbox"
                    :title="movieSelectableFragIds.has(death.eventId) ? 'Include this frag in the movie' : 'This frag cannot be exported from the recorded POV'"
                    @click.stop
                  >
                    <input
                      type="checkbox"
                      :checked="isMovieFragSelected(death.eventId)"
                      :disabled="!movieSelectableFragIds.has(death.eventId) || movieExportRunning"
                      :aria-label="`Include frag ${index + 1} in movie`"
                      @change="onMovieFragCheckbox(death.eventId, $event)"
                    />
                  </label>
                  <span class="frag-number">{{ index + 1 }}</span>
                  <time>{{ formatEventTime(death.demoTimeMs) }}</time>
                  <span class="frag-players">
                    <b :class="teamClass(death.killerPlayerId, death.demoTimeMs)">{{ death.worldKill ? 'World' : playerLabel(death.killerPlayerId, death.demoTimeMs, death.killerSlot) }}</b>
                    <i>→</i>
                    <b :class="teamClass(death.victimPlayerId, death.demoTimeMs)">{{ playerLabel(death.victimPlayerId, death.demoTimeMs, death.victimSlot) }}</b>
                    <em v-if="death.headshot">HS</em>
                  </span>
                  <span class="frag-weapon">{{ death.weapon || 'unknown' }}</span>
                  <span>{{ roundLabel(death.roundId) }}</span>
                  <span class="frag-score">
                    <b>{{ fragRatingById.get(death.eventId)?.score ?? '–' }}</b>
                    <button
                      class="frag-score-info"
                      type="button"
                      :aria-label="`Explain the score for frag ${index + 1}`"
                      :aria-expanded="expandedFragScoreId === death.eventId"
                      :disabled="!fragRatingById.has(death.eventId)"
                      title="Show score calculation"
                      @click.stop="toggleFragScoreDetails(death.eventId)"
                    >i</button>
                  </span>
                  <button
                    class="frag-play"
                    type="button"
                    :disabled="!canLaunch"
                    :aria-label="`Play frag ${index + 1}`"
                    :title="canLaunch ? 'Play from three seconds before the frag' : 'Open a demo first'"
                    @click.stop="playFrag(death)"
                  ><span aria-hidden="true">▶</span></button>
                </div>
                <div
                  v-if="expandedFragScoreId === death.eventId"
                  class="frag-score-details"
                  @click.stop
                >
                  <header>
                    <strong>Frag {{ index + 1 }} · score calculation</strong>
                    <span>
                      {{ fragRawScore(death.eventId) }} raw points
                      → {{ fragRatingById.get(death.eventId)?.score }}/100
                    </span>
                  </header>
                  <ul>
                    <li
                      v-for="reason in fragRatingById.get(death.eventId)?.reasons ?? []"
                      :key="`${death.eventId}-${reason.code}`"
                    >
                      <span>
                        <strong>{{ scoreReasonLabel(reason) }}</strong>
                        <small>{{ scoreEvidenceLabel(reason) }}</small>
                      </span>
                      <b :class="{ negative: reason.points < 0 }">{{ formatScorePoints(reason.points) }}</b>
                    </li>
                  </ul>
                  <p v-if="fragRawScore(death.eventId) !== fragRatingById.get(death.eventId)?.score">
                    Final scores are limited to the 0–100 range.
                  </p>
                </div>
              </template>
              <p v-if="!filteredDeaths.length" class="empty-frags">No frags match the filters.</p>
            </div>
            <p class="analysis-footnote">
              {{ analysisCacheHit ? 'Loaded from the local index.' : 'Analyzed and saved locally.' }}
              Click a frag to start three seconds before the event.
            </p>

            <section class="movie-export-section" aria-labelledby="movie-export-heading">
              <div class="movie-export-copy">
                <span>Movie export · {{ movieFragDeaths.length }}/{{ fragReelDeaths.length }} frags selected</span>
                <strong id="movie-export-heading">Create a high-quality Only Frags movie</strong>
                <small>
                  {{ formatDuration((fragMovieTimeline.durationMs + (movieIncludeIntro ? MOVIE_INTRO_DURATION_MS : 0)) / 1_000) }} · approximately {{ formatBytes(movieEstimatedBytes) }}
                </small>
                <small v-if="movieExportNotice" class="movie-export-notice">{{ movieExportNotice }}</small>
                <small v-if="movieExportError" class="movie-export-error">{{ movieExportError }}</small>
              </div>
              <div class="movie-export-controls">
                <div class="movie-selection-actions">
                  <button type="button" :disabled="movieExportRunning" @click="selectAllMovieFrags">Select all</button>
                  <button type="button" :disabled="movieExportRunning" @click="clearMovieFrags">Clear all</button>
                </div>
                <label class="movie-quality-select">
                  <span>Export quality</span>
                  <select v-model="movieQualityId" :disabled="movieExportRunning">
                    <option v-for="quality in MOVIE_QUALITIES" :key="quality.id" :value="quality.id">
                      {{ quality.label }}
                    </option>
                  </select>
                </label>
                <label class="movie-intro-toggle">
                  <input
                    v-model="movieIncludeIntro"
                    type="checkbox"
                    :disabled="movieExportRunning"
                    @change="saveMovieIntroPreference"
                  />
                  <span>Match intro</span>
                </label>
                <button
                  class="movie-export-button"
                  type="button"
                  :disabled="!canStartMovieExport || !movieExportSupported || movieExportRunning"
                  @click="exportFragMovie"
                >Create movie</button>
              </div>
            </section>
          </template>
        </section>

        <section class="hud-setup" aria-labelledby="hud-heading">
          <div class="hud-setup-copy">
            <p class="step-label">Presentation</p>
            <h2 id="hud-heading">Choose HUD</h2>
            <span>Can be changed during playback.</span>
          </div>
          <div class="hud-preset-grid" role="radiogroup" aria-label="HUD mode">
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
            {{ launching ? 'Loading engine…' : 'Play match' }}
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
        <span>{{ loadingProgress ? `${formatNumber(loadingProgress)} assets` : 'Initializing the CS client…' }}</span>
      </div>

      <div v-else-if="seeking" class="seek-loader">
        <div class="loader-ring"></div>
        <strong>Seeking to the selected position</strong>
        <span>Video and audio are disabled while the scene is rebuilt.</span>
      </div>

      <div
        v-if="customCrosshairVisible"
        :class="['replay-crosshair', nativeCrosshairClass]"
        aria-hidden="true"
      ><i></i><i></i><i></i><i></i></div>

      <div v-if="nativeScopeVisible" class="replay-scope" aria-hidden="true">
        <i></i>
      </div>

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
              <span>{{ scoreReasonLabel(metric) }}</span>
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

      <div v-if="movieExportRunning" class="movie-export-overlay">
        <div class="movie-export-card">
          <span>HQ-EXPORT · {{ movieQuality.label }}</span>
          <strong>{{ movieExportStatusLabel }}</strong>
          <p>{{ fragReelTeamLabel }} · {{ fragReelIndex + 1 }}/{{ activeFragReelDeaths.length }} frags</p>
          <div class="movie-export-progress"><i :style="{ width: `${movieExportProgress}%` }"></i></div>
          <small>
            {{ Math.round(movieExportProgress) }}% · {{ formatBytes(movieExportBytes) }} written
            · {{ movieRenderFps ? `${movieRenderFps.toFixed(1)} encoded FPS` : 'starting encoder…' }}
            · {{ movieRecorder?.encodingBacklogFrames ?? 0 }} queued frames
          </small>
          <small v-if="movieEncoderCatchingUp">
            Playback is temporarily frozen while the encoder drains its queue. Movie time and audio are paused together.
          </small>
          <small v-else>The movie is rendering behind this view. Keep this browser tab open and active.</small>
          <button
            type="button"
            :disabled="movieExportState === 'finalizing'"
            @click="() => cancelMovieExport()"
          >{{ movieExportState === 'finalizing' ? 'Saving file…' : 'Stop and save partial movie' }}</button>
        </div>
      </div>

      <div v-else-if="movieExportState === 'error'" class="movie-export-overlay">
        <div class="movie-export-card">
          <span>HQ EXPORT STOPPED</span>
          <strong>The export could not be completed</strong>
          <p class="movie-export-error">{{ movieExportError }}</p>
          <small v-if="movieExportNotice">{{ movieExportNotice }}</small>
          <small v-else>No movie was accepted. The details remain available for troubleshooting.</small>
          <button type="button" @click="downloadMovieExportDiagnostics">Download error log</button>
          <button type="button" @click="closeEngine">← Back</button>
        </div>
      </div>

      <div class="engine-toolbar">
        <button type="button" @click="closeEngine">← Back</button>
        <div>
          <span :class="['engine-light', { live: engineStarted }]"></span>
          {{ engineStarted ? 'Engine running' : 'Starting…' }}
        </div>
        <div v-if="fragReelActive" class="frag-reel-status">
          <span>ONLY FRAGS · {{ fragReelTeamLabel }} <strong>{{ fragReelIndex + 1 }}/{{ activeFragReelDeaths.length }}</strong></span>
          <i aria-hidden="true"></i>
          <span>SCORE <strong>{{ activeFragReelScore }}/100</strong></span>
        </div>
        <button v-if="fragReelActive" type="button" @click="stopFragReel">Exit Only Frags</button>
        <label class="engine-hud-select">
          <span>HUD</span>
          <select :value="hudPreset" :disabled="movieExportRunning" @change="onHudSelect">
            <option v-for="preset in hudPresets" :key="preset.id" :value="preset.id">{{ preset.label }}</option>
          </select>
        </label>
        <button type="button" @click="consoleOpen = !consoleOpen">Diagnostics</button>
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
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
  import {
    buildReplayRoute,
    parseReplayRoute,
    type ReplayRoute,
  } from '/@/app/replay-route';
  import {
    analyzeDemoInWorker,
    type WorkerAnalysisRun,
  } from '/@/analysis/analysis-worker-client';
  import type { AnalysisProgress } from '/@/analysis/analysis-worker-protocol';
  import {
    buildLogicalTeamIndex,
    logicalTeamForSideAt,
    type CompetitiveSide,
    type LogicalTeamId,
  } from '/@/analysis/team-identity';
  import {
    demoCatalogAssetUrl,
    demoCatalogMatchup,
    filterDemoCatalog,
    type DemoCatalog,
    type DemoCatalogEntry,
    type DemoCatalogSort,
  } from '/@/archive/demo-catalog';
  import { withVerifiedWallbangBonus } from '/@/analysis/highlight-analyzer';
  import type {
    DeathEvent,
    DemoAnalysisIndex,
    HighlightMoment,
    HistoryEntry,
    RoundRating,
    ScoreReason,
  } from '/@/analysis/schema';
  import { isDeathEvent } from '/@/analysis/schema';
  import {
    detectWallbangEventIds,
  } from '/@/demo/goldsrc-bsp-trace';
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
  import {
    MOVIE_QUALITIES,
    MOVIE_INTRO_DURATION_MS,
    buildFragMovieTimeline,
    estimatedMovieBytes,
    inferDemoMatchDate,
    movieBackpressureAction,
    movieCompletionAction,
    movieSideCount,
    movieSideEndsAtIndex,
    safeMovieFilename,
    MOVIE_SCOREBOARD_DURATION_MS,
    type MovieExportState,
    type MovieQualityId,
  } from '/@/movie/movie-project';
  import type {
    MovieCrosshairStyle,
    MovieHudFrame,
    MovieIntroCard,
    MovieKillfeedEntry,
  } from '/@/movie/movie-hud-renderer';
  import {
    MovieRecorder,
    preferredMovieContainer,
    prepareMovieOutput,
    type PreparedMovieOutput,
    type MovieCaptureMode,
  } from '/@/movie/movie-recorder';
  import type { GameAssetEntry } from '/@/services/local-asset-mount';
  import DemoEngine, { type DemoEngineOptions } from '/@/services/demo-engine';
  import openDirectory from '/@/utils/directory-open';

  type LogLine = { message: string; error: boolean };
  type MovieExportDiagnostic = {
    at: string;
    event: string;
    message: string;
    filename: string;
    quality: string;
    progressPercent: number;
    bytesWritten: number;
    capturedFrames: number;
    encodedFrames: number;
    backlogFrames: number;
    pageVisible: boolean;
  };
  type HudPreset = 'original' | 'cinematic' | 'analyst' | 'movie' | 'clean';
  type InterfaceTheme = 'replay' | 'quakenet';

  const MOVIE_EXPORT_DIAGNOSTICS_KEY = 'replay-lab-movie-export-diagnostics-v1';
  const MOVIE_INTRO_PREFERENCE_KEY = 'replay-lab-movie-intro-v1';

  const hudPresets: Array<{
    id: HudPreset;
    short: string;
    label: string;
    detail: string;
  }> = [
    { id: 'original', short: 'CS', label: 'Original', detail: 'Classic CS HUD' },
    { id: 'cinematic', short: '01', label: 'Cinematic', detail: 'Clean frag presentation' },
    { id: 'analyst', short: '02', label: 'Analyst', detail: 'Score and situation' },
    { id: 'movie', short: '03', label: 'Movie', detail: 'Cinematic lower third' },
    { id: 'clean', short: '00', label: 'Clean', detail: 'No HUD' },
  ];

  const demoInput = ref<HTMLInputElement>();
  const folderInput = ref<HTMLInputElement>();
  const engineCanvas = ref<HTMLCanvasElement>();
  const demoInfo = ref<GoldSrcDemo>();
  const demoSource = ref<DemoSource>();
  // Utan startdemo pågår ingen laddning; annars fastnar UI:t i väntläge.
  const demoLoading = ref(false);
  const demoError = ref('');
  const demoCatalog = shallowRef<DemoCatalog>();
  const catalogLoading = ref(true);
  const catalogError = ref('');
  const archiveSearch = ref('');
  const archiveYear = ref<'all' | number>('all');
  const archiveSort = ref<DemoCatalogSort>('date-desc');
  const archiveResultLimit = ref(50);
  const archiveSelectionPath = ref('');
  // archiveSelectionPath nollställs när laddningen är klar och duger därför
  // inte som adress. Den här behåller vilken katalogpost som visas.
  const loadedDemoPath = ref('');
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
  const highlightTeam = ref<'all' | LogicalTeamId>('all');
  const fragSearch = ref('');
  const headshotsOnly = ref(false);
  const fragSort = ref<'time' | 'score'>('time');
  const selectedFragId = ref('');
  const expandedFragScoreId = ref('');
  const hudPreset = ref<HudPreset>('original');
  const interfaceTheme = ref<InterfaceTheme>('replay');
  const scoreboardHeld = ref(false);
  const fragReelActive = ref(false);
  const fragReelSource = ref<'playback' | 'movie'>('playback');
  const fragReelSeeking = ref(false);
  const fragReelIndex = ref(0);
  const hudPlaybackStartMs = ref(0);
  const hudPlaybackStartedAt = ref(0);
  const hudNow = ref(0);
  const nativeFov = ref(90);
  const nativeWeaponId = ref(0);
  const movieQualityId = ref<MovieQualityId>('720p');
  const movieIncludeIntro = ref(true);
  const movieExcludedFragIds = ref<Set<string>>(new Set());
  const movieExportState = ref<MovieExportState>('idle');
  const movieExportError = ref('');
  const movieExportNotice = ref('');
  const movieExportBytes = ref(0);
  const movieExportProgress = ref(0);
  const movieRenderFps = ref(0);
  const movieEncoderCatchingUp = ref(false);
  const movieExportDiagnostics = ref<MovieExportDiagnostic[]>([]);
  let hudClockFrame = 0;
  let analysisRequest = 0;
  let assetRequest = 0;
  let activeAnalysisRun: WorkerAnalysisRun | undefined;
  let movieRecorder: MovieRecorder | undefined;
  let movieRecorderStarting = false;
  let preparedMovieOutput: PreparedMovieOutput | undefined;
  let movieCaptureMode: MovieCaptureMode = 'composited';
  let movieCaptureWaitStartedAt = 0;
  let movieEncoderLastProgressAt = 0;
  let movieEncoderLastEncodedFrames = 0;
  let movieLastDiagnosticProgressBucket = -1;
  let movieAutomaticScoreboardVisible = false;
  let movieScoreboardStartFrame = 0;
  const movieScoreboardsShown = new Set<string>();
  const verifiedWallbangEventIds = shallowRef<ReadonlySet<string>>(new Set());
  let activeScoringMapBuffer: ArrayBuffer | undefined;

  const deathEvents = computed(() => analysisIndex.value?.events.filter(isDeathEvent) ?? []);
  const archiveYears = computed(() => [...new Set(
    demoCatalog.value?.demos.flatMap((entry) => entry.year === null ? [] : [entry.year]) ?? [],
  )].sort((left, right) => right - left));
  const filteredArchiveDemos = computed(() => filterDemoCatalog(
    demoCatalog.value?.demos ?? [],
    archiveSearch.value,
    archiveYear.value,
    archiveSort.value,
  ));
  const visibleArchiveDemos = computed(() =>
    filteredArchiveDemos.value.slice(0, archiveResultLimit.value));
  const fragRatingById = computed(() => new Map(
    analysisIndex.value?.fragRatings.map((rating) => [
      rating.eventId,
      verifiedWallbangEventIds.value.has(rating.eventId)
        ? withVerifiedWallbangBonus(rating, (demoInfo.value?.mapChecksum ?? 0) !== 0)
        : rating,
    ]) ?? [],
  ));
  const refreshVerifiedWallbangs = () => {
    if (!activeScoringMapBuffer
      || !analysisIndex.value
      || !demoInfo.value
      || demoInfo.value.mapChecksum === 0) {
      verifiedWallbangEventIds.value = new Set();
      return;
    }
    try {
      verifiedWallbangEventIds.value = detectWallbangEventIds(
        activeScoringMapBuffer,
        deathEvents.value,
      );
    } catch {
      verifiedWallbangEventIds.value = new Set();
    }
  };
  const logicalTeamIndex = computed(() => buildLogicalTeamIndex(
    analysisIndex.value?.players ?? [],
  ));
  const logicalMatchupLabel = computed(() =>
    logicalTeamIndex.value.teams.map((team) => team.name).join(' vs '));
  const logicalTeamName = (teamId: LogicalTeamId): string =>
    logicalTeamIndex.value.teams.find((team) => team.id === teamId)?.name
      ?? (teamId === 'team-1' ? 'Team 1' : 'Team 2');
  const logicalTeamIdForPlayer = (playerId: string | null): LogicalTeamId | undefined =>
    playerId ? logicalTeamIndex.value.teamIdByPlayerId.get(playerId) : undefined;
  const logicalTeamNameForPlayer = (playerId: string | null): string => {
    const teamId = logicalTeamIdForPlayer(playerId);
    return teamId ? logicalTeamName(teamId) : 'Unknown team';
  };
  const reasonNumbers = (label: string): string[] => label.match(/[\d]+(?:[.,][\d]+)?/g) ?? [];
  const scoreReasonLabel = (entry: ScoreReason): string => {
    const numbers = reasonNumbers(entry.label);
    switch (entry.code) {
      case 'frag': return 'Frag';
      case 'headshot': return 'Headshot';
      case 'opening_kill': return 'Opening kill';
      case 'clutch_kill': return `Clutch frag in 1v${numbers.at(-1) ?? '?'}`;
      case 'numbers_disadvantage': return `Frag while down ${numbers[0] ?? '?'}v${numbers[1] ?? '?'}`;
      case 'round_win': return entry.points >= 15 ? 'Wins the round' : 'Contributes to a round win';
      case 'weapon_knife': return 'Knife frag';
      case 'weapon_deagle': return 'Deagle frag';
      case 'precision_one_shot': return '1 shot to kill';
      case 'precision_two_shots': return '2 shots to kill';
      case 'precision_short_burst': return `${numbers[0] ?? '?'} shots to kill`;
      case 'precision_controlled_burst': return `${numbers[0] ?? '?'} shots to kill`;
      case 'spray_penalty': return `${numbers[0] ?? '?'}-shot spray`;
      case 'fast_kill': return `Kill in ${numbers[0] ?? '?'} ms`;
      case 'spray_transfer': return 'Spray transfer to a new target';
      case 'kill_streak': return `Frag ${numbers[0] ?? '?'} in quick succession`;
      case 'trade': return 'Quick trade';
      case 'wallbang': return 'Wallbang';
      case 'wallbang_headshot': return 'Wallbang headshot';
      case 'long_distance': return `Long distance · ${numbers[0] ?? '?'} units`;
      case 'best_frag': return `Best frag ${numbers[0] ?? '?'}/100`;
      case 'multi_kill': return `${numbers[0] ?? '?'} frags in ${(numbers[1] ?? '?').replace(',', '.')} s`;
      case 'tempo': return 'High tempo';
      case 'headshots': return `${numbers[0] ?? '?'} headshots`;
      case 'best_moment': return `Best moment ${numbers[0] ?? '?'}/100`;
      case 'team_frags': return `${numbers[0] ?? '?'} team frags`;
      case 'comeback': return `Plays from a ${numbers[0] ?? '?'}-player disadvantage`;
      case 'clutch_round': return 'Clutch situation in the round';
      case 'bomb_context': return 'Bomb event affects the round';
      default: return entry.label;
    }
  };
  const scoreEvidenceLabel = (entry: ScoreReason): string => entry.evidence === 'observed'
    ? 'Observed in the demo'
    : 'Derived from match context';
  const formatScorePoints = (points: number): string => points > 0 ? `+${points}` : `${points}`;
  const fragRawScore = (eventId: string): number => fragRatingById.value.get(eventId)?.reasons
    .reduce((total, entry) => total + entry.points, 0) ?? 0;
  const toggleFragScoreDetails = (eventId: string) => {
    expandedFragScoreId.value = expandedFragScoreId.value === eventId ? '' : eventId;
  };
  const logicalTeamIdForSideAt = (side: CompetitiveSide, atMs: number): LogicalTeamId =>
    logicalTeamForSideAt(
      logicalTeamIndex.value,
      analysisIndex.value?.players ?? [],
      side,
      atMs,
    );
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
    && (analysisIndex.value?.demo.perspective.kind !== 'hltv'
      || (nativeFov.value > 40 && ![0, 3, 4, 6, 9, 13, 18, 24, 25, 29]
        .includes(nativeWeaponId.value)))
    && engineStarted.value);
  const nativeScopeVisible = computed(() =>
    !launching.value
    && !seeking.value
    && !scoreboardHeld.value
    && hudPreset.value !== 'clean'
    && hudPreset.value !== 'original'
    && analysisIndex.value?.demo.perspective.kind === 'hltv'
    && nativeFov.value <= 40
    && engineStarted.value);
  const nativeCrosshairStyle = computed<MovieCrosshairStyle>(() => {
    if ([1, 2, 10, 11, 16, 17, 26].includes(nativeWeaponId.value)) return 'pistol';
    if ([7, 12, 19, 23, 30].includes(nativeWeaponId.value)) return 'smg';
    if ([5, 20, 21].includes(nativeWeaponId.value)) return 'heavy';
    return 'rifle';
  });
  const nativeCrosshairClass = computed(() => `crosshair-${nativeCrosshairStyle.value}`);
  const hudDemoTimeMs = computed(() => hudPlaybackStartedAt.value
    ? hudPlaybackStartMs.value + Math.max(0, hudNow.value - hudPlaybackStartedAt.value)
    : hudPlaybackStartMs.value);
  const hudDeathEvents = computed(() => analysisIndex.value?.demo.perspective.kind === 'pov'
    ? deathEvents.value.filter((death) =>
        fragRatingById.value.get(death.eventId)?.visibility === 'recorded_pov')
    : deathEvents.value);
  const activeHudDeath = computed(() => selectHudTimelineEvent(
    fragReelActive.value ? activeFragReelDeaths.value : hudDeathEvents.value,
    hudDemoTimeMs.value,
  ));
  const activeHudRating = computed(() => activeHudDeath.value
    ? fragRatingById.value.get(activeHudDeath.value.eventId)
    : undefined);
  const activeFragReelScore = computed(() => {
    const death = activeFragReelDeaths.value[fragReelIndex.value];
    return death ? fragRatingById.value.get(death.eventId)?.score ?? '–' : '–';
  });
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
      logicalTeamIdForPlayer(death.killerPlayerId) === highlightTeam.value);
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
    playerHistory(playerId, atMs).name ?? (slot ? `Unknown #${slot}` : 'Unknown');
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
  const roundTeamLabel = (rating: RoundRating): string => {
    const round = analysisIndex.value?.rounds.find((entry) => entry.roundId === rating.roundId);
    const teamId = logicalTeamIdForSideAt(rating.team, round?.startTimeMs ?? 0);
    return logicalTeamName(teamId);
  };
  const topMoments = computed(() => [...(analysisIndex.value?.moments ?? [])]
    .filter((moment) => {
      const visibility = fragRatingById.value.get(moment.eventIds[0])?.visibility;
      return visibility === 'hltv_replay' || visibility === 'recorded_pov';
    })
    .filter((moment) => highlightTeam.value === 'all'
      || logicalTeamIdForPlayer(moment.killerPlayerId) === highlightTeam.value)
    .sort((left, right) => right.rating.score - left.rating.score)
    .slice(0, 5));
  const topRounds = computed(() => [...(analysisIndex.value?.roundRatings ?? [])]
    .filter((rating) => rating.score > 0)
    .filter((rating) => {
      if (highlightTeam.value === 'all') return true;
      const round = analysisIndex.value?.rounds.find((entry) => entry.roundId === rating.roundId);
      return logicalTeamIdForSideAt(rating.team, round?.startTimeMs ?? 0) === highlightTeam.value;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5));
  const analysisPerspectiveLabel = computed(() => {
    const perspective = analysisIndex.value?.demo.perspective;
    if (!perspective) return '';
    if (perspective.kind === 'hltv') return 'Both teams · HLTV data';
    const teams = Array.from(new Set(perspective.focusTeamHistory.map((entry) => entry.value)));
    return teams.length === 1
      ? `POV · recorded player only (${teamLabel(teams[0] as 'TERRORIST' | 'CT')})`
      : 'POV · recorded player only';
  });
  const momentVisibilityLabel = (moment: HighlightMoment): string => {
    const firstRating = fragRatingById.value.get(moment.eventIds[0]);
    if (firstRating?.visibility === 'recorded_pov') return 'Inspelad POV';
    if (firstRating?.visibility === 'killfeed_only') {
      return firstRating.reconstruction.position
        ? 'Teammate · entity data available'
        : 'Killfeed only';
    }
    if (firstRating?.visibility === 'hltv_replay') return 'Verified HLTV POV';
    if (firstRating?.visibility === 'hltv_director') return 'HLTV director · POV unavailable';
    return 'Video unknown';
  };
  const formatEventTime = formatDemoTime;
  const filteredDeaths = computed(() => {
    const query = fragSearch.value.toLocaleLowerCase('en-GB');
    const matches = displayDeathEvents.value.filter((death) => {
      if (fragPlayer.value !== 'all' && death.killerPlayerId !== fragPlayer.value) return false;
      if (headshotsOnly.value && !death.headshot) return false;
      if (!query) return true;
      return [
        death.weapon,
        playerLabel(death.killerPlayerId, death.demoTimeMs, death.killerSlot),
        playerLabel(death.victimPlayerId, death.demoTimeMs, death.victimSlot),
      ].some((value) => value.toLocaleLowerCase('en-GB').includes(query));
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
  const movieSelectableFragIds = computed(() => new Set(
    fragReelDeaths.value.map((death) => death.eventId),
  ));
  const movieFragDeaths = computed(() => fragReelDeaths.value.filter((death) =>
    !movieExcludedFragIds.value.has(death.eventId)));
  const movieAllFragsSelected = computed(() => movieSelectableFragIds.value.size > 0
    && [...movieSelectableFragIds.value].every((eventId) =>
      !movieExcludedFragIds.value.has(eventId)));
  const movieSomeFragsSelected = computed(() => !movieAllFragsSelected.value
    && [...movieSelectableFragIds.value].some((eventId) =>
      !movieExcludedFragIds.value.has(eventId)));
  const activeFragReelDeaths = computed(() => fragReelSource.value === 'movie'
    ? movieFragDeaths.value
    : fragReelDeaths.value);
  const movieScoreboardEvents = computed(() => {
    const focusTeam = fragPlayer.value !== 'all'
      ? logicalTeamIdForPlayer(fragPlayer.value)
      : highlightTeam.value !== 'all'
        ? highlightTeam.value
        : 'team-1';
    return movieFragDeaths.value.map((death) => ({
      demoTimeMs: death.demoTimeMs,
      side: logicalTeamIdForSideAt('TERRORIST', death.demoTimeMs) === focusTeam
        ? 'TERRORIST' as const
        : 'CT' as const,
    }));
  });
  const fragReelTeamLabel = computed(() => fragPlayer.value !== 'all'
    ? playerLabel(fragPlayer.value)
    : highlightTeam.value === 'all'
      ? logicalMatchupLabel.value
      : logicalTeamName(highlightTeam.value));
  const fragReelTeamShortLabel = computed(() => fragPlayer.value !== 'all'
    ? playerLabel(fragPlayer.value)
    : highlightTeam.value === 'all'
      ? 'Both'
      : logicalTeamName(highlightTeam.value));
  const fragMovieTimeline = computed(() => buildFragMovieTimeline(movieFragDeaths.value));
  const movieMatchDateLabel = computed(() => {
    const inferred = inferDemoMatchDate(demoSource.value?.name ?? '');
    if (!inferred) return '';
    const [year, month, day] = inferred.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
  });
  const movieIntroCard = computed<MovieIntroCard>(() => {
    const teams = logicalTeamIndex.value.teams;
    return {
      teams: [teams[0]?.name ?? 'Team 1', teams[1]?.name ?? 'Team 2'],
      matchDate: movieMatchDateLabel.value,
      mapName: demoInfo.value?.mapName ?? 'Unknown map',
      focusKind: fragPlayer.value !== 'all'
        ? 'player'
        : highlightTeam.value !== 'all'
          ? 'team'
          : 'match',
      focusLabel: fragPlayer.value !== 'all'
        ? playerLabel(fragPlayer.value)
        : highlightTeam.value !== 'all'
          ? logicalTeamName(highlightTeam.value)
          : 'Both teams',
      durationSeconds: MOVIE_INTRO_DURATION_MS / 1_000,
    };
  });
  const movieQuality = computed(() => MOVIE_QUALITIES.find((quality) =>
    quality.id === movieQualityId.value) ?? MOVIE_QUALITIES[0]);
  const movieEstimatedBytes = computed(() => estimatedMovieBytes(
    fragMovieTimeline.value.durationMs
      + movieSideCount(movieScoreboardEvents.value) * MOVIE_SCOREBOARD_DURATION_MS
      + (movieIncludeIntro.value ? MOVIE_INTRO_DURATION_MS : 0),
    movieQuality.value,
  ));
  const movieExportSupported = computed(() => Boolean(preferredMovieContainer()));
  const movieExportRunning = computed(() => [
    'starting', 'recording', 'finalizing',
  ].includes(movieExportState.value));
  const movieExportStatusLabel = computed(() => {
    if (movieExportState.value === 'starting') return 'Starting the local renderer';
    if (movieEncoderCatchingUp.value) return 'Encoder catching up · playback paused';
    if (scoreboardHeld.value) return 'Showing scoreboard · playback paused';
    if (movieExportState.value === 'recording') return 'Rendering video and audio';
    if (movieExportState.value === 'finalizing') return 'Finalizing the video file';
    return '';
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
      ? 'Valve HLDS · locally installed'
      : gameFiles.value[0]?.path.split('/')[0] ?? 'Game folder',
  );
  const canLaunch = computed(
    () => Boolean(demoInfo.value && gameReady.value && !launching.value),
  );
  const canStartFragReel = computed(() =>
    canLaunch.value && fragReelDeaths.value.length > 0);
  const canStartMovieExport = computed(() =>
    canLaunch.value && movieFragDeaths.value.length > 0);
  const loadingLabel = computed(() =>
    loadingProgress.value ? 'Mounting Counter-Strike' : 'Starting Xash3D',
  );
  const launchHint = computed(() => {
    if (!demoInfo.value) {
      return { title: 'Demo missing', detail: 'Select a valid GoldSrc .dem file.' };
    }
    if (!gameFiles.value.length) {
      return { title: 'One step left', detail: 'Select your Half-Life/CS folder.' };
    }
    if (!gameReady.value) {
      return { title: 'Incomplete game folder', detail: `valve/, cstrike/ and ${requiredMapName.value}.bsp are required.` };
    }
    return { title: 'Everything is ready', detail: 'The match runs locally with WebAssembly.' };
  });

  const formatNumber = (value: number): string => value.toLocaleString('en-GB');
  const formatArchiveDate = (value: string | null): string => value
    ? new Intl.DateTimeFormat('en-GB', {
        year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC',
      }).format(new Date(value))
    : 'Date unknown';
  const mircClock = computed(() => new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()));

  // --- delbara länkar -----------------------------------------------------
  // Adressen speglar vald demo och Only Frags-inställningarna, så att en
  // kopierad länk återskapar exakt den vyn. Hashen används bara till
  // rullningsmål, aldrig till tillstånd.
  const currentReplayRoute = computed<ReplayRoute>(() => ({
    demoPath: loadedDemoPath.value,
    team: highlightTeam.value,
    player: fragPlayer.value,
    search: fragSearch.value,
    sort: fragSort.value,
    headshotsOnly: headshotsOnly.value,
    anchor: '',
  }));

  // Sant medan vi läser adressen och skriver in den i tillståndet. Utan den
  // skulle synkningen skriva tillbaka halvfärdiga lägen medan demon laddas.
  let applyingRoute = false;

  const applyReplayRoute = async (route: ReplayRoute) => {
    applyingRoute = true;
    try {
      if (route.demoPath && route.demoPath !== loadedDemoPath.value) {
        const entry = demoCatalog.value?.demos.find((demo) => demo.path === route.demoPath);
        if (!entry) {
          demoError.value = `Demon ${route.demoPath} finns inte i katalogen.`;
          return;
        }
        // Måste inväntas: loadArchiveDemo nollställer lag och spelare, så
        // filtren nedan skulle annars skrivas över av laddningen.
        await loadArchiveDemo(entry);
      }
      highlightTeam.value = route.team as 'all' | LogicalTeamId;
      fragPlayer.value = route.player;
      fragSearch.value = route.search;
      fragSort.value = route.sort;
      headshotsOnly.value = route.headshotsOnly;
    } finally {
      applyingRoute = false;
    }

    if (!route.anchor) return;
    await nextTick();
    document.getElementById(route.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onPopState = () => {
    void applyReplayRoute(parseReplayRoute(window.location.href));
  };

  watch(currentReplayRoute, (route, previous) => {
    if (applyingRoute) return;
    const next = buildReplayRoute(route);
    if (next === `${window.location.pathname}${window.location.search}`) return;
    // Byte av demo är en ny vy och förtjänar en post i historiken, så
    // bakåtknappen tar dig till föregående demo. Filterjusteringar skriver
    // över samma post i stället för att fylla historiken med varje tangent.
    if (route.demoPath !== previous.demoPath) {
      window.history.pushState(null, '', next);
    } else {
      window.history.replaceState(null, '', next);
    }
  });

  const onHighlightTeamSelect = (event: Event) => {
    highlightTeam.value = (event.target as HTMLSelectElement).value as 'all' | LogicalTeamId;
    fragPlayer.value = 'all';
  };
  const onFragPlayerSelect = (event: Event) => {
    fragPlayer.value = (event.target as HTMLSelectElement).value;
    highlightTeam.value = 'all';
  };
  const saveMovieIntroPreference = () => {
    window.localStorage.setItem(MOVIE_INTRO_PREFERENCE_KEY, String(movieIncludeIntro.value));
  };
  const isMovieFragSelected = (eventId: string): boolean =>
    movieSelectableFragIds.value.has(eventId) && !movieExcludedFragIds.value.has(eventId);
  const toggleMovieFrag = (eventId: string, selected: boolean) => {
    const next = new Set(movieExcludedFragIds.value);
    if (selected) next.delete(eventId);
    else next.add(eventId);
    movieExcludedFragIds.value = next;
  };
  const onMovieFragCheckbox = (eventId: string, event: Event) => {
    toggleMovieFrag(eventId, (event.target as HTMLInputElement).checked);
  };
  const onMovieSelectAllCheckbox = (event: Event) => {
    if ((event.target as HTMLInputElement).checked) selectAllMovieFrags();
    else clearMovieFrags();
  };
  const selectAllMovieFrags = () => {
    const selectable = movieSelectableFragIds.value;
    movieExcludedFragIds.value = new Set(
      [...movieExcludedFragIds.value].filter((eventId) => !selectable.has(eventId)),
    );
  };
  const clearMovieFrags = () => {
    movieExcludedFragIds.value = new Set([
      ...movieExcludedFragIds.value,
      ...movieSelectableFragIds.value,
    ]);
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
    if (movieExportRunning.value) return;
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

  const setMovieAutomaticScoreboard = (
    visible: boolean,
    side?: 'TERRORIST' | 'CT',
  ) => {
    if (movieAutomaticScoreboardVisible === visible && scoreboardHeld.value === visible) return;
    movieAutomaticScoreboardVisible = visible;
    scoreboardHeld.value = visible;
    if (!engineStarted.value) return;
    if (visible) {
      DemoEngine.execute('hud_draw 1');
      DemoEngine.execute('+showscores');
      recordMovieExportDiagnostic(
        'scoreboard-shown',
        `Scoreboard shown for three seconds after the team's ${side === 'TERRORIST' ? 'T side' : 'CT side'}.`,
      );
      return;
    }
    DemoEngine.execute('-showscores');
    applyEngineHudPreset();
  };

  const finishMovieScoreboard = (now: number) => {
    setMovieAutomaticScoreboard(false);
    movieScoreboardStartFrame = 0;
    hudPlaybackStartedAt.value = now;
    if (!movieEncoderCatchingUp.value && engineStarted.value) {
      DemoEngine.execute('sys_timescale 1');
    }
  };

  const updateMovieAutomaticScoreboard = (now: number): boolean => {
    if (!movieAutomaticScoreboardVisible) return false;
    const recorder = movieRecorder;
    if (movieExportState.value !== 'recording' || !recorder || !fragReelActive.value) {
      finishMovieScoreboard(now);
      return false;
    }
    const recordedFrames = recorder.capturedFrames - movieScoreboardStartFrame;
    if (recordedFrames < Math.round(movieQuality.value.fps * MOVIE_SCOREBOARD_DURATION_MS / 1_000)) {
      return true;
    }
    finishMovieScoreboard(now);
    return false;
  };

  const startMovieAutomaticScoreboard = (): boolean => {
    const death = activeFragReelDeaths.value[fragReelIndex.value];
    const event = movieScoreboardEvents.value[fragReelIndex.value];
    if (movieExportState.value !== 'recording'
      || !death
      || !event
      || !movieSideEndsAtIndex(movieScoreboardEvents.value, fragReelIndex.value)
      || movieScoreboardsShown.has(death.eventId)) return false;
    // Do not cross the side boundary while the recorder is paused. Once the
    // encoder catches up, the next HUD tick starts the complete three-second card.
    if (movieEncoderCatchingUp.value || !movieRecorder) return true;
    try {
      DemoEngine.execute('sys_timescale 0');
    } catch (error) {
      movieExportError.value = error instanceof Error
        ? error.message
        : 'Could not freeze playback for the scoreboard.';
      void cancelMovieExport(true);
      return true;
    }
    const frozenDemoTimeMs = hudDemoTimeMs.value;
    hudPlaybackStartMs.value = frozenDemoTimeMs;
    hudPlaybackStartedAt.value = 0;
    movieScoreboardStartFrame = movieRecorder.capturedFrames;
    movieScoreboardsShown.add(death.eventId);
    setMovieAutomaticScoreboard(true, event.side);
    addLog(
      `Scoreboard: ${event.side === 'TERRORIST' ? 'T side' : 'CT side'} complete · 3 seconds.`,
      false,
    );
    return true;
  };

  const setHudPreset = (preset: HudPreset) => {
    if (movieExportRunning.value) return;
    hudPreset.value = preset;
    window.localStorage.setItem('replay-lab-hud-preset', preset);
    applyEngineHudPreset();
  };

  const onHudSelect = (event: Event) => {
    setHudPreset((event.target as HTMLSelectElement).value as HudPreset);
    engineCanvas.value?.focus();
  };

  const movieKillfeedSide = (
    playerId: string | null,
    atMs: number,
  ): MovieKillfeedEntry['killerSide'] => {
    const team = playerHistory(playerId, atMs).team;
    return team === 'TERRORIST' || team === 'CT' ? team : undefined;
  };

  const currentMovieKillfeed = (): MovieKillfeedEntry[] => {
    const nowMs = hudDemoTimeMs.value;
    return deathEvents.value
      .filter((entry) => entry.demoTimeMs <= nowMs && nowMs - entry.demoTimeMs < 6_000)
      .slice(-4)
      .map((entry) => ({
        killer: entry.worldKill
          ? 'World'
          : playerLabel(entry.killerPlayerId, entry.demoTimeMs, entry.killerSlot),
        victim: playerLabel(entry.victimPlayerId, entry.demoTimeMs, entry.victimSlot),
        weapon: fragWeaponLabel(entry.weapon),
        headshot: entry.headshot,
        killerSide: movieKillfeedSide(entry.killerPlayerId, entry.demoTimeMs),
        victimSide: movieKillfeedSide(entry.victimPlayerId, entry.demoTimeMs),
        ageMs: nowMs - entry.demoTimeMs,
      }));
  };

  const currentMovieHudFrame = (): MovieHudFrame | undefined => {
    if (scoreboardHeld.value) return undefined;
    const activeDeath = activeHudDeath.value;
    const death = activeDeath ?? activeFragReelDeaths.value[fragReelIndex.value];
    if (!death) return undefined;
    const rating = fragRatingById.value.get(death.eventId);
    const reasons = rating?.reasons.slice(0, 4) ?? [];
    const weaponSummary = [
      fragWeaponLabel(death.weapon),
      ...rating?.reasons
        .filter((reason) => [
          'precision_one_shot', 'precision_two_shots', 'fast_kill', 'headshot', 'clutch_kill',
        ].includes(reason.code))
        .slice(0, 3)
        .map(scoreReasonLabel) ?? [],
    ].filter(Boolean).join(' · ');
    return {
      preset: hudPreset.value,
      presentation: Boolean(activeDeath),
      mapName: demoInfo.value?.mapName ?? '',
      roundLabel: roundLabel(death.roundId),
      timeLabel: formatEventTime(hudDemoTimeMs.value),
      phaseLabel: hudPhaseLabel.value,
      killer: playerLabel(death.killerPlayerId, death.demoTimeMs, death.killerSlot),
      victim: playerLabel(death.victimPlayerId, death.demoTimeMs, death.victimSlot),
      weapon: weaponLabel(death.weapon),
      weaponSummary,
      score: rating?.score ?? '–',
      headshot: death.headshot,
      fragLanded: Boolean(activeDeath) && hudFragLanded.value,
      exiting: Boolean(activeDeath) && hudEventExiting.value,
      terroristsAlive: death.aliveBefore.terrorists.value ?? '–',
      counterTerroristsAlive: death.aliveBefore.counterTerrorists.value ?? '–',
      reasons: reasons.map((entry) => ({ ...entry, label: scoreReasonLabel(entry) })),
      killfeed: currentMovieKillfeed(),
      timelinePercent: activeDeath ? hudTimelinePercent.value : 100,
      crosshair: customCrosshairVisible.value,
      crosshairStyle: nativeCrosshairStyle.value,
      scope: nativeScopeVisible.value,
    };
  };

  const startMovieRecorderIfReady = async () => {
    if (movieExportState.value !== 'starting'
      || movieRecorderStarting
      || launching.value
      || seeking.value
      || !engineStarted.value
      || !engineCanvas.value
      || !preparedMovieOutput) return;
    if (!MovieRecorder.sourceHasVisibleFrame(engineCanvas.value)) {
      if (!movieCaptureWaitStartedAt) movieCaptureWaitStartedAt = performance.now();
      if (performance.now() - movieCaptureWaitStartedAt > 8_000) {
        movieExportError.value = 'The game frame could not be read from the WebGL renderer; export stopped.';
        recordMovieExportDiagnostic('canvas-timeout', movieExportError.value, true);
        void cancelMovieExport(true);
      }
      return;
    }
    movieRecorderStarting = true;
    const frozenMovieStartMs = hudDemoTimeMs.value;
    let recorderStartPausedEngine = false;
    try {
      const audio = DemoEngine.createAudioCapture();
      if (!audio) {
        throw new Error(
          'Game audio is not ready. Start playback and try exporting again.',
        );
      }
      // Encoder probing and an optional intro can take real wall-clock time.
      // Freeze the demo for all recorder starts so the first preroll, HUD
      // clock and automatic scoreboard begin on the exact same game frame.
      DemoEngine.execute('sys_timescale 0');
      recorderStartPausedEngine = true;
      movieRecorder = new MovieRecorder({
        sourceCanvas: engineCanvas.value,
        quality: movieQuality.value,
        output: preparedMovieOutput,
        audio,
        captureMode: movieCaptureMode,
        intro: movieIncludeIntro.value ? movieIntroCard.value : undefined,
        hudFrame: currentMovieHudFrame,
        onBytes: (bytes) => { movieExportBytes.value = bytes; },
        onError: (error) => {
          movieExportError.value = error.message;
          recordMovieExportDiagnostic('encoder-error', error.stack ?? error.message, true);
          void cancelMovieExport(true);
        },
        onEncoderMode: (mode) => {
          const message = mode === 'hardware'
            ? 'WebCodecs H.264: hardware encoder verified.'
            : mode === 'software'
              ? 'WebCodecs H.264: hardware mode rejected, software fallback verified.'
              : 'WebCodecs H.264: browser selected an encoder automatically.';
          addLog(message, false);
          recordMovieExportDiagnostic('encoder-selected', message);
        },
      });
      await movieRecorder.start();
      if (recorderStartPausedEngine) {
        DemoEngine.execute('sys_timescale 1');
        recorderStartPausedEngine = false;
      }
      hudPlaybackStartMs.value = frozenMovieStartMs;
      hudPlaybackStartedAt.value = performance.now();
      movieCaptureWaitStartedAt = 0;
      movieEncoderLastProgressAt = performance.now();
      movieEncoderLastEncodedFrames = movieRecorder.encodedFrames;
      movieExportState.value = 'recording';
      recordMovieExportDiagnostic('recording-started', 'Video and audio encoders started.');
      addLog(
        `HQ export started: ${movieQuality.value.label}, ${movieCaptureMode === 'direct' ? 'direct GPU capture' : 'composited HUD'}${audio ? ' with game audio' : ' without game audio'}.`,
        !audio,
      );
    } catch (error) {
      movieExportError.value = error instanceof Error ? error.message : 'Could not start the movie export.';
      recordMovieExportDiagnostic(
        'start-error',
        error instanceof Error ? error.stack ?? error.message : String(error),
        true,
      );
      void cancelMovieExport(true);
    } finally {
      if (recorderStartPausedEngine && DemoEngine.running) {
        try {
          DemoEngine.execute('sys_timescale 1');
        } catch {
          // The engine may already be shutting down after a start failure.
        }
      }
      movieRecorderStarting = false;
    }
  };

  const pauseMovieForEncoder = (now: number) => {
    const recorder = movieRecorder;
    if (!recorder || movieEncoderCatchingUp.value || seeking.value) return;
    const frozenDemoTimeMs = hudDemoTimeMs.value;
    try {
      DemoEngine.execute('sys_timescale 0');
    } catch (error) {
      movieExportError.value = error instanceof Error
        ? error.message
        : 'Could not pause playback while the video encoder caught up.';
      void cancelMovieExport(true);
      return;
    }
    recorder.pause();
    hudPlaybackStartMs.value = frozenDemoTimeMs;
    hudPlaybackStartedAt.value = 0;
    movieEncoderCatchingUp.value = true;
    movieEncoderLastProgressAt = now;
    movieEncoderLastEncodedFrames = recorder.encodedFrames;
    addLog(`Video encoder catching up (${recorder.encodingBacklogFrames} queued frames).`, false);
    recordMovieExportDiagnostic(
      'backpressure-pause',
      `Playback paused with ${recorder.encodingBacklogFrames} frames in the encoder queue.`,
    );
  };

  const resumeMovieAfterEncoderCatchup = (now: number) => {
    const recorder = movieRecorder;
    if (!recorder || !movieEncoderCatchingUp.value) return;
    try {
      DemoEngine.execute(`sys_timescale ${movieAutomaticScoreboardVisible ? 0 : 1}`);
    } catch (error) {
      movieExportError.value = error instanceof Error
        ? error.message
        : 'Could not resume playback after the encoder pause.';
      void cancelMovieExport(true);
      return;
    }
    recorder.resume();
    hudPlaybackStartedAt.value = movieAutomaticScoreboardVisible ? 0 : now;
    movieEncoderCatchingUp.value = false;
    movieEncoderLastProgressAt = now;
    movieEncoderLastEncodedFrames = recorder.encodedFrames;
    addLog('Video encoder caught up; export continues.', false);
    recordMovieExportDiagnostic('backpressure-resume', 'The encoder queue drained and playback resumed.');
  };

  const updateMovieExportProgress = () => {
    if (movieExportState.value !== 'recording') return;
    const recorder = movieRecorder;
    if (!recorder) return;
    movieRenderFps.value = recorder.recentFramesPerSecond;
    const now = performance.now();
    const encodingBacklog = recorder.encodingBacklogFrames;
    if (recorder.encodedFrames !== movieEncoderLastEncodedFrames) {
      movieEncoderLastEncodedFrames = recorder.encodedFrames;
      movieEncoderLastProgressAt = now;
    }
    if (movieEncoderCatchingUp.value
      && encodingBacklog > 0
      && now - movieEncoderLastProgressAt > 60_000) {
      movieExportError.value = 'The video encoder did not produce a single frame within 60 seconds.';
      void cancelMovieExport(true);
      return;
    }
    if (!seeking.value && !fragReelSeeking.value) {
      const backpressure = movieBackpressureAction(
        encodingBacklog,
        movieQuality.value.fps,
        movieEncoderCatchingUp.value,
      );
      if (backpressure === 'pause') pauseMovieForEncoder(now);
      else if (backpressure === 'resume') resumeMovieAfterEncoderCatchup(now);
    }
    const death = activeFragReelDeaths.value[fragReelIndex.value];
    const timeline = fragMovieTimeline.value;
    if (!death || timeline.durationMs <= 0) return;
    const clipIndex = timeline.clips.findIndex((clip) => clip.eventIds.includes(death.eventId));
    if (clipIndex < 0) return;
    const elapsedBefore = timeline.clips.slice(0, clipIndex).reduce(
      (total, clip) => total + clip.endTimeMs - clip.startTimeMs,
      0,
    );
    const clip = timeline.clips[clipIndex];
    const elapsedWithin = Math.max(0, Math.min(
      clip.endTimeMs - clip.startTimeMs,
      hudDemoTimeMs.value - clip.startTimeMs,
    ));
    movieExportProgress.value = Math.min(
      99.5,
      (elapsedBefore + elapsedWithin) / timeline.durationMs * 100,
    );
    const progressBucket = Math.floor(movieExportProgress.value / 10);
    if (progressBucket > movieLastDiagnosticProgressBucket) {
      movieLastDiagnosticProgressBucket = progressBucket;
      recordMovieExportDiagnostic(
        'progress',
        `Export reached ${Math.round(movieExportProgress.value)} percent.`,
      );
    }
  };

  const tickHudClock = (now: number) => {
    hudNow.value = now;
    void startMovieRecorderIfReady();
    if (!updateMovieAutomaticScoreboard(now)) updateFragReel();
    updateMovieExportProgress();
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
      case 'reading': return 'Reading the demo in the background';
      case 'hashing': return 'Verifying demo identity';
      case 'cache': return 'Searching the local index';
      case 'parsing': return 'Decoding demo packets';
      case 'indexing': return 'Normalizing match events';
      case 'saving': return 'Saving the demo index locally';
      default: return 'Starting the analysis worker';
    }
  });
  const analysisProgressDetail = computed(() => {
    const progress = analysisProgress.value;
    if (!progress) return 'Preparing analysis without blocking the interface…';
    if (progress.phase === 'reading' && progress.current !== null && progress.total !== null) {
      return `${formatBytes(progress.current)} of ${formatBytes(progress.total)}`;
    }
    if (progress.phase === 'parsing') {
      const segment = progress.directoryEntry === undefined
        ? ''
        : `Section ${progress.directoryEntry + 1} of ${progress.directoryCount ?? '–'}`;
      const time = progress.demoTimeMs === undefined
        ? ''
        : ` · demo time ${formatEventTime(progress.demoTimeMs)}`;
      return `${segment}${time}` || 'Reading protocol messages…';
    }
    if (progress.phase === 'indexing' && progress.current !== null && progress.total !== null) {
      return `${formatNumber(progress.current)} of ${formatNumber(progress.total)} analysis frames`;
    }
    if (progress.phase === 'hashing') return 'Calculating SHA-256 for the cache identity…';
    if (progress.phase === 'cache') return 'Checking IndexedDB…';
    if (progress.phase === 'saving') return 'The index will be available after the next reload…';
    return 'Analyzing the demo locally…';
  });

  const analyzeSelectedDemo = async (selectedDemo: GoldSrcDemo, source: DemoSource) => {
    activeAnalysisRun?.cancel();
    const request = ++analysisRequest;
    analysisLoading.value = true;
    analysisError.value = '';
    analysisIndex.value = undefined;
    activeScoringMapBuffer = undefined;
    verifiedWallbangEventIds.value = new Set();
    analysisBuffer.value = undefined;
    analysisCacheHit.value = false;
    analysisProgress.value = undefined;
    selectedFragId.value = '';
    expandedFragScoreId.value = '';
    fragPlayer.value = 'all';
    highlightTeam.value = 'all';
    fragReelSource.value = 'playback';
    movieExcludedFragIds.value = new Set();
    const run = analyzeDemoInWorker(selectedDemo, source, (progress) => {
      if (request === analysisRequest) analysisProgress.value = progress;
    });
    activeAnalysisRun = run;
    try {
      const { buffer, index, cacheHit } = await run.promise;
      if (request !== analysisRequest) return;
      analysisBuffer.value = buffer;
      analysisIndex.value = index;
      refreshVerifiedWallbangs();
      analysisCacheHit.value = cacheHit;
    } catch (error) {
      if (request !== analysisRequest) return;
      analysisError.value = error instanceof Error
        ? error.message
        : 'Could not analyze the demo.';
    } finally {
      if (activeAnalysisRun === run) activeAnalysisRun = undefined;
      if (request === analysisRequest) {
        analysisLoading.value = false;
        analysisProgress.value = undefined;
      }
    }
  };

  const loadDemoCatalog = async () => {
    catalogLoading.value = true;
    catalogError.value = '';
    try {
      const response = await fetch('/demo-index.json');
      if (!response.ok) throw new Error(`Demo catalog could not be loaded (${response.status}).`);
      demoCatalog.value = await response.json() as DemoCatalog;
    } catch (error) {
      catalogError.value = error instanceof Error ? error.message : 'Demo catalog could not be loaded.';
    } finally {
      catalogLoading.value = false;
    }
  };

  const loadArchiveDemo = async (entry: DemoCatalogEntry) => {
    if (entry.status === 'error' || archiveSelectionPath.value) return;
    if (engineStarted.value || engineVisible.value || DemoEngine.running) closeEngine();
    activeAnalysisRun?.cancel();
    analysisRequest += 1;
    archiveSelectionPath.value = entry.path;
    loadedDemoPath.value = entry.path;
    demoLoading.value = true;
    demoError.value = '';
    analysisLoading.value = true;
    analysisError.value = '';
    analysisProgress.value = undefined;
    analysisBuffer.value = undefined;
    analysisIndex.value = undefined;
    analysisCacheHit.value = false;
    activeScoringMapBuffer = undefined;
    verifiedWallbangEventIds.value = new Set();
    mapChecksumMatches.value = false;
    gameFiles.value = [];
    selectedFragId.value = '';
    expandedFragScoreId.value = '';
    fragPlayer.value = 'all';
    highlightTeam.value = 'all';
    fragReelSource.value = 'playback';
    movieExcludedFragIds.value = new Set();

    const demoUrl = demoCatalogAssetUrl('/demo-files', entry.path);
    const analysisUrl = demoCatalogAssetUrl('/demo-analysis', `${entry.path}.json`);
    try {
      const [inspected, analysisResponse] = await Promise.all([
        inspectDemoUrl(entry.filename, demoUrl),
        fetch(analysisUrl),
      ]);
      if (!analysisResponse.ok) {
        throw new Error(`Stored demo analysis could not be loaded (${analysisResponse.status}).`);
      }
      const stored = await analysisResponse.json() as DemoAnalysisIndex & { error?: string };
      if (stored.error) throw new Error(stored.error);
      demoInfo.value = inspected;
      demoSource.value = { kind: 'url', name: entry.filename, url: demoUrl };
      analysisIndex.value = stored;
      analysisCacheHit.value = true;
      await loadInstalledGameAssets(inspected);
    } catch (error) {
      demoInfo.value = undefined;
      analysisIndex.value = undefined;
      demoError.value = error instanceof Error ? error.message : 'Could not open the archived demo.';
    } finally {
      demoLoading.value = false;
      analysisLoading.value = false;
      archiveSelectionPath.value = '';
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
      loadedDemoPath.value = '';
      void analyzeSelectedDemo(inspected, demoSource.value);
      await loadInstalledGameAssets(inspected);
    } catch (error) {
      demoInfo.value = undefined;
      demoError.value = error instanceof Error ? error.message : 'Could not read the demo.';
    } finally {
      demoLoading.value = false;
    }
  };

  const entryBuffer = async (entry: GameAssetEntry): Promise<ArrayBuffer> => {
    if ('file' in entry) return entry.file.arrayBuffer();
    const response = await fetch(entry.url);
    if (!response.ok) throw new Error(`Could not read ${entry.path}.`);
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
      gameError.value = 'The folder does not contain any files.';
      return;
    }

    const normalized = files.map((entry) => entry.path.toLowerCase().replace(/\\/g, '/'));
    const hasValve = normalized.some((path) => path.includes('/valve/'));
    const hasCstrike = normalized.some((path) => path.includes('/cstrike/'));
    if (!hasValve || !hasCstrike) {
      gameFiles.value = files;
      gameError.value = 'Select the root folder containing both valve/ and cstrike/.';
      return;
    }

    if (!selectedDemo) {
      gameFiles.value = files;
      gameError.value = 'Select a demo before checking the map version.';
      return;
    }

    const mapSuffix = `/${selectedDemo.mapName.toLowerCase()}.bsp`;
    const candidates = files.filter((_, index) => normalized[index].endsWith(mapSuffix));
    if (!candidates.length) {
      gameFiles.value = files;
      gameError.value = `${selectedDemo.mapName}.bsp is missing.`;
      return;
    }

    let exactMap: GameAssetEntry | undefined;
    let exactMapBuffer: ArrayBuffer | undefined;
    if (selectedDemo.mapChecksum === 0) {
      // Early demos commonly leave the header CRC at 00000000.  In that case
      // there is no recorded revision to compare against, so use the installed
      // map rather than treating zero as a real checksum.
      exactMap = candidates[0];
      exactMapBuffer = await entryBuffer(exactMap);
    } else {
      for (const candidate of candidates) {
        try {
          const buffer = await entryBuffer(candidate);
          if (goldSrcMapChecksum(buffer) === selectedDemo.mapChecksum) {
            exactMap = candidate;
            exactMapBuffer = buffer;
            break;
          }
        } catch {
          // Continue through any other historical variants in the selected root.
        }
      }
    }

    if (!exactMap) {
      gameFiles.value = files;
      gameError.value = `${selectedDemo.mapName}.bsp was found, but not version ${formatGoldSrcChecksum(selectedDemo.mapChecksum)}.`;
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
    activeScoringMapBuffer = exactMapBuffer;
    refreshVerifiedWallbangs();
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

  const recordMovieExportDiagnostic = (
    event: string,
    message: string,
    isError = false,
  ) => {
    const recorder = movieRecorder;
    const entry: MovieExportDiagnostic = {
      at: new Date().toISOString(),
      event,
      message,
      filename: preparedMovieOutput?.filename ?? '',
      quality: movieQuality.value.label,
      progressPercent: Number(movieExportProgress.value.toFixed(2)),
      bytesWritten: recorder?.bytesWritten ?? movieExportBytes.value,
      capturedFrames: recorder?.capturedFrames ?? 0,
      encodedFrames: recorder?.encodedFrames ?? 0,
      backlogFrames: recorder?.encodingBacklogFrames ?? 0,
      pageVisible: !document.hidden,
    };
    movieExportDiagnostics.value.push(entry);
    if (movieExportDiagnostics.value.length > 100) movieExportDiagnostics.value.shift();
    try {
      window.localStorage.setItem(
        MOVIE_EXPORT_DIAGNOSTICS_KEY,
        JSON.stringify(movieExportDiagnostics.value),
      );
    } catch {
      // Diagnostics must never interrupt an export if storage is unavailable.
    }
    const consoleMethod = isError ? console.error : console.info;
    consoleMethod(`[HQ-export:${event}] ${message}`, entry);
  };

  const downloadMovieExportDiagnostics = () => {
    const blob = new Blob([
      JSON.stringify(movieExportDiagnostics.value, null, 2),
    ], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `praxxa-hltv-player-export-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const launchDemo = async (
    startAtMs = 0,
    reconstructionCamera?: DemoEngineOptions['reconstructionCamera'],
  ) => {
    const selectedDemo = demoInfo.value;
    if (!canLaunch.value || !selectedDemo || !demoSource.value) return;
    launching.value = true;
    engineVisible.value = true;
    engineStarted.value = false;
    logs.value = [];
    loadingProgress.value = 0;
    seeking.value = startAtMs > 0;
    nativeFov.value = 90;
    nativeWeaponId.value = 0;
    await nextTick();

    try {
      if (!engineCanvas.value) throw new Error('Could not create the WebGL canvas.');
      await DemoEngine.start({
        canvas: engineCanvas.value,
        gameFiles: gameFiles.value,
        demoSource: demoSource.value,
        demoBuffer: analysisBuffer.value,
        compatibilityProfile: selectedDemo.compatibilityProfile,
        // Header inspection deliberately leaves this unknown until the packet
        // analysis has seen svc_hltv/svc_director. Use that authoritative
        // result when launching; otherwise HLTV demos are started as POV and
        // their recorded overview camera can sit outside the BSP world.
        isHltv: analysisIndex.value?.demo.isHltv ?? selectedDemo.isHltv,
        captureFrames: movieExportRunning.value,
        renderSize: movieExportRunning.value ? {
          width: movieQuality.value.width,
          height: movieQuality.value.height,
        } : undefined,
        startAtMs,
        reconstructionCamera,
        onSeekStateChange: (value) => {
          seeking.value = value;
          if (!value) {
            hudPlaybackStartedAt.value = performance.now();
            applyEngineHudPreset();
          }
        },
        onNativeFovChange: (value) => { nativeFov.value = value; },
        onNativeWeaponChange: (value) => { nativeWeaponId.value = value; },
        onLog: addLog,
        onProgress: ({ current }) => { loadingProgress.value = current; },
      });
      engineStarted.value = true;
      if (startAtMs === 0) hudPlaybackStartedAt.value = performance.now();
      applyEngineHudPreset();
      engineCanvas.value.focus();
      addLog('Xash3D and the original Counter-Strike client are running.', false);
    } catch (error) {
      fragReelActive.value = false;
      fragReelSeeking.value = false;
      const message = error instanceof Error ? error.message : 'The engine could not start.';
      addLog(message, true);
      consoleOpen.value = true;
      if (movieExportRunning.value) {
        movieExportError.value = message;
        void cancelMovieExport(true);
      }
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
    // A DeathMsg always carries the killer slot. In an HLTV demo we can ask the
    // native spectator to follow that slot even when the exact frag packet did
    // not contain a complete position/angle snapshot.
    const nativeHltv = analysisIndex.value?.demo.perspective.kind === 'hltv';
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
      label: `${killerLabel} vs ${victimLabel}`,
      activateAfterMs: nativeHltv
        ? Math.max(250, death.demoTimeMs - startAtMs - 500)
        : Math.max(250, death.demoTimeMs - startAtMs - 1_250),
      durationMs: 5_000,
    };
  };

  // DemoEngine.start() kastar "The engine is already running." om motorn lever.
  // launchDemo stänger den inte själv, och den får inte göra det heller:
  // closeEngine() nollställer fragReelActive, som playFragReel sätter strax
  // innan. Därför stängs motorn först i varje anropare, före tillståndet sätts.
  const stopEngineBeforeLaunch = () => {
    if (engineStarted.value || engineVisible.value || DemoEngine.running) closeEngine();
  };

  const playFrag = (death: DeathEvent) => {
    stopEngineBeforeLaunch();
    fragReelActive.value = false;
    selectedFragId.value = death.eventId;
    const startAtMs = Math.max(0, death.demoTimeMs - 3_000);
    hudPlaybackStartMs.value = startAtMs;
    void launchDemo(startAtMs, killerCameraFor(death, startAtMs));
  };

  const playMatch = () => {
    stopEngineBeforeLaunch();
    fragReelActive.value = false;
    hudPlaybackStartMs.value = 0;
    void launchDemo();
  };

  const playFragReel = (source: 'playback' | 'movie' = 'playback') => {
    fragReelSource.value = source;
    const first = activeFragReelDeaths.value[0];
    const canStart = source === 'movie' ? canStartMovieExport.value : canStartFragReel.value;
    if (!canStart || !first) return;
    // Före flaggorna sätts: closeEngine() skulle annars slå av rullen direkt.
    stopEngineBeforeLaunch();
    fragReelActive.value = true;
    fragReelSeeking.value = false;
    fragReelIndex.value = 0;
    movieScoreboardsShown.clear();
    movieScoreboardStartFrame = 0;
    setMovieAutomaticScoreboard(false);
    selectedFragId.value = first.eventId;
    const startAtMs = Math.max(0, first.demoTimeMs - FRAG_REEL_PREROLL_MS);
    hudPlaybackStartMs.value = startAtMs;
    const camera = killerCameraFor(first, startAtMs);
    if (camera?.nativeHltv) camera.activateAfterMs = 0;
    void launchDemo(startAtMs, camera);
  };

  const exportFragMovie = async () => {
    if (!canStartMovieExport.value || movieExportRunning.value || !demoSource.value) return;
    movieExportError.value = '';
    movieExportNotice.value = '';
    movieExportBytes.value = 0;
    movieExportProgress.value = 0;
    movieRenderFps.value = 0;
    movieEncoderCatchingUp.value = false;
    movieCaptureWaitStartedAt = 0;
    movieEncoderLastProgressAt = 0;
    movieEncoderLastEncodedFrames = 0;
    movieLastDiagnosticProgressBucket = -1;
    movieCaptureMode = hudPreset.value === 'original' || hudPreset.value === 'clean'
      ? 'direct'
      : 'composited';
    movieExportState.value = 'starting';
    recordMovieExportDiagnostic(
      'requested',
      `Export requested in ${movieQuality.value.label}${movieIncludeIntro.value ? ' with match intro' : ' without intro'}.`,
    );
    const temporaryName = safeMovieFilename(
      demoSource.value.name,
      fragReelTeamShortLabel.value,
      'tmp',
    );
    try {
      preparedMovieOutput = await prepareMovieOutput(temporaryName.replace(/\.tmp$/, ''));
      movieExportNotice.value = `Exporting directly to ${preparedMovieOutput.filename}.`;
      recordMovieExportDiagnostic('output-prepared', movieExportNotice.value);
      playFragReel('movie');
    } catch (error) {
      movieExportState.value = 'idle';
      if (error instanceof DOMException && error.name === 'AbortError') {
        movieExportNotice.value = 'The export was cancelled before it started.';
        return;
      }
      movieExportError.value = error instanceof Error
        ? error.message
        : 'Could not prepare the video file.';
      recordMovieExportDiagnostic(
        'prepare-error',
        error instanceof Error ? error.stack ?? error.message : String(error),
        true,
      );
    }
  };

  const finishMovieExport = async () => {
    const recorder = movieRecorder;
    if (!recorder || movieExportState.value === 'finalizing') return;
    setMovieAutomaticScoreboard(false);
    movieScoreboardStartFrame = 0;
    movieExportState.value = 'finalizing';
    movieExportProgress.value = 100;
    movieEncoderCatchingUp.value = false;
    try {
      await recorder.stop();
      if (recorder.encodedFrames !== recorder.capturedFrames) {
        throw new Error(
          `The video encoder dropped ${recorder.capturedFrames - recorder.encodedFrames} frames; the file was rejected.`,
        );
      }
      if (recorder.bytesWritten <= 0) {
        throw new Error('The video encoder finished without creating any data.');
      }
      const minimumPlausibleBytes = movieEstimatedBytes.value * 0.005;
      if (recorder.bytesWritten < minimumPlausibleBytes) {
        throw new Error(
          `The video file was implausibly small (${formatBytes(recorder.bytesWritten)}); `
          + 'the game frames were probably not encoded correctly.',
        );
      }
      const filename = preparedMovieOutput?.filename ?? 'only-frags-video';
      movieExportNotice.value = `${filename} is complete and saved.`;
      recordMovieExportDiagnostic('completed', movieExportNotice.value);
      movieExportState.value = 'complete';
      movieRecorder = undefined;
      preparedMovieOutput = undefined;
      closeEngine();
    } catch (error) {
      movieExportError.value = error instanceof Error
        ? error.message
        : 'Could not finalize the video file.';
      if (recorder.fileFinalized && recorder.bytesWritten > 0) {
        movieExportNotice.value = `${preparedMovieOutput?.filename ?? 'The video file'} was closed correctly and contains everything up to the error.`;
      }
      recordMovieExportDiagnostic(
        'finalize-error',
        error instanceof Error ? error.stack ?? error.message : String(error),
        true,
      );
      movieExportState.value = 'error';
      movieRecorder = undefined;
      preparedMovieOutput = undefined;
      closeEngine();
    }
  };

  const cancelMovieExport = async (keepError = false) => {
    const recorder = movieRecorder;
    const output = preparedMovieOutput;
    setMovieAutomaticScoreboard(false);
    movieScoreboardStartFrame = 0;
    recordMovieExportDiagnostic(
      keepError ? 'error-stop-requested' : 'user-stop-requested',
      keepError ? movieExportError.value || 'The export stopped after an unknown error.' : 'The user stopped the export.',
      keepError,
    );
    if (DemoEngine.running) {
      try {
        DemoEngine.execute('sys_timescale 1');
      } catch {
        // The engine may already be shutting down.
      }
    }
    movieEncoderCatchingUp.value = false;
    let partialSaved = false;
    if (recorder) {
      movieExportState.value = 'finalizing';
      try {
        await recorder.stop();
        partialSaved = recorder.bytesWritten > 0;
      } catch (error) {
        if (recorder.fileFinalized) {
          partialSaved = recorder.bytesWritten > 0;
          recordMovieExportDiagnostic(
            'partial-file-finalized',
            error instanceof Error ? error.stack ?? error.message : String(error),
            true,
          );
        } else {
          recordMovieExportDiagnostic(
            'partial-file-failed',
            error instanceof Error ? error.stack ?? error.message : String(error),
            true,
          );
          await recorder.cancel();
        }
      }
    } else {
      await output?.writer?.abort('The export was cancelled before the encoder started.').catch(() => undefined);
    }
    movieRecorder = undefined;
    preparedMovieOutput = undefined;
    movieExportState.value = keepError ? 'error' : 'idle';
    if (partialSaved) {
      movieExportNotice.value = `${output?.filename ?? 'The video file'} was saved as a playable partial movie up to the interruption.`;
    } else if (!keepError) {
      movieExportNotice.value = 'The movie export was cancelled before any video data was created.';
    }
    if (keepError) {
      fragReelActive.value = false;
      fragReelSeeking.value = false;
    } else {
      closeEngine();
    }
  };

  const focusFragReelDeath = (death: DeathEvent | undefined) => {
    setMovieAutomaticScoreboard(false);
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
    if (movieExportRunning.value) {
      void cancelMovieExport();
      return;
    }
    fragReelActive.value = false;
    fragReelSeeking.value = false;
    addLog('Only Frags ended; regular playback continues.', false);
    engineCanvas.value?.focus();
  };

  const updateFragReel = () => {
    if (!fragReelActive.value
      || fragReelSeeking.value
      || movieRecorderStarting
      || launching.value
      || seeking.value
      || !engineStarted.value) return;

    const action = nextFragReelAction(
      activeFragReelDeaths.value,
      fragReelIndex.value,
      hudDemoTimeMs.value,
    );
    if (action.type === 'wait') return;
    if (startMovieAutomaticScoreboard()) return;
    if (action.type === 'complete') {
      addLog(`Only Frags complete: ${activeFragReelDeaths.value.length} frags shown.`, false);
      const completion = movieCompletionAction(movieExportState.value);
      if (completion === 'finish') {
        void finishMovieExport();
        return;
      }
      // stop() is asynchronous. While MP4 metadata and queued chunks are being
      // committed, the HUD clock keeps ticking and reaches this branch again.
      // Never turn that normal finalization into a destructive cancellation.
      if (completion === 'wait') return;
      if (completion === 'fail') {
        movieExportError.value = 'The movie recorder did not have time to start.';
        void cancelMovieExport(true);
        return;
      }
      closeEngine();
      return;
    }

    fragReelIndex.value = action.index;
    const next = activeFragReelDeaths.value[action.index];
    if (next) selectedFragId.value = next.eventId;
    if (action.type === 'advance') {
      focusFragReelDeath(next);
      return;
    }

    fragReelSeeking.value = true;
    seeking.value = true;
    setMovieAutomaticScoreboard(false);
    movieRecorder?.pause();
    addLog(`Only Frags: seeking to ${formatEventTime(action.targetMs)}.`, false);
    void DemoEngine.seekTo(action.targetMs, action.targetMs < hudDemoTimeMs.value)
      .then(() => {
        hudPlaybackStartMs.value = action.targetMs;
        hudPlaybackStartedAt.value = performance.now();
        seeking.value = false;
        fragReelSeeking.value = false;
        focusFragReelDeath(next);
        applyEngineHudPreset();
        movieRecorder?.resume();
        engineCanvas.value?.focus();
      })
      .catch((error) => {
        fragReelActive.value = false;
        seeking.value = false;
        fragReelSeeking.value = false;
        addLog(error instanceof Error ? error.message : 'Could not seek to the next frag.', true);
        if (movieExportRunning.value) {
          movieExportError.value = error instanceof Error
            ? error.message
            : 'The movie export could not seek to the next frag.';
          void cancelMovieExport(true);
        }
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
    movieAutomaticScoreboardVisible = false;
    movieScoreboardStartFrame = 0;
    movieScoreboardsShown.clear();
    fragReelActive.value = false;
    fragReelSeeking.value = false;
    engineVisible.value = false;
    launching.value = false;
    DemoEngine.stop();
    engineStarted.value = false;
    seeking.value = false;
    hudPlaybackStartedAt.value = 0;
    movieEncoderCatchingUp.value = false;
    nativeFov.value = 90;
    nativeWeaponId.value = 0;
  }

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
    if (message.includes('not valid for pointer lock')) return;
    addLog(`Laddningsfel: ${message}`, true);
    if (movieExportRunning.value) {
      recordMovieExportDiagnostic(
        'unhandled-rejection',
        event.reason instanceof Error ? event.reason.stack ?? message : message,
        true,
      );
    }
  };

  const onWindowError = (event: ErrorEvent) => {
    if (!movieExportRunning.value) return;
    recordMovieExportDiagnostic(
      'window-error',
      event.error instanceof Error ? event.error.stack ?? event.message : event.message,
      true,
    );
  };

  const stopExportWhenTabIsHidden = () => {
    if (!document.hidden || !['starting', 'recording'].includes(movieExportState.value)) return;
    movieExportError.value = 'The export stopped because the browser tab was left. Any partial movie will be saved.';
    void cancelMovieExport(true);
  };

  onMounted(() => {
    try {
      const savedDiagnostics = JSON.parse(
        window.localStorage.getItem(MOVIE_EXPORT_DIAGNOSTICS_KEY) ?? '[]',
      ) as unknown;
      if (Array.isArray(savedDiagnostics)) {
        movieExportDiagnostics.value = savedDiagnostics.slice(-100) as MovieExportDiagnostic[];
      }
    } catch {
      // Ignore an invalid or unavailable diagnostics cache.
    }
    const savedHud = window.localStorage.getItem('replay-lab-hud-preset');
    if (hudPresets.some((preset) => preset.id === savedHud)) hudPreset.value = savedHud as HudPreset;
    const savedMovieIntro = window.localStorage.getItem(MOVIE_INTRO_PREFERENCE_KEY);
    if (savedMovieIntro === 'true' || savedMovieIntro === 'false') {
      movieIncludeIntro.value = savedMovieIntro === 'true';
    }
    hudClockFrame = window.requestAnimationFrame(tickHudClock);
    // Ingen demo laddas vid start om adressen inte pekar ut en. Katalogen
    // måste finnas först, eftersom en delad länk slås upp mot den.
    const initialRoute = parseReplayRoute(window.location.href);
    void loadDemoCatalog().then(() => {
      if (initialRoute.demoPath) void applyReplayRoute(initialRoute);
    });
    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', showScoreboard, true);
    window.addEventListener('keyup', hideScoreboard, true);
    window.addEventListener('blur', hideScoreboardOnBlur);
    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    document.addEventListener('visibilitychange', stopExportWhenTabIsHidden);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('popstate', onPopState);
    activeAnalysisRun?.cancel();
    window.cancelAnimationFrame(hudClockFrame);
    if (movieRecorder) void movieRecorder.cancel();
    else if (preparedMovieOutput?.writer) {
      void preparedMovieOutput.writer.abort('The page was closed during export.').catch(() => undefined);
    }
    DemoEngine.stop();
    window.removeEventListener('keydown', showScoreboard, true);
    window.removeEventListener('keyup', hideScoreboard, true);
    window.removeEventListener('blur', hideScoreboardOnBlur);
    window.removeEventListener('error', onWindowError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    document.removeEventListener('visibilitychange', stopExportWhenTabIsHidden);
  });
</script>
