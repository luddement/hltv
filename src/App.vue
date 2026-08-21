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

          <div v-if="demoCatalog" class="archive-stat-sections">
            <section class="archive-stat-panel archive-total-stats">
              <header><b>Total</b><span>Hela demoarkivet</span></header>
              <div class="archive-stat-content">
                <div class="stat-big">
                  <strong>{{ archiveTotals.days }}</strong><span>dygn inspelat</span>
                  <small>{{ archiveTotals.hours }} tim {{ archiveTotals.minutes }} min · {{ archiveTotals.span }}</small>
                </div>
                <div class="stat-row">
                  <div><strong>{{ formatNumber(archiveTotals.frags) }}</strong><span>frags</span></div>
                  <div><strong>{{ formatNumber(archiveTotals.rounds) }}</strong><span>ronder</span></div>
                  <div><strong>{{ formatNumber(archiveTotals.demos) }}</strong><span>demos</span></div>
                  <div><strong>{{ archiveTotals.maps }}</strong><span>kartor</span></div>
                </div>
              </div>
            </section>
            <section v-if="crewIndex" class="archive-stat-panel archive-crew-stats">
              <header><b>PRAXXA</b><span>Endast identifierade PRAXXA-medlemmar</span></header>
              <div class="stat-row">
                <div><strong>{{ formatNumber(crewTotals.frags) }}</strong><span>frags</span></div>
                <div><strong>{{ formatNumber(crewTotals.deaths) }}</strong><span>deaths</span></div>
                <div><strong>{{ formatNumber(crewTotals.headshots) }}</strong><span>headshots</span></div>
                <div class="achievement-stat"><strong>{{ formatNumber(crewTotals.aces) }}</strong><span>ace</span></div>
                <div class="achievement-stat"><strong>{{ formatNumber(crewTotals.zeroTwelveGames) }}</strong><span>0–12</span></div>
                <div><strong>{{ crewIndex.members.length }}</strong><span>medlemmar</span></div>
              </div>
            </section>
          </div>

          <div v-if="latestComments.length" class="latest-comments">
            <div class="crew-board-head">
              <span>Senaste kommentarerna</span>
              <small>klicka för att öppna demot</small>
            </div>
            <ol>
              <li v-for="row in latestComments" :key="row.comment.id">
                <a :href="buildReplayRoute({ ...EMPTY_REPLAY_ROUTE, demoPath: row.demoPath })"
                   @click.prevent="openArchiveDemoByPath(row.demoPath)">
                  <span class="comment-who">{{ row.comment.nickname }}</span>
                  <span class="comment-body">{{ row.comment.body }}</span>
                  <span class="comment-where">{{ row.filename }} · {{ commentAge(row.comment.createdAt) }}</span>
                </a>
              </li>
            </ol>
          </div>

          <div v-if="crewIndex" class="crew-board">
            <div class="crew-board-head">
              <span>Gänget</span>
              <small>klicka för att filtrera arkivet</small>
            </div>
            <ol>
              <li
                v-for="member in crewIndex.members"
                :key="member.id"
                :class="{ active: archivePerson === member.id }"
              >
                <button type="button" @click="archivePerson = archivePerson === member.id ? 'all' : member.id">
                  <b>{{ member.name }}</b>
                  <span class="crew-frags">{{ formatNumber(member.frags) }}</span>
                  <span class="crew-meta">
                    {{ member.demos }} demos · {{ Math.round(member.seconds / 3600) }} h
                    · {{ member.headshotPercent }} % hs · K/D {{ member.ratio ?? '–' }}
                    · {{ member.aces ?? 0 }} ace · {{ member.zeroTwelveGames ?? 0 }} st 0–12
                  </span>
                </button>
              </li>
            </ol>
          </div>

          <div class="archive-filters">
            <label class="archive-person-filter">
              <span>Person</span>
              <select v-model="archivePerson">
                <option value="all">Alla</option>
                <option v-for="person in archivePeople" :key="person.id" :value="person.id">
                  {{ person.name }} · {{ person.demos }}
                </option>
              </select>
            </label>
            <label class="archive-person-filter">
              <span>Klan</span>
              <select v-model="archiveClan">
                <option value="all">Alla</option>
                <option v-for="clan in archiveClans" :key="clan.name" :value="clan.name">
                  {{ clan.name }} · {{ clan.demos }}
                </option>
              </select>
            </label>
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
          </div>

          <div v-if="catalogLoading" class="archive-state">
            <span class="spinner"></span> Loading demo catalog…
          </div>
          <p v-else-if="catalogError" class="analysis-error">{{ catalogError }}</p>
          <template v-else>
            <div class="archive-list" role="table" aria-label="Indexed demos">
              <div class="archive-row archive-row-header" role="row">
                <button
                  :class="['archive-sort-heading', { active: archiveSort === 'date-desc' || archiveSort === 'date-asc' }]"
                  type="button"
                  :aria-label="archiveSort === 'date-desc' ? 'Sort oldest first' : 'Sort newest first'"
                  :aria-pressed="archiveSort === 'date-desc' || archiveSort === 'date-asc'"
                  @click="archiveSort = archiveSort === 'date-desc' ? 'date-asc' : 'date-desc'"
                >Date <span aria-hidden="true">{{ archiveSort === 'date-asc' ? '↑' : '↓' }}</span></button>
                <span>Match</span>
                <span>Map</span>
                <button
                  :class="['archive-sort-heading', { active: archiveSort === 'frag-desc' }]"
                  type="button"
                  aria-label="Sort by highest frag score"
                  :aria-pressed="archiveSort === 'frag-desc'"
                  @click="archiveSort = 'frag-desc'"
                >Top frag <span aria-hidden="true">↓</span></button>
                <button
                  :class="['archive-sort-heading', { active: archiveSort === 'round-desc' }]"
                  type="button"
                  aria-label="Sort by highest round score"
                  :aria-pressed="archiveSort === 'round-desc'"
                  @click="archiveSort = 'round-desc'"
                >Top round <span aria-hidden="true">↓</span></button>
                <button
                  :class="['archive-sort-heading', { active: archiveSort === 'ace-desc' }]"
                  type="button"
                  aria-label="Sort by most PRAXXA aces"
                  :aria-pressed="archiveSort === 'ace-desc'"
                  @click="archiveSort = 'ace-desc'"
                >Ace <span aria-hidden="true">↓</span></button>
                <button
                  :class="['archive-sort-heading', { active: archiveSort === 'zero-twelve-desc' }]"
                  type="button"
                  aria-label="Sort by most PRAXXA 0–12 scorelines"
                  :aria-pressed="archiveSort === 'zero-twelve-desc'"
                  @click="archiveSort = 'zero-twelve-desc'"
                >0–12 <span aria-hidden="true">↓</span></button>
                <button
                  :class="['archive-sort-heading', { active: archiveSort === 'comments-desc' }]"
                  type="button"
                  aria-label="Sort by most comments"
                  :aria-pressed="archiveSort === 'comments-desc'"
                  @click="archiveSort = 'comments-desc'"
                >Comments <span aria-hidden="true">↓</span></button>
                <span></span>
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
                <span
                  :class="['archive-achievement-cell', { populated: (entry.crewAceCount ?? 0) > 0 }]"
                  :title="entry.crewAceCount
                    ? `${entry.crewAceCount} PRAXXA-ace: ${entry.crewAceMembers?.join(', ')}`
                    : 'Inga PRAXXA-ace i matchen'"
                ><b>{{ entry.crewAceCount || '–' }}</b></span>
                <span
                  :class="['archive-achievement-cell zero-twelve', { populated: (entry.crewZeroTwelveCount ?? 0) > 0 }]"
                  :title="entry.crewZeroTwelveCount
                    ? `PRAXXA 0–12: ${entry.crewZeroTwelveSides
                      ?.map((run) => `${run.member} (${run.side})`).join(', ')}`
                    : 'Ingen PRAXXA-spelare hade 12 deaths utan frag på samma sida'"
                ><b>{{ entry.crewZeroTwelveCount || '–' }}</b></span>
                <span
                  :class="['archive-comment-cell', { populated: archiveCommentsFor(entry.path).count > 0 }]"
                  :title="archiveCommentTitle(entry.path)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 4.5h14v10H9l-4 4v-14Z" />
                  </svg>
                  <b>{{ archiveCommentsFor(entry.path).count }}</b>
                  <span class="archive-comment-tooltip">
                    <strong>
                      {{ archiveCommentsFor(entry.path).count
                        ? `${archiveCommentsFor(entry.path).count} ${archiveCommentsFor(entry.path).count === 1 ? 'comment' : 'comments'}`
                        : 'No comments yet' }}
                    </strong>
                    <template v-if="archiveCommentsFor(entry.path).count">
                      <span
                        v-for="comment in archiveCommentsFor(entry.path).comments.slice(-3).reverse()"
                        :key="comment.id"
                      >
                        <b>{{ comment.nickname }}</b>
                        <em>{{ comment.body }}</em>
                      </span>
                      <small v-if="archiveCommentsFor(entry.path).count > 3">
                        +{{ archiveCommentsFor(entry.path).count - 3 }} more
                      </small>
                    </template>
                    <small v-else>Open the match to start the conversation.</small>
                  </span>
                </span>
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

          <article class="setup-card comments-card">
            <div class="card-number">02</div>
            <div class="card-body">
              <div class="card-title-row">
                <div>
                  <span class="card-kicker">Match comments</span>
                  <h3>Notes from the archive</h3>
                </div>
                <span class="comment-count">
                  <b>{{ demoComments.length }}</b>
                  <span>{{ demoComments.length === 1 ? 'note' : 'notes' }}</span>
                </span>
              </div>

              <form v-if="loadedDemoPath" class="comment-form" @submit.prevent="submitDemoComment">
                <label>
                  <span>Nickname</span>
                  <input
                    v-model="commentNickname"
                    maxlength="32"
                    autocomplete="nickname"
                    placeholder="Your nickname"
                    @input="rememberCommentNickname"
                  />
                </label>
                <label>
                  <span>Comment</span>
                  <textarea
                    v-model="commentBody"
                    maxlength="1000"
                    rows="3"
                    placeholder="What should other viewers know about this match?"
                  ></textarea>
                </label>
                <button
                  class="comment-submit"
                  type="submit"
                  :disabled="commentSubmitting || !commentNickname.trim() || !commentBody.trim()"
                >
                  {{ commentSubmitting ? 'Saving…' : 'Post comment' }}
                </button>
              </form>
              <p v-else class="comment-empty">Open a match from the shared archive to read or post comments.</p>
              <p v-if="commentError" class="analysis-error">{{ commentError }}</p>

              <div v-if="loadedDemoPath" class="comment-list" aria-live="polite">
                <p v-if="commentsLoading" class="comment-empty">Loading comments…</p>
                <p v-else-if="!demoComments.length" class="comment-empty">No comments yet. Start the conversation.</p>
                <article v-for="comment in demoComments" v-else :key="comment.id" class="comment-entry">
                  <header>
                    <strong>{{ comment.nickname }}</strong>
                    <time :datetime="comment.createdAt">{{ formatCommentDate(comment.createdAt) }}</time>
                  </header>
                  <p>{{ comment.body }}</p>
                </article>
              </div>
            </div>
          </article>

          <!-- Dolt. Spelresurserna hämtas från servern per demo, så den manuella
               mappväljaren fyller ingen funktion. Att resurserna saknas syns
               ändå: launchHint intill startknappen säger "Incomplete game
               folder" med vilka filer som krävs.

               Markupen ligger kvar i stället för att raderas eftersom
               selectGameFolder, onFolderInput, folderInput, gameFolderName och
               gameBytes bara används här — en radering hade fällt bygget på
               noUnusedLocals och krävt att hela den manuella vägen togs bort.
               Sätt villkoret till !gameReady för att få tillbaka den. -->
          <article v-if="false" :class="['setup-card', { complete: gameReady }]">
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
                <div
                  v-for="moment in topMoments"
                  :key="moment.momentId"
                  class="highlight-card"
                >
                  <span class="score-badge">{{ moment.rating.score }}</span>
                  <span class="highlight-copy">
                    <strong>{{ playerLabel(moment.killerPlayerId, moment.startTimeMs) }} · {{ moment.eventIds.length }} {{ moment.eventIds.length === 1 ? 'frag' : 'frags' }}</strong>
                    <small>{{ moment.rating.reasons.slice(0, 2).map(scoreReasonLabel).join(' · ') }}</small>
                  </span>
                  <span class="highlight-meta">{{ logicalTeamNameForPlayer(moment.killerPlayerId) }} · {{ momentVisibilityLabel(moment) }}</span>
                  <button
                    class="frag-play highlight-play"
                    type="button"
                    :data-preview-play-id="`moment:${moment.momentId}`"
                    :disabled="!canLaunch"
                    :aria-label="`Play highlight with ${moment.eventIds.length} ${moment.eventIds.length === 1 ? 'frag' : 'frags'}`"
                    @click="playMoment(moment)"
                  ><span class="play-icon" aria-hidden="true"></span><span>Play</span></button>
                </div>
              </section>
              <section>
                <div class="highlight-title">
                  <div><span>Rounds</span><strong>Best rounds by frags</strong></div>
                  <small>Winning team · full round</small>
                </div>
                <div
                  v-for="rating in topRounds"
                  :key="`${rating.roundId}-${rating.team}`"
                  class="highlight-card"
                >
                  <span class="score-badge">{{ rating.score }}</span>
                  <span class="highlight-copy">
                    <strong>{{ roundLabel(rating.roundId) }} · {{ roundTeamLabel(rating) }}</strong>
                    <small>{{ rating.reasons.slice(0, 2).map(scoreReasonLabel).join(' · ') || 'Limited information' }}</small>
                  </span>
                  <span class="highlight-meta">Winner only</span>
                  <button
                    class="frag-play highlight-play"
                    type="button"
                    :data-preview-play-id="`round:${rating.roundId}-${rating.team}`"
                    :disabled="!canLaunch || !roundPlaybackDeaths(rating).length"
                    :aria-label="`Play ${roundPlaybackDeaths(rating).length} winning-team frags from ${roundLabel(rating.roundId)} for ${roundTeamLabel(rating)}`"
                    @click="playRatedRound(rating)"
                  ><span class="play-icon" aria-hidden="true"></span><span>Play {{ roundPlaybackDeaths(rating).length }}</span></button>
                </div>
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
                <small>3-second lead-in and up to 3 seconds of tail · cuts 0.5 seconds before the fragger dies.</small>
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
                <label class="movie-select-all" title="Select or deselect every visible playlist frag">
                  <input
                    type="checkbox"
                    :checked="movieAllFragsSelected"
                    :indeterminate.prop="movieSomeFragsSelected"
                    :disabled="!movieSelectableFragIds.size || movieExportRunning"
                    aria-label="Select or deselect every visible playlist frag"
                    @change="onMovieSelectAllCheckbox"
                  />
                  <span>Queue</span>
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
                    :title="movieSelectableFragIds.has(death.eventId) ? 'Include this frag in the playlist selection' : 'This frag cannot be replayed from the recorded POV'"
                    @click.stop
                  >
                    <input
                      type="checkbox"
                      :checked="isMovieFragSelected(death.eventId)"
                      :disabled="!movieSelectableFragIds.has(death.eventId) || movieExportRunning"
                      :aria-label="`Include frag ${index + 1} in playlist selection`"
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
                    <em v-if="fragRatingById.get(death.eventId)?.ace" class="ace-badge">ACE</em>
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
                    :data-frag-play-id="death.eventId"
                    :data-preview-play-id="death.eventId"
                    :disabled="!canLaunch"
                    :aria-label="`Play frag ${index + 1}`"
                    :title="canLaunch ? 'Play from three seconds before the frag' : 'Open a demo first'"
                    @click.stop="playFrag(death)"
                  ><span class="play-icon" aria-hidden="true"></span><span>Play</span></button>
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
              Use the Play button to watch one frag from three seconds before the event.
            </p>

            <section class="movie-export-section" aria-labelledby="playlist-add-heading">
              <div class="movie-export-copy">
                <span>Playlist · {{ movieFragDeaths.length }}/{{ fragReelDeaths.length }} frags selected</span>
                <strong id="playlist-add-heading">Add the selected frags to your playlist</strong>
                <small v-if="loadedDemoPath">The shared demo and exact event IDs are saved with each frag.</small>
                <small v-else>Only demos from the shared HLTV archive can be used in portable playlists.</small>
              </div>
              <div class="movie-export-controls">
                <div class="movie-selection-actions">
                  <button type="button" :disabled="movieExportRunning" @click="selectAllMovieFrags">Select all</button>
                  <button type="button" :disabled="movieExportRunning" @click="clearMovieFrags">Clear all</button>
                </div>
                <button
                  class="movie-export-button"
                  type="button"
                  :disabled="!canAddSelectedToPlaylist"
                  @click="addSelectedFragsToPlaylist"
                >Add {{ movieFragDeaths.length }} to playlist</button>
              </div>
            </section>
          </template>
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

      <section id="frag-playlist" class="playlist-project" aria-labelledby="playlist-heading">
        <header class="playlist-project-heading">
          <div>
            <p class="step-label">Multi-demo project</p>
            <h2 id="playlist-heading">Frag playlist</h2>
            <span>Persistent in this browser · portable across everyone using the same HLTV database.</span>
          </div>
          <div class="playlist-file-actions">
            <input
              ref="playlistImportInput"
              class="sr-only"
              type="file"
              accept="application/json,.json"
              @change="importFragPlaylist"
            />
            <button type="button" @click="playlistImportInput?.click()">Import playlist</button>
            <button type="button" :disabled="!fragPlaylist.items.length" @click="exportFragPlaylist">Export playlist</button>
          </div>
        </header>

        <div class="playlist-project-meta">
          <label>
            <span>Playlist name</span>
            <input v-model="fragPlaylist.title" type="text" maxlength="100" @change="updatePlaylistTitle" />
          </label>
          <div><span>Frags</span><strong>{{ fragPlaylist.items.length }}</strong></div>
          <div><span>Demos</span><strong>{{ fragPlaylistDemoCount }}</strong></div>
          <div><span>Clip time</span><strong>{{ formatDuration(fragPlaylistDurationMs / 1_000) }}</strong></div>
        </div>

        <div v-if="fragPlaylist.items.length" class="playlist-items">
          <article v-for="(item, index) in fragPlaylist.items" :key="item.id" class="playlist-item">
            <span class="playlist-position">{{ index + 1 }}</span>
            <div class="playlist-item-copy">
              <strong>{{ item.killer }} → {{ item.victim }} <em v-if="item.headshot">HS</em></strong>
              <small>{{ item.demoName }} · {{ item.mapName }} · {{ formatEventTime(item.demoTimeMs) }} · {{ weaponLabel(item.weapon) }}</small>
            </div>
            <b>{{ item.score ?? '–' }}</b>
            <div class="playlist-item-actions">
              <button type="button" :disabled="index === 0 || movieExportRunning" title="Move up" @click="movePlaylistItem(index, -1)">↑</button>
              <button type="button" :disabled="index === fragPlaylist.items.length - 1 || movieExportRunning" title="Move down" @click="movePlaylistItem(index, 1)">↓</button>
              <button type="button" :disabled="movieExportRunning" title="Remove" @click="removePlaylistItem(item.id)">×</button>
            </div>
          </article>
        </div>
        <p v-else class="playlist-empty">Select frags in any archive demo and add them here.</p>

        <section class="playlist-music" aria-labelledby="playlist-music-heading">
          <header class="playlist-music-heading">
            <div>
              <span>Movie soundtrack</span>
              <strong id="playlist-music-heading">Music timeline</strong>
              <small>Mixed with the CS audio during movie export · files stay in this browser tab.</small>
            </div>
            <div class="playlist-music-actions">
              <input
                ref="playlistMusicInput"
                class="sr-only"
                type="file"
                multiple
                accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,.mp3,.m4a,.aac,.wav,.ogg"
                @change="importPlaylistMusic"
              />
              <button
                type="button"
                :disabled="playlistMusicLoading || movieExportRunning"
                @click="playlistMusicInput?.click()"
              >{{ playlistMusicLoading ? 'Decoding…' : 'Add music files' }}</button>
              <button
                type="button"
                :disabled="!playlistMusicTracks.length || movieExportRunning"
                @click="arrangePlaylistMusic"
              >Auto arrange</button>
            </div>
          </header>

          <div class="playlist-music-mix">
            <label>
              <span>CS sound <b>{{ Math.round(playlistGameVolume * 100) }}%</b></span>
              <input v-model.number="playlistGameVolume" type="range" min="0" max="1" step="0.05" :disabled="movieExportRunning" />
            </label>
            <label>
              <span>Music <b>{{ Math.round(playlistMusicVolume * 100) }}%</b></span>
              <input v-model.number="playlistMusicVolume" type="range" min="0" max="1" step="0.05" :disabled="movieExportRunning" />
            </label>
            <label>
              <span>Crossfade <b>{{ playlistMusicCrossfade.toFixed(1) }} s</b></span>
              <input v-model.number="playlistMusicCrossfade" type="range" min="0" max="5" step="0.5" :disabled="movieExportRunning" />
            </label>
            <div>
              <span>Music ends</span>
              <strong>{{ formatDuration(playlistMusicEndSeconds) }}</strong>
            </div>
          </div>

          <div v-if="playlistMusicTracks.length" class="playlist-music-tracks">
            <article v-for="(track, index) in playlistMusicTracks" :key="track.id">
              <span class="playlist-music-index">{{ index + 1 }}</span>
              <div class="playlist-music-name">
                <strong>{{ track.name }}</strong>
                <small>{{ formatDuration(movieMusicTrackDuration(track)) }} available after trim</small>
              </div>
              <label>
                <span>Start in movie</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  :disabled="movieExportRunning"
                  :value="track.startAtSeconds"
                  @change="updatePlaylistMusicNumber(track.id, 'startAtSeconds', ($event.currentTarget as HTMLInputElement).value)"
                />
              </label>
              <label>
                <span>Start in song</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  :disabled="movieExportRunning"
                  :value="track.trimStartSeconds"
                  @change="updatePlaylistMusicNumber(track.id, 'trimStartSeconds', ($event.currentTarget as HTMLInputElement).value)"
                />
              </label>
              <label>
                <span>Track volume</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  :disabled="movieExportRunning"
                  :value="track.volume"
                  @change="updatePlaylistMusicNumber(track.id, 'volume', ($event.currentTarget as HTMLInputElement).value)"
                />
              </label>
              <div class="playlist-music-track-actions">
                <button type="button" :disabled="index === 0 || movieExportRunning" title="Move up" @click="movePlaylistMusic(index, -1)">↑</button>
                <button type="button" :disabled="index === playlistMusicTracks.length - 1 || movieExportRunning" title="Move down" @click="movePlaylistMusic(index, 1)">↓</button>
                <button type="button" :disabled="movieExportRunning" title="Remove" @click="removePlaylistMusic(track.id)">×</button>
              </div>
            </article>
          </div>
          <p v-else class="playlist-music-empty">Add MP3, WAV, M4A/AAC or OGG files. Browser codec support decides which files can be decoded.</p>
          <small v-if="playlistMusicError" class="movie-export-error">{{ playlistMusicError }}</small>
        </section>

        <footer class="playlist-project-footer">
          <div class="playlist-feedback">
            <small v-if="playlistNotice" class="movie-export-notice">{{ playlistNotice }}</small>
            <small v-if="playlistError" class="movie-export-error">{{ playlistError }}</small>
            <small v-if="movieExportNotice" class="movie-export-notice">{{ movieExportNotice }}</small>
            <small v-if="movieExportError" class="movie-export-error">{{ movieExportError }}</small>
            <button type="button" :disabled="!fragPlaylist.items.length || movieExportRunning" @click="clearFragPlaylist">Clear playlist</button>
          </div>
          <div class="playlist-run-controls">
            <button class="playlist-play-button" type="button" :disabled="!canStartPlaylist" @click="() => playFragPlaylist('playlist')">
              <span class="play-icon"></span> Only Frags
            </button>
            <div class="playlist-export-controls">
              <label class="movie-quality-select">
                <span>Export quality</span>
                <select v-model="movieQualityId" :disabled="movieExportRunning">
                  <option v-for="quality in MOVIE_QUALITIES" :key="quality.id" :value="quality.id">{{ quality.label }}</option>
                </select>
              </label>
              <label class="movie-intro-toggle">
                <input v-model="movieIncludeIntro" type="checkbox" :disabled="movieExportRunning" @change="saveMovieIntroPreference" />
                <span>Intro + outro</span>
              </label>
              <button
                class="playlist-export-button"
                type="button"
                :disabled="!canStartPlaylist || !movieExportSupported"
                @click="exportPlaylistMovie"
              >Export movie · {{ formatBytes(playlistMovieEstimatedBytes) }}</button>
            </div>
          </div>
        </footer>
        <p :class="['playlist-quality-note', { active: movieQuality.fps === 120 }]">
          120 FPS requires a 120 Hz display and browser rendering at 120 Hz; otherwise frames may be duplicated.
        </p>
      </section>

      <footer>
        <span>Runs on Xash3D-FWGS + CS16Client</span>
        <span>GoldSrc lives forever.</span>
      </footer>
    </section>

    <section v-show="engineVisible" :class="['engine-stage', `hud-${hudPreset}`]">
      <canvas
        :key="engineCanvasGeneration"
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
        <strong>{{ playlistTransitioning ? 'Loading the next playlist demo' : 'Seeking to the selected position' }}</strong>
        <span>{{ playlistTransitioning ? 'The next recording and its assets were preloaded when possible.' : 'Video and audio are disabled while the scene is rebuilt.' }}</span>
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
          <p>{{ fragReelTeamLabel }} · {{ fragReelDisplayIndex }}/{{ fragReelDisplayCount }} frags</p>
          <div class="movie-export-progress"><i :style="{ width: `${movieExportProgress}%` }"></i></div>
          <small>
            {{ Math.round(movieExportProgress) }}% · {{ formatBytes(movieExportBytes) }} written
            · {{ movieRenderFps ? `${movieRenderFps.toFixed(1)} encoded FPS` : 'starting encoder…' }}
            · {{ movieRecorder?.encodingBacklogFrames ?? 0 }} queued frames
          </small>
          <small v-if="movieEncoderCatchingUp">
            Playback is temporarily frozen while the encoder drains its queue. Movie time and audio are paused together.
          </small>
          <small v-else>The movie is rendering behind this view. Pointer and keyboard input are locked so spectator controls cannot change the recorded POV.</small>
          <button
            data-movie-export-cancel
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
          <span>ONLY FRAGS · {{ fragReelTeamLabel }} <strong>{{ fragReelDisplayIndex }}/{{ fragReelDisplayCount }}</strong></span>
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
  import { CLAN_FAMILIES, CREW, crewMemberForName, nameTokens } from '/@/archive/crew';
  import {
    buildReplayRoute,
    EMPTY_REPLAY_ROUTE,
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
    fragReelEndTimeMs,
    isFragReelEligible,
    nextFragReelAction,
    withFragReelDeathCutoffs,
  } from '/@/demo/frag-reel';
  import {
    MOVIE_QUALITIES,
    MOVIE_INTRO_DURATION_MS,
    MOVIE_OUTRO_DURATION_MS,
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
  import {
    movieMusicTrackDuration,
    type MovieAudioMix,
    type MovieMusicTrack,
  } from '/@/movie/movie-audio-mixer';
  import {
    FRAG_PLAYLIST_STORAGE_KEY,
    createFragPlaylist,
    parseFragPlaylist,
    playlistDurationMs,
    playlistItemKey,
    resolvePlaylistDeath,
    safePlaylistFilename,
    type FragPlaylistItem,
  } from '/@/playlist/frag-playlist';
  import {
    prepareStaticAssetCache,
    type GameAssetEntry,
  } from '/@/services/local-asset-mount';
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
  type PlaylistDemoBundle = {
    entry: DemoCatalogEntry;
    inspected: GoldSrcDemo;
    source: Extract<DemoSource, { kind: 'url' }>;
    buffer: ArrayBuffer;
    analysis: DemoAnalysisIndex;
  };
  type WorkspaceViewSnapshot = {
    windowX: number;
    windowY: number;
    focusTargetId: string;
    scrollAreas: Array<{ selector: string; left: number; top: number }>;
  };
  type DemoComment = {
    id: string;
    demoPath: string;
    nickname: string;
    body: string;
    createdAt: string;
  };
  type DemoCommentSummary = {
    count: number;
    comments: DemoComment[];
  };

  const MOVIE_EXPORT_DIAGNOSTICS_KEY = 'replay-lab-movie-export-diagnostics-v1';
  const MOVIE_INTRO_PREFERENCE_KEY = 'replay-lab-movie-intro-v1';
  const ARCHIVE_FILTERS_STORAGE_KEY = 'replay-lab-demo-archive-filters-v1';
  const COMMENT_NICKNAME_STORAGE_KEY = 'replay-lab-comment-nickname-v1';
  const archiveSortValues: readonly DemoCatalogSort[] = [
    'date-desc', 'date-asc', 'frag-desc', 'round-desc', 'comments-desc',
    'ace-desc', 'zero-twelve-desc',
  ];

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
  const playlistImportInput = ref<HTMLInputElement>();
  const playlistMusicInput = ref<HTMLInputElement>();
  const engineCanvas = ref<HTMLCanvasElement>();
  const engineCanvasGeneration = ref(0);
  let engineCanvasCaptureReady = false;
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
  const archivePerson = ref<'all' | string>('all');
  const archiveClan = ref<'all' | string>('all');
  const crewIndex = shallowRef<CrewIndex>();
  const archiveSort = ref<DemoCatalogSort>('date-desc');
  const archiveResultLimit = ref(50);
  const archiveSelectionPath = ref('');
  const commentNickname = ref('');
  const commentBody = ref('');
  const demoComments = ref<DemoComment[]>([]);
  const commentsLoading = ref(false);
  const commentSubmitting = ref(false);
  const commentError = ref('');
  const archiveComments = shallowRef<ReadonlyMap<string, DemoCommentSummary>>(new Map());
  let commentsRequest = 0;
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
  const fragReelSource = ref<'playback' | 'movie' | 'round' | 'playlist' | 'playlist-movie'>('playback');
  const roundFragDeaths = shallowRef<DeathEvent[]>([]);
  const roundFragTeamLabel = ref('');
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
  const fragPlaylist = ref(createFragPlaylist());
  const playlistNotice = ref('');
  const playlistError = ref('');
  const playlistMusicTracks = shallowRef<MovieMusicTrack[]>([]);
  const playlistMusicLoading = ref(false);
  const playlistMusicError = ref('');
  const playlistGameVolume = ref(0.7);
  const playlistMusicVolume = ref(0.55);
  const playlistMusicCrossfade = ref(1.5);
  const playlistRunItems = shallowRef<FragPlaylistItem[]>([]);
  const playlistRunCursor = ref(0);
  const playlistTransitioning = ref(false);
  const standaloneFragEndTimeMs = ref<number>();
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
  let playlistSuppressRoute = false;
  let playlistRunGeneration = 0;
  let playlistTransitionPromise: Promise<void> | undefined;
  let workspaceViewSnapshot: WorkspaceViewSnapshot | undefined;
  const playlistDemoBundles = new Map<string, Promise<PlaylistDemoBundle>>();
  const verifiedWallbangEventIds = shallowRef<ReadonlySet<string>>(new Set());
  let activeScoringMapBuffer: ArrayBuffer | undefined;

  const deathEvents = computed(() => analysisIndex.value?.events.filter(isDeathEvent) ?? []);
  const archiveYears = computed(() => [...new Set(
    demoCatalog.value?.demos.flatMap((entry) => entry.year === null ? [] : [entry.year]) ?? [],
  )].sort((left, right) => right - left));
  // Vilka i gänget som finns i varje demo, uträknat EN gång per katalog.
  // Att köra namnmatchningen inne i filtret hade betytt 6226 demos gånger
  // ~15 spelarnamn vid varje tangenttryck i sökrutan.
  const crewByDemoPath = computed(() => {
    const map = new Map<string, Set<string>>();
    for (const demo of demoCatalog.value?.demos ?? []) {
      const ids = new Set<string>();
      for (const name of demo.players ?? []) {
        const member = crewMemberForName(name);
        if (member) ids.add(member.id);
      }
      if (ids.size) map.set(demo.path, ids);
    }
    return map;
  });

  /**
   * Klanerna per demo. Matchas mot BÅDA källorna: lagnamnen i teams[], och
   * klantaggen framför spelarnas nick. Ett demo där laget bara heter "Team 1"
   * bär ändå taggen på namnen, och skulle annars falla ur filtret.
   */
  const clansByDemoPath = computed(() => {
    const map = new Map<string, Set<string>>();
    for (const demo of demoCatalog.value?.demos ?? []) {
      if (demo.status !== 'complete') continue;
      const haystack: string[] = [];
      for (const team of demo.teams ?? []) haystack.push(team.toLocaleLowerCase('en-GB'));
      for (const name of demo.players ?? []) haystack.push(...nameTokens(name));
      const found = new Set<string>();
      for (const clan of CLAN_FAMILIES) {
        if (haystack.some((value) => clan.match.test(value))) found.add(clan.name);
      }
      if (found.size) map.set(demo.path, found);
    }
    return map;
  });

  const archiveClans = computed(() => {
    const counts = new Map<string, number>();
    for (const names of clansByDemoPath.value.values()) {
      for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return CLAN_FAMILIES
      .map((clan) => ({ name: clan.name, demos: counts.get(clan.name) ?? 0 }))
      .filter((clan) => clan.demos > 0)
      .sort((left, right) => right.demos - left.demos);
  });

  /** Gänget som faktiskt förekommer i arkivet, med antal demos. */
  const archivePeople = computed(() => {
    const counts = new Map<string, number>();
    for (const ids of crewByDemoPath.value.values()) {
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return CREW
      .map((member) => ({ ...member, demos: counts.get(member.id) ?? 0 }))
      .filter((member) => member.demos > 0)
      .sort((left, right) => right.demos - left.demos);
  });

  const personFilteredArchive = computed(() => {
    let entries = demoCatalog.value?.demos ?? [];
    if (archivePerson.value !== 'all') {
      const lookup = crewByDemoPath.value;
      entries = entries.filter((entry) => lookup.get(entry.path)?.has(archivePerson.value));
    }
    if (archiveClan.value !== 'all') {
      const lookup = clansByDemoPath.value;
      entries = entries.filter((entry) => lookup.get(entry.path)?.has(archiveClan.value));
    }
    return entries;
  });

  const filteredArchiveDemos = computed(() => filterDemoCatalog(
    personFilteredArchive.value,
    archiveSearch.value,
    archiveYear.value,
    archiveSort.value,
    new Map([...archiveComments.value].map(([path, summary]) => [path, summary.count])),
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
  const roundPlaybackDeaths = (rating: RoundRating): DeathEvent[] => {
    const perspective = analysisIndex.value?.demo.perspective.kind;
    if (!perspective) return [];
    const eligibleDeaths = deathEvents.value
      .filter((death) => death.roundId === rating.roundId)
      .filter((death) => fragRatingById.value.get(death.eventId)?.team === rating.team)
      .filter((death) => isFragReelEligible(
        perspective,
        fragRatingById.value.get(death.eventId)?.visibility,
      ))
      .sort((left, right) => left.demoTimeMs - right.demoTimeMs);
    return withFragReelDeathCutoffs(eligibleDeaths, deathEvents.value);
  };
  const topRounds = computed(() => [...(analysisIndex.value?.roundRatings ?? [])]
    .filter((rating) => rating.score > 0)
    .filter((rating) => {
      const round = analysisIndex.value?.rounds.find((entry) => entry.roundId === rating.roundId);
      if (!round
        || round.endTimeMs === null
        || round.endTimeMs <= round.startTimeMs
        || round.winner.value !== rating.team) return false;
      const winningTeamFragCount = (analysisIndex.value?.fragRatings ?? []).filter((fragRating) =>
        fragRating.team === rating.team
        && deathEvents.value.find((death) => death.eventId === fragRating.eventId)?.roundId
          === rating.roundId).length;
      if (winningTeamFragCount > 5) return false;
      if (highlightTeam.value === 'all') return true;
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
    const eligibleDeaths = filteredDeaths.value
      .filter((death) => isFragReelEligible(
        perspective,
        fragRatingById.value.get(death.eventId)?.visibility,
      ))
      .sort((left, right) => left.demoTimeMs - right.demoTimeMs);
    return withFragReelDeathCutoffs(eligibleDeaths, deathEvents.value);
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
  const playlistMode = computed(() => fragReelSource.value === 'playlist'
    || fragReelSource.value === 'playlist-movie');
  const activePlaylistSegmentItems = computed(() => {
    const first = playlistRunItems.value[playlistRunCursor.value];
    if (!first) return [];
    const items: FragPlaylistItem[] = [];
    for (let index = playlistRunCursor.value; index < playlistRunItems.value.length; index += 1) {
      const item = playlistRunItems.value[index];
      if (!item || item.demoPath !== first.demoPath) break;
      items.push(item);
    }
    return items;
  });
  const resolvePlaylistItemDeath = (item: FragPlaylistItem) => resolvePlaylistDeath(
    item,
    deathEvents.value,
    (death) => ({
      killer: playerLabel(death.killerPlayerId, death.demoTimeMs, death.killerSlot),
      victim: playerLabel(death.victimPlayerId, death.demoTimeMs, death.victimSlot),
    }),
  );
  const playlistSegmentDeaths = computed(() => {
    const segmentItems = activePlaylistSegmentItems.value;
    const resolvedItems = segmentItems.flatMap((item) => {
      const death = resolvePlaylistItemDeath(item);
      return death ? [{ item, death }] : [];
    });
    const deaths = withFragReelDeathCutoffs(
      resolvedItems.map(({ death }) => death),
      deathEvents.value,
    );
    return deaths.map((death, index) => {
      const item = resolvedItems[index]?.item;
      if (!item) return death;
      const storedEndMs = Math.max(death.demoTimeMs, item.clipEndTimeMs);
      const deathAwareEndMs = death.postrollEndTimeMs ?? storedEndMs;
      const isFinalMovieFrag = fragReelSource.value === 'playlist-movie'
        && playlistRunCursor.value + index === playlistRunItems.value.length - 1;
      return {
        ...death,
        postrollEndTimeMs: Math.max(
          death.demoTimeMs,
          Math.min(
            storedEndMs,
            deathAwareEndMs,
            isFinalMovieFrag ? death.demoTimeMs + 900 : Number.POSITIVE_INFINITY,
          ),
        ),
      };
    });
  });
  const activeFragReelDeaths = computed(() => playlistMode.value
    ? playlistSegmentDeaths.value
    : fragReelSource.value === 'round'
      ? roundFragDeaths.value
      : fragReelSource.value === 'movie'
        ? movieFragDeaths.value
        : fragReelDeaths.value);
  const fragReelDisplayIndex = computed(() => playlistMode.value
    ? playlistRunCursor.value + fragReelIndex.value + 1
    : fragReelIndex.value + 1);
  const fragReelDisplayCount = computed(() => playlistMode.value
    ? playlistRunItems.value.length
    : activeFragReelDeaths.value.length);
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
  const fragReelTeamLabel = computed(() => playlistMode.value
    ? fragPlaylist.value.title
    : fragReelSource.value === 'round'
      ? roundFragTeamLabel.value
      : fragPlayer.value !== 'all'
        ? playerLabel(fragPlayer.value)
        : highlightTeam.value === 'all'
          ? logicalMatchupLabel.value
          : logicalTeamName(highlightTeam.value));
  const fragReelTeamShortLabel = computed(() => playlistMode.value
    ? 'Playlist'
    : fragPlayer.value !== 'all'
      ? playerLabel(fragPlayer.value)
      : highlightTeam.value === 'all'
        ? 'Both'
        : logicalTeamName(highlightTeam.value));
  const fragMovieTimeline = computed(() => buildFragMovieTimeline(movieFragDeaths.value));
  const fragPlaylistDurationMs = computed(() => playlistDurationMs(fragPlaylist.value.items));
  const fragPlaylistDemoCount = computed(() => new Set(
    fragPlaylist.value.items.map((item) => item.demoPath),
  ).size);
  const playlistMusicEndSeconds = computed(() => playlistMusicTracks.value.reduce(
    (end, track) => Math.max(end, track.startAtSeconds + movieMusicTrackDuration(track)),
    0,
  ));
  const playlistAudioMix = computed<MovieAudioMix | undefined>(() =>
    playlistMusicTracks.value.length ? {
      tracks: playlistMusicTracks.value,
      gameVolume: playlistGameVolume.value,
      musicVolume: playlistMusicVolume.value,
      crossfadeSeconds: playlistMusicCrossfade.value,
    } : undefined);
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
  const playlistMovieIntroCard = computed<MovieIntroCard>(() => ({
    variant: 'playlist',
    teams: ['', ''],
    matchDate: '',
    mapName: '',
    focusKind: 'match',
    focusLabel: fragPlaylist.value.title.trim() || 'Untitled frag film',
    fragCount: fragPlaylist.value.items.length,
    demoCount: fragPlaylistDemoCount.value,
    runtimeLabel: formatDuration(fragPlaylistDurationMs.value / 1_000),
    durationSeconds: MOVIE_INTRO_DURATION_MS / 1_000,
  }));
  const playlistMovieOutroCard = computed<MovieIntroCard>(() => ({
    variant: 'playlist',
    teams: ['', ''],
    matchDate: '',
    mapName: '',
    focusKind: 'match',
    focusLabel: fragPlaylist.value.title.trim() || 'Untitled frag film',
    fragCount: fragPlaylist.value.items.length,
    demoCount: fragPlaylistDemoCount.value,
    runtimeLabel: formatDuration(fragPlaylistDurationMs.value / 1_000),
    durationSeconds: MOVIE_OUTRO_DURATION_MS / 1_000,
  }));
  const movieQuality = computed(() => MOVIE_QUALITIES.find((quality) =>
    quality.id === movieQualityId.value) ?? MOVIE_QUALITIES[0]);
  const movieEstimatedBytes = computed(() => estimatedMovieBytes(
    fragMovieTimeline.value.durationMs
      + movieSideCount(movieScoreboardEvents.value) * MOVIE_SCOREBOARD_DURATION_MS
      + (movieIncludeIntro.value ? MOVIE_INTRO_DURATION_MS : 0),
    movieQuality.value,
  ));
  const playlistMovieEstimatedBytes = computed(() => estimatedMovieBytes(
    fragPlaylistDurationMs.value + (movieIncludeIntro.value
      ? MOVIE_INTRO_DURATION_MS + MOVIE_OUTRO_DURATION_MS
      : 0),
    movieQuality.value,
  ));
  const activeMovieEstimatedBytes = computed(() => fragReelSource.value === 'playlist-movie'
    ? playlistMovieEstimatedBytes.value
    : movieEstimatedBytes.value);
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
  const canStartPlaylist = computed(() => fragPlaylist.value.items.length > 0
    && !playlistTransitioning.value
    && !movieExportRunning.value
    && Boolean(demoCatalog.value));
  const canAddSelectedToPlaylist = computed(() => Boolean(loadedDemoPath.value)
    && movieFragDeaths.value.length > 0
    && !movieExportRunning.value);
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
  const formatCommentDate = (value: string): string => new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

  const rememberCommentNickname = () => {
    window.localStorage.setItem(COMMENT_NICKNAME_STORAGE_KEY, commentNickname.value);
  };

  /**
   * De fem senaste kommentarerna i hela arkivet.
   *
   * Byggs ur ?scope=catalog som redan laddats — den returnerar de fem senaste
   * PER demo, vilket är mer än nog för att plocka fram de fem senaste totalt.
   * Ingen extra förfrågan behövs.
   */
  const latestComments = computed(() => {
    const rows: { comment: DemoComment; demoPath: string; filename: string }[] = [];
    for (const [demoPath, summary] of archiveComments.value) {
      const filename = demoPath.split('/').pop() ?? demoPath;
      for (const comment of summary.comments) rows.push({ comment, demoPath, filename });
    }
    return rows
      .sort((left, right) => right.comment.createdAt.localeCompare(left.comment.createdAt))
      .slice(0, 5);
  });

  const commentAge = (iso: string): string => {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'nyss';
    if (minutes < 60) return `${minutes} min sedan`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} tim sedan`;
    const days = Math.round(hours / 24);
    return days < 31 ? `${days} d sedan` : new Date(iso).toLocaleDateString('sv-SE');
  };

  const emptyCommentSummary: DemoCommentSummary = { count: 0, comments: [] };
  const archiveCommentsFor = (demoPath: string): DemoCommentSummary =>
    archiveComments.value.get(demoPath) ?? emptyCommentSummary;
  const archiveCommentTitle = (demoPath: string): string => {
    const summary = archiveCommentsFor(demoPath);
    if (!summary.count) return 'No comments yet';
    return summary.comments.map((comment) => `${comment.nickname}: ${comment.body}`).join('\n');
  };

  const loadArchiveComments = async () => {
    try {
      const response = await fetch('/api/demo-comments?scope=catalog');
      const result = await response.json() as {
        demos?: Array<DemoCommentSummary & { demoPath: string }>;
      };
      if (!response.ok) throw new Error(`Comments could not be loaded (${response.status}).`);
      archiveComments.value = new Map(
        (result.demos ?? []).map(({ demoPath, count, comments }) => [demoPath, { count, comments }]),
      );
    } catch {
      // The archive remains usable if the optional comment service is unavailable.
    }
  };

  const loadDemoComments = async (demoPath: string) => {
    const request = ++commentsRequest;
    demoComments.value = [];
    commentError.value = '';
    if (!demoPath) {
      commentsLoading.value = false;
      return;
    }
    commentsLoading.value = true;
    try {
      const response = await fetch(`/api/demo-comments?demo=${encodeURIComponent(demoPath)}`);
      const result = await response.json() as { comments?: DemoComment[]; error?: string };
      if (!response.ok) throw new Error(result.error || `Comments could not be loaded (${response.status}).`);
      if (request === commentsRequest) demoComments.value = result.comments ?? [];
    } catch (error) {
      if (request === commentsRequest) {
        commentError.value = error instanceof Error ? error.message : 'Comments could not be loaded.';
      }
    } finally {
      if (request === commentsRequest) commentsLoading.value = false;
    }
  };

  const submitDemoComment = async () => {
    const demoPath = loadedDemoPath.value;
    const nickname = commentNickname.value.trim();
    const body = commentBody.value.trim();
    if (!demoPath || !nickname || !body || commentSubmitting.value) return;
    commentSubmitting.value = true;
    commentError.value = '';
    rememberCommentNickname();
    try {
      const response = await fetch('/api/demo-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoPath, nickname, body }),
      });
      const result = await response.json() as { comment?: DemoComment; error?: string };
      if (!response.ok || !result.comment) {
        throw new Error(result.error || `The comment could not be saved (${response.status}).`);
      }
      demoComments.value.push(result.comment);
      const previous = archiveCommentsFor(demoPath);
      archiveComments.value = new Map(archiveComments.value).set(demoPath, {
        count: previous.count + 1,
        comments: [...previous.comments, result.comment].slice(-5),
      });
      commentBody.value = '';
    } catch (error) {
      commentError.value = error instanceof Error ? error.message : 'The comment could not be saved.';
    } finally {
      commentSubmitting.value = false;
    }
  };

  watch(loadedDemoPath, (demoPath) => { void loadDemoComments(demoPath); });
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

  /** Öppnar ett demo ur katalogen på sökväg, som en delad länk gör. */
  const openArchiveDemoByPath = (demoPath: string) => {
    const entry = demoCatalog.value?.demos.find((demo) => demo.path === demoPath);
    if (!entry) return;
    void loadArchiveDemo(entry);
  };

  const onPopState = () => {
    void applyReplayRoute(parseReplayRoute(window.location.href));
  };

  watch(currentReplayRoute, (route, previous) => {
    if (applyingRoute || playlistSuppressRoute) return;
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
  const commitPlaylistItems = (items: FragPlaylistItem[]) => {
    fragPlaylist.value = {
      ...fragPlaylist.value,
      updatedAt: new Date().toISOString(),
      items,
    };
  };
  const updatePlaylistTitle = () => {
    const title = fragPlaylist.value.title.trim() || 'My frag playlist';
    fragPlaylist.value = {
      ...fragPlaylist.value,
      title,
      updatedAt: new Date().toISOString(),
    };
  };
  const arrangePlaylistMusic = () => {
    let cursor = 0;
    playlistMusicTracks.value = playlistMusicTracks.value.map((track) => {
      const arranged = { ...track, startAtSeconds: Math.max(0, cursor) };
      cursor = arranged.startAtSeconds
        + movieMusicTrackDuration(arranged)
        - playlistMusicCrossfade.value;
      return arranged;
    });
  };
  const importPlaylistMusic = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length || playlistMusicLoading.value) return;
    playlistMusicLoading.value = true;
    playlistMusicError.value = '';
    const context = new AudioContext();
    const additions: MovieMusicTrack[] = [];
    const failures: string[] = [];
    try {
      for (const file of files) {
        try {
          const buffer = await context.decodeAudioData(await file.arrayBuffer());
          if (!buffer.length || !buffer.numberOfChannels) throw new Error('empty audio');
          additions.push({
            id: crypto.randomUUID(),
            name: file.name,
            sampleRate: buffer.sampleRate,
            channels: Array.from(
              { length: Math.min(2, buffer.numberOfChannels) },
              (_, channel) => buffer.getChannelData(channel),
            ),
            startAtSeconds: 0,
            trimStartSeconds: 0,
            volume: 1,
          });
        } catch {
          failures.push(file.name);
        }
      }
    } finally {
      await context.close().catch(() => undefined);
      playlistMusicLoading.value = false;
    }
    if (additions.length) {
      let cursor = Math.max(
        0,
        playlistMusicEndSeconds.value
          - (playlistMusicTracks.value.length ? playlistMusicCrossfade.value : 0),
      );
      const arrangedAdditions = additions.map((track) => {
        const arranged = { ...track, startAtSeconds: cursor };
        cursor = Math.max(
          0,
          cursor + movieMusicTrackDuration(arranged) - playlistMusicCrossfade.value,
        );
        return arranged;
      });
      playlistMusicTracks.value = [...playlistMusicTracks.value, ...arrangedAdditions];
    }
    if (failures.length) {
      playlistMusicError.value = `Could not decode: ${failures.join(', ')}. Try MP3 or WAV.`;
    }
  };
  const updatePlaylistMusicNumber = (
    id: string,
    field: 'startAtSeconds' | 'trimStartSeconds' | 'volume',
    rawValue: string,
  ) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    playlistMusicTracks.value = playlistMusicTracks.value.map((track) => {
      if (track.id !== id) return track;
      const maximum = field === 'trimStartSeconds'
        ? Math.max(0, (track.channels[0]?.length ?? 0) / track.sampleRate - 0.05)
        : field === 'volume' ? 1 : Number.POSITIVE_INFINITY;
      return { ...track, [field]: Math.min(maximum, Math.max(0, value)) };
    });
  };
  const movePlaylistMusic = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= playlistMusicTracks.value.length) return;
    const tracks = [...playlistMusicTracks.value];
    [tracks[index], tracks[target]] = [tracks[target]!, tracks[index]!];
    playlistMusicTracks.value = tracks;
    arrangePlaylistMusic();
  };
  const removePlaylistMusic = (id: string) => {
    playlistMusicTracks.value = playlistMusicTracks.value.filter((track) => track.id !== id);
  };
  const addSelectedFragsToPlaylist = () => {
    playlistError.value = '';
    playlistNotice.value = '';
    const demoPath = loadedDemoPath.value;
    const entry = demoCatalog.value?.demos.find((candidate) => candidate.path === demoPath);
    if (!demoPath || !entry || !analysisIndex.value || !demoInfo.value) {
      playlistError.value = 'Only demos from the shared HLTV archive can be added.';
      return;
    }
    const existing = new Set(fragPlaylist.value.items.map(playlistItemKey));
    const additions: FragPlaylistItem[] = [];
    for (const death of movieFragDeaths.value) {
      const killer = playerLabel(death.killerPlayerId, death.demoTimeMs, death.killerSlot);
      const victim = playerLabel(death.victimPlayerId, death.demoTimeMs, death.victimSlot);
      const identity = playlistItemKey({
        demoPath,
        demoTimeMs: death.demoTimeMs,
        killer,
        victim,
        weapon: death.weapon,
        headshot: death.headshot,
      });
      if (existing.has(identity)) continue;
      existing.add(identity);
      additions.push({
        id: crypto.randomUUID(),
        demoPath,
        demoName: entry.filename,
        demoSha256: entry.sha256,
        eventId: death.eventId,
        sourcePacketOrdinal: death.packetOrdinal,
        sourceMessageOrdinal: death.source.messageOrdinal,
        demoTimeMs: death.demoTimeMs,
        clipStartTimeMs: Math.max(0, death.demoTimeMs - FRAG_REEL_PREROLL_MS),
        clipEndTimeMs: fragReelEndTimeMs(death),
        mapName: demoInfo.value.mapName,
        killer,
        victim,
        weapon: death.weapon,
        headshot: death.headshot,
        score: fragRatingById.value.get(death.eventId)?.score ?? null,
      });
    }
    if (!additions.length) {
      playlistNotice.value = 'Every selected frag is already in the playlist.';
      return;
    }
    commitPlaylistItems([...fragPlaylist.value.items, ...additions]);
    playlistNotice.value = `${additions.length} ${additions.length === 1 ? 'frag' : 'frags'} added from ${entry.filename}.`;
  };
  const removePlaylistItem = (id: string) => {
    commitPlaylistItems(fragPlaylist.value.items.filter((item) => item.id !== id));
  };
  const migratePlaylistSegmentItems = (
    segmentItems: readonly FragPlaylistItem[],
    segmentDeaths: readonly DeathEvent[],
  ) => {
    const replacements = new Map<string, FragPlaylistItem>();
    segmentItems.forEach((item, index) => {
      const death = segmentDeaths[index];
      if (!death) return;
      const eventChanged = death.eventId !== item.eventId
        || death.packetOrdinal !== item.sourcePacketOrdinal
        || death.source.messageOrdinal !== item.sourceMessageOrdinal;
      if (!eventChanged) return;
      const timeDeltaMs = death.demoTimeMs - item.demoTimeMs;
      replacements.set(item.id, {
        ...item,
        eventId: death.eventId,
        sourcePacketOrdinal: death.packetOrdinal,
        sourceMessageOrdinal: death.source.messageOrdinal,
        demoTimeMs: death.demoTimeMs,
        clipStartTimeMs: Math.max(0, item.clipStartTimeMs + timeDeltaMs),
        clipEndTimeMs: Math.max(0, item.clipEndTimeMs + timeDeltaMs),
        killer: playerLabel(death.killerPlayerId, death.demoTimeMs, death.killerSlot),
        victim: playerLabel(death.victimPlayerId, death.demoTimeMs, death.victimSlot),
        weapon: death.weapon,
        headshot: death.headshot,
        score: fragRatingById.value.get(death.eventId)?.score ?? item.score,
      });
    });
    if (!replacements.size) return;
    playlistRunItems.value = playlistRunItems.value.map((item) => replacements.get(item.id) ?? item);
    commitPlaylistItems(fragPlaylist.value.items.map((item) => replacements.get(item.id) ?? item));
    playlistNotice.value = `${replacements.size} playlist ${replacements.size === 1 ? 'frag was' : 'frags were'} updated to the current demo index.`;
  };
  const movePlaylistItem = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= fragPlaylist.value.items.length) return;
    const items = [...fragPlaylist.value.items];
    [items[index], items[target]] = [items[target]!, items[index]!];
    commitPlaylistItems(items);
  };
  const clearFragPlaylist = () => {
    if (fragPlaylist.value.items.length && !window.confirm('Clear the entire frag playlist?')) return;
    commitPlaylistItems([]);
    playlistNotice.value = 'The playlist is empty.';
    playlistError.value = '';
  };
  const exportFragPlaylist = () => {
    const blob = new Blob([JSON.stringify(fragPlaylist.value, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safePlaylistFilename(fragPlaylist.value.title);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    playlistNotice.value = `${anchor.download} exported.`;
  };
  const importFragPlaylist = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    playlistError.value = '';
    playlistNotice.value = '';
    try {
      const imported = parseFragPlaylist(JSON.parse(await file.text()) as unknown);
      const catalogByPath = new Map(
        demoCatalog.value?.demos.map((entry) => [entry.path, entry]) ?? [],
      );
      const identities = new Set<string>();
      for (const item of imported.items) {
        const entry = catalogByPath.get(item.demoPath);
        if (!entry || entry.status === 'error') {
          throw new Error(`The shared database does not contain ${item.demoPath}.`);
        }
        if (item.demoSha256 && entry.sha256 && item.demoSha256 !== entry.sha256) {
          throw new Error(`${item.demoName} does not match this database revision.`);
        }
        const identity = playlistItemKey(item);
        if (identities.has(identity)) throw new Error(`${item.demoName} contains a duplicate frag.`);
        identities.add(identity);
      }
      if (fragPlaylist.value.items.length
        && !window.confirm(`Replace the current playlist with “${imported.title}”?`)) return;
      fragPlaylist.value = { ...imported, updatedAt: new Date().toISOString() };
      playlistNotice.value = `${imported.items.length} frags imported from ${file.name}.`;
    } catch (error) {
      playlistError.value = error instanceof Error ? error.message : 'Could not import the playlist.';
    }
  };
  watch(fragPlaylist, (playlist) => {
    try {
      window.localStorage.setItem(FRAG_PLAYLIST_STORAGE_KEY, JSON.stringify(playlist));
    } catch {
      playlistError.value = 'The browser could not persist the playlist.';
    }
  }, { deep: true });
  watch([archiveSearch, archiveYear, archiveSort], ([search, year, sort]) => {
    try {
      window.localStorage.setItem(ARCHIVE_FILTERS_STORAGE_KEY, JSON.stringify({
        version: 1,
        search,
        year,
        sort,
        person: archivePerson.value,
        clan: archiveClan.value,
      }));
    } catch {
      // Filtering must keep working when storage is disabled or full.
    }
  });
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
    if (fragReelSource.value === 'playlist-movie') return false;
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
        audioMix: fragReelSource.value === 'playlist-movie'
          ? playlistAudioMix.value
          : undefined,
        captureMode: movieCaptureMode,
        intro: movieIncludeIntro.value
          ? fragReelSource.value === 'playlist-movie'
            ? playlistMovieIntroCard.value
            : movieIntroCard.value
          : undefined,
        outro: movieIncludeIntro.value && fragReelSource.value === 'playlist-movie'
          ? playlistMovieOutroCard.value
          : undefined,
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
    if (fragReelSource.value === 'playlist-movie') {
      const targetMs = Math.max(
        1,
        fragPlaylistDurationMs.value + (movieIncludeIntro.value ? MOVIE_INTRO_DURATION_MS : 0),
      );
      movieExportProgress.value = Math.min(
        99.5,
        recorder.capturedFrames / movieQuality.value.fps * 1_000 / targetMs * 100,
      );
      const progressBucket = Math.floor(movieExportProgress.value / 10);
      if (progressBucket > movieLastDiagnosticProgressBucket) {
        movieLastDiagnosticProgressBucket = progressBucket;
        recordMovieExportDiagnostic(
          'progress',
          `Playlist export reached ${Math.round(movieExportProgress.value)} percent.`,
        );
      }
      return;
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
    completePlaylistTransition();
    void startMovieRecorderIfReady();
    updateStandaloneFragPlayback();
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

  type CrewIndexMember = {
    id: string; name: string; demos: number; seconds: number;
    frags: number; deaths: number; headshots: number;
    aces: number; zeroTwelveGames: number;
    headshotPercent: number; ratio: number | null; years: number[];
    topMaps: { value: string; count: number }[];
    topNicks: { value: string; count: number }[];
  };
  type CrewIndex = {
    generatedAt: string;
    totals?: Pick<CrewIndexMember,
      'frags' | 'deaths' | 'headshots' | 'aces' | 'zeroTwelveGames'>;
    members: CrewIndexMember[];
  };

  const loadCrewIndex = async () => {
    try {
      const response = await fetch('/crew-index.json');
      if (!response.ok) return;
      crewIndex.value = await response.json() as CrewIndex;
    } catch {
      // Statistiken är utsmyckning; arkivet fungerar utan den.
    }
  };

  /** Summor över hela arkivet, räknade ur katalogen som redan är laddad. */
  const archiveTotals = computed(() => {
    const demos = (demoCatalog.value?.demos ?? []).filter((d) => d.status === 'complete');
    let seconds = 0; let frags = 0; let rounds = 0;
    const maps = new Map<string, number>();
    const years = new Set<number>();
    for (const demo of demos) {
      seconds += demo.durationSeconds ?? 0;
      frags += demo.fragCount ?? 0;
      rounds += demo.roundCount ?? 0;
      if (demo.year) years.add(demo.year);
      if (demo.map) maps.set(demo.map, (maps.get(demo.map) ?? 0) + 1);
    }
    const yearList = [...years].sort();
    return {
      demos: demos.length, seconds, frags, rounds,
      days: Math.floor(seconds / 86400),
      hours: Math.floor((seconds % 86400) / 3600),
      minutes: Math.floor((seconds % 3600) / 60),
      maps: maps.size,
      span: yearList.length ? `${yearList[0]}–${yearList.at(-1)}` : '',
    };
  });

  const crewTotals = computed(() => crewIndex.value?.totals
    ?? (crewIndex.value?.members ?? []).reduce((total, member) => ({
      frags: total.frags + member.frags,
      deaths: total.deaths + member.deaths,
      headshots: total.headshots + member.headshots,
      aces: total.aces + (member.aces ?? 0),
      zeroTwelveGames: total.zeroTwelveGames + (member.zeroTwelveGames ?? 0),
    }), { frags: 0, deaths: 0, headshots: 0, aces: 0, zeroTwelveGames: 0 }));

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
      await prepareStaticAssetCache();
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

  const playlistBundleFor = (item: FragPlaylistItem): Promise<PlaylistDemoBundle> => {
    const cached = playlistDemoBundles.get(item.demoPath);
    if (cached) return cached;
    const pending = (async () => {
      const entry = demoCatalog.value?.demos.find((candidate) => candidate.path === item.demoPath);
      if (!entry || entry.status === 'error') {
        throw new Error(`The shared database does not contain ${item.demoPath}.`);
      }
      if (item.demoSha256 && entry.sha256 && item.demoSha256 !== entry.sha256) {
        throw new Error(`${item.demoName} does not match this database revision.`);
      }
      const demoUrl = demoCatalogAssetUrl('/demo-files', entry.path);
      const analysisUrl = demoCatalogAssetUrl('/demo-analysis', `${entry.path}.json`);
      const [demoResponse, analysisResponse] = await Promise.all([
        fetch(demoUrl),
        fetch(analysisUrl),
      ]);
      if (!demoResponse.ok) throw new Error(`Could not preload ${entry.filename}.`);
      if (!analysisResponse.ok) throw new Error(`Could not load the analysis for ${entry.filename}.`);
      const [buffer, stored] = await Promise.all([
        demoResponse.arrayBuffer(),
        analysisResponse.json() as Promise<DemoAnalysisIndex & { error?: string }>,
      ]);
      if (stored.error) throw new Error(stored.error);
      if (item.demoSha256 && stored.demo.sha256 !== item.demoSha256) {
        throw new Error(`${entry.filename} failed playlist identity verification.`);
      }
      const inspected = await inspectDemoFile(new File([buffer], entry.filename));
      return {
        entry,
        inspected,
        source: { kind: 'url' as const, name: entry.filename, url: demoUrl },
        buffer,
        analysis: stored,
      };
    })().catch((error) => {
      playlistDemoBundles.delete(item.demoPath);
      throw error;
    });
    playlistDemoBundles.set(item.demoPath, pending);
    return pending;
  };

  const nextPlaylistSegmentCursor = (): number =>
    playlistRunCursor.value + activePlaylistSegmentItems.value.length;

  const prefetchPlaylistSegment = (cursor: number) => {
    const item = playlistRunItems.value[cursor];
    if (item) void playlistBundleFor(item).catch(() => undefined);
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
    // WebGL context attributes are immutable. A canvas first used for normal
    // playback cannot later be upgraded to preserveDrawingBuffer for movie
    // capture. Replace it once when capture is first requested, then retain
    // that readable surface across playlist demo transitions because the
    // active recorder intentionally keeps the same canvas as its video source.
    if (movieExportRunning.value && !engineCanvasCaptureReady) {
      engineCanvasGeneration.value += 1;
      engineCanvasCaptureReady = true;
    }
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
        targetFps: movieExportRunning.value ? movieQuality.value.fps : undefined,
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
      // Native HLTV first person must be selected while the seek overlay is
      // still up. DemoEngine holds the target frame until this camera is ready,
      // then starts the full visible preroll from the requested timestamp.
      activateAfterMs: nativeHltv
        ? 0
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

  const captureWorkspaceView = (focusTargetId: string): WorkspaceViewSnapshot => ({
    windowX: window.scrollX,
    windowY: window.scrollY,
    focusTargetId,
    scrollAreas: ['.archive-list', '.frag-list', '.playlist-items'].flatMap((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      return element
        ? [{ selector, left: element.scrollLeft, top: element.scrollTop }]
        : [];
    }),
  });

  const restoreWorkspaceView = async (snapshot: WorkspaceViewSnapshot) => {
    await nextTick();
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    for (const area of snapshot.scrollAreas) {
      const element = document.querySelector<HTMLElement>(area.selector);
      element?.scrollTo({ left: area.left, top: area.top, behavior: 'instant' });
    }
    window.scrollTo({ left: snapshot.windowX, top: snapshot.windowY, behavior: 'instant' });
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    window.scrollTo({ left: snapshot.windowX, top: snapshot.windowY, behavior: 'instant' });
    const playButton = [...document.querySelectorAll<HTMLButtonElement>('[data-preview-play-id]')]
      .find((button) => button.dataset.previewPlayId === snapshot.focusTargetId);
    playButton?.focus({ preventScroll: true });
  };

  const playFrag = (death: DeathEvent) => {
    stopEngineBeforeLaunch();
    workspaceViewSnapshot = captureWorkspaceView(death.eventId);
    fragReelActive.value = false;
    selectedFragId.value = death.eventId;
    const playbackDeath = withFragReelDeathCutoffs([death], deathEvents.value)[0] ?? death;
    standaloneFragEndTimeMs.value = fragReelEndTimeMs(playbackDeath);
    const startAtMs = Math.max(0, death.demoTimeMs - FRAG_REEL_PREROLL_MS);
    hudPlaybackStartMs.value = startAtMs;
    void launchDemo(startAtMs, killerCameraFor(death, startAtMs));
  };

  const updateStandaloneFragPlayback = () => {
    if (standaloneFragEndTimeMs.value === undefined
      || launching.value
      || seeking.value
      || !engineStarted.value
      || hudDemoTimeMs.value < standaloneFragEndTimeMs.value) return;
    standaloneFragEndTimeMs.value = undefined;
    closeEngine();
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

  const failPlaylistRun = (error: unknown) => {
    const message = error instanceof Error
      ? error.message
      : String(error || 'The playlist could not continue.');
    playlistError.value = message;
    playlistTransitioning.value = false;
    playlistTransitionPromise = undefined;
    fragReelSeeking.value = false;
    seeking.value = false;
    if (movieExportRunning.value) {
      movieExportError.value = message;
      void cancelMovieExport(true);
    } else {
      closeEngine();
    }
  };

  const activatePlaylistSegment = async (cursor: number, generation: number): Promise<void> => {
    const item = playlistRunItems.value[cursor];
    if (!item) throw new Error('The playlist segment is empty.');
    playlistTransitioning.value = true;
    fragReelSeeking.value = true;
    seeking.value = true;
    setMovieAutomaticScoreboard(false);
    movieRecorder?.pause();
    if (DemoEngine.running) {
      try {
        DemoEngine.execute('sys_timescale 0');
      } catch {
        // The previous runtime may already have reached the end of its demo.
      }
    }

    const bundle = await playlistBundleFor(item);
    if (generation !== playlistRunGeneration) return;
    for (const demoPath of playlistDemoBundles.keys()) {
      if (demoPath !== item.demoPath) playlistDemoBundles.delete(demoPath);
    }
    DemoEngine.stop();
    engineStarted.value = false;
    hudPlaybackStartedAt.value = 0;
    loadingProgress.value = 0;
    gameFiles.value = [];
    mapChecksumMatches.value = false;
    activeScoringMapBuffer = undefined;
    verifiedWallbangEventIds.value = new Set();
    playlistRunCursor.value = cursor;
    fragReelIndex.value = 0;
    playlistSuppressRoute = true;
    loadedDemoPath.value = item.demoPath;
    demoInfo.value = bundle.inspected;
    demoSource.value = bundle.source;
    analysisBuffer.value = bundle.buffer;
    analysisIndex.value = bundle.analysis;
    analysisCacheHit.value = true;
    await loadInstalledGameAssets(bundle.inspected);
    if (generation !== playlistRunGeneration) return;
    if (!gameReady.value) throw new Error(`The assets for ${item.demoName} could not be mounted.`);

    const segmentItems = activePlaylistSegmentItems.value;
    const segmentDeaths = playlistSegmentDeaths.value;
    if (segmentDeaths.length !== segmentItems.length) {
      throw new Error(`${item.demoName} no longer contains every playlist frag.`);
    }
    migratePlaylistSegmentItems(segmentItems, segmentDeaths);
    const perspective = bundle.analysis.demo.perspective.kind;
    const invalidDeath = segmentDeaths.find((death) => !isFragReelEligible(
      perspective,
      fragRatingById.value.get(death.eventId)?.visibility,
    ));
    if (invalidDeath) throw new Error(`${item.demoName} contains a frag that cannot be replayed.`);

    const first = segmentDeaths[0];
    if (!first) throw new Error(`${item.demoName} has no playable playlist frags.`);
    selectedFragId.value = first.eventId;
    const startAtMs = Math.max(0, first.demoTimeMs - FRAG_REEL_PREROLL_MS);
    hudPlaybackStartMs.value = startAtMs;
    const camera = killerCameraFor(first, startAtMs);
    if (camera?.nativeHltv) camera.activateAfterMs = 0;
    await launchDemo(startAtMs, camera);
    if (!engineStarted.value) throw new Error(`${item.demoName} could not start.`);
    prefetchPlaylistSegment(nextPlaylistSegmentCursor());
  };

  const beginPlaylistSegment = (cursor: number) => {
    if (playlistTransitionPromise) return;
    const generation = playlistRunGeneration;
    const transition = activatePlaylistSegment(cursor, generation)
      .catch((error) => {
        if (generation === playlistRunGeneration) failPlaylistRun(error);
      })
      .finally(() => {
        if (playlistTransitionPromise === transition) playlistTransitionPromise = undefined;
      });
    playlistTransitionPromise = transition;
  };

  const completePlaylistTransition = () => {
    if (!playlistTransitioning.value
      || launching.value
      || seeking.value
      || !engineStarted.value) return;
    if (fragReelSource.value === 'playlist-movie' && movieRecorder) {
      const audio = DemoEngine.createAudioCapture();
      if (!audio) return;
      try {
        movieRecorder.replaceAudioCapture(audio);
        movieRecorder.resume();
      } catch (error) {
        failPlaylistRun(error);
        return;
      }
    }
    playlistTransitioning.value = false;
    fragReelSeeking.value = false;
    applyEngineHudPreset();
    engineCanvas.value?.focus();
  };

  const playFragPlaylist = (source: 'playlist' | 'playlist-movie') => {
    if (!fragPlaylist.value.items.length || !demoCatalog.value || playlistTransitioning.value) return;
    if (source === 'playlist' && movieExportRunning.value) return;
    if (engineStarted.value || engineVisible.value || DemoEngine.running) DemoEngine.stop();
    engineStarted.value = false;
    hudPlaybackStartedAt.value = 0;
    playlistError.value = '';
    playlistNotice.value = '';
    playlistDemoBundles.clear();
    playlistRunGeneration += 1;
    playlistRunItems.value = fragPlaylist.value.items.map((item) => ({ ...item }));
    playlistRunCursor.value = 0;
    fragReelSource.value = source;
    fragReelActive.value = true;
    fragReelSeeking.value = true;
    fragReelIndex.value = 0;
    engineVisible.value = true;
    engineStarted.value = false;
    movieScoreboardsShown.clear();
    movieScoreboardStartFrame = 0;
    beginPlaylistSegment(0);
  };

  const exportPlaylistMovie = async () => {
    if (!fragPlaylist.value.items.length
      || !movieExportSupported.value
      || movieExportRunning.value) return;
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
    if (document.pointerLockElement) document.exitPointerLock();
    engineCanvas.value?.blur();
    movieExportState.value = 'starting';
    recordMovieExportDiagnostic(
      'playlist-requested',
      `Playlist export requested: ${fragPlaylist.value.items.length} frags across ${fragPlaylistDemoCount.value} demos.`,
    );
    const temporaryName = safeMovieFilename(
      'playlist.dem',
      fragPlaylist.value.title,
      'tmp',
    );
    try {
      preparedMovieOutput = await prepareMovieOutput(temporaryName.replace(/\.tmp$/, ''));
      movieExportNotice.value = `Exporting directly to ${preparedMovieOutput.filename}.`;
      recordMovieExportDiagnostic('output-prepared', movieExportNotice.value);
      playFragPlaylist('playlist-movie');
    } catch (error) {
      movieExportState.value = 'idle';
      if (error instanceof DOMException && error.name === 'AbortError') {
        movieExportNotice.value = 'The export was cancelled before it started.';
        return;
      }
      movieExportError.value = error instanceof Error ? error.message : 'Could not prepare the playlist movie.';
      recordMovieExportDiagnostic('prepare-error', movieExportError.value, true);
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
      const minimumPlausibleBytes = activeMovieEstimatedBytes.value * 0.005;
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
    if (playlistTransitioning.value) {
      closeEngine();
      return;
    }
    fragReelActive.value = false;
    fragReelSeeking.value = false;
    playlistTransitioning.value = false;
    playlistRunGeneration += 1;
    playlistTransitionPromise = undefined;
    playlistRunItems.value = [];
    playlistDemoBundles.clear();
    playlistSuppressRoute = false;
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
      if (playlistMode.value) {
        const nextCursor = nextPlaylistSegmentCursor();
        if (nextCursor < playlistRunItems.value.length) {
          addLog(
            `Playlist: ${playlistRunCursor.value + activePlaylistSegmentItems.value.length}/${playlistRunItems.value.length} frags complete · loading next demo.`,
            false,
          );
          beginPlaylistSegment(nextCursor);
          return;
        }
        addLog(`Playlist complete: ${playlistRunItems.value.length} frags shown.`, false);
      } else {
        addLog(`Only Frags complete: ${activeFragReelDeaths.value.length} frags shown.`, false);
      }
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
    stopEngineBeforeLaunch();
    workspaceViewSnapshot = captureWorkspaceView(`moment:${moment.momentId}`);
    fragReelActive.value = false;
    selectedFragId.value = moment.eventIds[0] ?? '';
    const momentDeaths = withFragReelDeathCutoffs(
      moment.eventIds.flatMap((eventId) => {
        const death = deathEvents.value.find((entry) => entry.eventId === eventId);
        return death ? [death] : [];
      }),
      deathEvents.value,
    );
    const finalDeath = momentDeaths.at(-1);
    standaloneFragEndTimeMs.value = finalDeath
      ? fragReelEndTimeMs(finalDeath)
      : moment.endTimeMs;
    hudPlaybackStartMs.value = moment.startTimeMs;
    const death = momentDeaths[0];
    void launchDemo(
      moment.startTimeMs,
      death ? killerCameraFor(death, moment.startTimeMs) : undefined,
    );
  };

  const playRatedRound = (rating: RoundRating) => {
    const round = analysisIndex.value?.rounds.find((entry) => entry.roundId === rating.roundId);
    const winningDeaths = roundPlaybackDeaths(rating);
    const first = winningDeaths[0];
    if (!round || !first) return;
    stopEngineBeforeLaunch();
    workspaceViewSnapshot = captureWorkspaceView(`round:${rating.roundId}-${rating.team}`);
    fragReelSource.value = 'round';
    roundFragDeaths.value = winningDeaths;
    roundFragTeamLabel.value = `${roundTeamLabel(rating)} · ${roundLabel(rating.roundId)} winner`;
    fragReelActive.value = true;
    fragReelSeeking.value = false;
    fragReelIndex.value = 0;
    standaloneFragEndTimeMs.value = undefined;
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

  function closeEngine() {
    const returnView = workspaceViewSnapshot;
    workspaceViewSnapshot = undefined;
    standaloneFragEndTimeMs.value = undefined;
    if (scoreboardHeld.value && engineStarted.value) DemoEngine.execute('-showscores');
    scoreboardHeld.value = false;
    movieAutomaticScoreboardVisible = false;
    movieScoreboardStartFrame = 0;
    movieScoreboardsShown.clear();
    fragReelActive.value = false;
    fragReelSeeking.value = false;
    playlistTransitioning.value = false;
    playlistRunGeneration += 1;
    playlistTransitionPromise = undefined;
    playlistRunItems.value = [];
    playlistDemoBundles.clear();
    playlistSuppressRoute = false;
    engineVisible.value = false;
    launching.value = false;
    DemoEngine.stop();
    engineStarted.value = false;
    seeking.value = false;
    hudPlaybackStartedAt.value = 0;
    movieEncoderCatchingUp.value = false;
    nativeFov.value = 90;
    nativeWeaponId.value = 0;
    if (returnView) void restoreWorkspaceView(returnView);
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

  // Xash/Emscripten installs input listeners above the canvas as well as on
  // the canvas itself. A visual overlay therefore is not sufficient: clicks
  // on the export dialog can still look like spectator input to the engine.
  // Capture and consume every interactive event at window level while movie
  // frames are being produced. The cancel button is handled here too, so its
  // click never continues down to the engine listeners.
  const movieExportInputEvents = [
    'pointerdown', 'pointerup', 'pointercancel',
    'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu',
    'touchstart', 'touchmove', 'touchend',
    'wheel', 'keydown', 'keyup', 'keypress',
  ] as const;
  const blockMovieExportInput: EventListener = (event) => {
    if (!movieExportRunning.value) return;
    const cancelTarget = event.target instanceof Element
      ? event.target.closest('[data-movie-export-cancel]')
      : null;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (cancelTarget && event.type === 'click' && movieExportState.value !== 'finalizing') {
      void cancelMovieExport();
    }
  };

  onMounted(() => {
    commentNickname.value = window.localStorage.getItem(COMMENT_NICKNAME_STORAGE_KEY) ?? '';
    try {
      const savedArchiveFilters = JSON.parse(
        window.localStorage.getItem(ARCHIVE_FILTERS_STORAGE_KEY) ?? 'null',
      ) as unknown;
      if (savedArchiveFilters && typeof savedArchiveFilters === 'object') {
        const filters = savedArchiveFilters as Record<string, unknown>;
        if (filters.version === 1) {
          if (typeof filters.search === 'string') archiveSearch.value = filters.search;
          if (filters.year === 'all'
            || (typeof filters.year === 'number' && Number.isInteger(filters.year))) {
            archiveYear.value = filters.year;
          }
          if (archiveSortValues.includes(filters.sort as DemoCatalogSort)) {
            archiveSort.value = filters.sort as DemoCatalogSort;
          }
          // Personen valideras mot rostern: en sparad id som tagits bort ur
          // crew.ts skulle annars filtrera bort hela arkivet utan förklaring.
          if (typeof filters.person === 'string'
            && (filters.person === 'all' || CREW.some((member) => member.id === filters.person))) {
            archivePerson.value = filters.person;
          }
          if (typeof filters.clan === 'string'
            && (filters.clan === 'all' || CLAN_FAMILIES.some((clan) => clan.name === filters.clan))) {
            archiveClan.value = filters.clan;
          }
        }
      }
    } catch {
      // Ignore invalid or unavailable saved filter preferences.
    }
    try {
      const savedPlaylist = window.localStorage.getItem(FRAG_PLAYLIST_STORAGE_KEY);
      if (savedPlaylist) fragPlaylist.value = parseFragPlaylist(JSON.parse(savedPlaylist) as unknown);
    } catch (error) {
      playlistError.value = error instanceof Error
        ? `Saved playlist: ${error.message}`
        : 'The saved playlist could not be restored.';
    }
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
    void loadArchiveComments();
    void loadCrewIndex();
    void loadDemoCatalog().then(() => {
      if (initialRoute.demoPath) void applyReplayRoute(initialRoute);
    });
    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', showScoreboard, true);
    window.addEventListener('keyup', hideScoreboard, true);
    window.addEventListener('blur', hideScoreboardOnBlur);
    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    movieExportInputEvents.forEach((eventName) => {
      window.addEventListener(eventName, blockMovieExportInput, { capture: true, passive: false });
    });
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
    movieExportInputEvents.forEach((eventName) => {
      window.removeEventListener(eventName, blockMovieExportInput, { capture: true });
    });
    document.removeEventListener('visibilitychange', stopExportWhenTabIsHidden);
  });
</script>
