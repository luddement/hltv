export type ExportHudPreset = 'original' | 'cinematic' | 'analyst' | 'movie' | 'clean';
export type MovieCrosshairStyle = 'rifle' | 'pistol' | 'smg' | 'heavy';

export type MovieHudReason = { points: number; label: string };

export type MovieKillfeedEntry = {
  killer: string;
  victim: string;
  weapon: string;
  headshot: boolean;
  killerSide?: 'TERRORIST' | 'CT';
  victimSide?: 'TERRORIST' | 'CT';
  ageMs: number;
};

export type MovieIntroCard = {
  variant?: 'match' | 'playlist';
  teams: [string, string];
  matchDate: string;
  mapName: string;
  focusKind: 'player' | 'team' | 'match';
  focusLabel: string;
  fragCount?: number;
  demoCount?: number;
  runtimeLabel?: string;
  durationSeconds: number;
};

export type MovieHudFrame = {
  preset: ExportHudPreset;
  presentation: boolean;
  mapName: string;
  roundLabel: string;
  timeLabel: string;
  phaseLabel: string;
  killer: string;
  victim: string;
  weapon: string;
  weaponSummary: string;
  score: number | string;
  headshot: boolean;
  fragLanded: boolean;
  exiting: boolean;
  terroristsAlive: number | string;
  counterTerroristsAlive: number | string;
  reasons: MovieHudReason[];
  killfeed: MovieKillfeedEntry[];
  timelinePercent: number;
  crosshair: boolean;
  crosshairStyle: MovieCrosshairStyle;
  scope: boolean;
};

const ACID = '#c8f542';
const PAPER = '#f5f7f2';
const MUTED = '#aeb5aa';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const SANS = 'Inter, Arial, sans-serif';

const panel = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 0.82,
) => {
  context.fillStyle = `rgba(5, 7, 5, ${alpha})`;
  context.fillRect(x, y, width, height);
};

const text = (
  context: CanvasRenderingContext2D,
  value: string | number,
  x: number,
  y: number,
  size: number,
  color = PAPER,
  weight = 600,
  align: CanvasTextAlign = 'left',
  family = SANS,
) => {
  context.fillStyle = color;
  context.font = `${weight} ${size}px ${family}`;
  context.textAlign = align;
  context.textBaseline = 'alphabetic';
  context.fillText(String(value), x, y);
};

const fittedText = (
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  preferredSize: number,
  minimumSize: number,
  maxWidth: number,
  color = PAPER,
  weight = 800,
  align: CanvasTextAlign = 'center',
  family = SANS,
) => {
  let size = preferredSize;
  while (size > minimumSize) {
    context.font = `${weight} ${size}px ${family}`;
    if (context.measureText(value).width <= maxWidth) break;
    size--;
  }
  text(context, value, x, y, size, color, weight, align, family);
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number): number => 1 - (1 - clamp01(value)) ** 3;
const smoothstep = (start: number, end: number, value: number): number => {
  const progress = clamp01((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
};

const playlistTitleLayout = (
  context: CanvasRenderingContext2D,
  rawTitle: string,
  maxWidth: number,
  preferredSize: number,
  minimumSize: number,
): { lines: string[]; size: number } => {
  const title = rawTitle.trim().replace(/\s+/g, ' ') || 'Untitled frag film';
  const splitPoints = [...title.matchAll(/\s+/g)].map((match) => match.index!);
  if (!splitPoints.length && title.length > 1) {
    const middle = Math.round(title.length / 2);
    for (let offset = 0; offset < title.length / 2; offset++) {
      if (middle - offset > 0) splitPoints.push(middle - offset);
      if (middle + offset < title.length) splitPoints.push(middle + offset);
    }
  }

  for (let size = preferredSize; size >= minimumSize; size -= 1) {
    context.font = `900 ${size}px ${SANS}`;
    if (context.measureText(title).width <= maxWidth) return { lines: [title], size };

    let best: { lines: [string, string]; score: number } | undefined;
    for (const splitAt of splitPoints) {
      const first = title.slice(0, splitAt).trim();
      const second = title.slice(splitAt).trim();
      if (!first || !second) continue;
      const firstWidth = context.measureText(first).width;
      const secondWidth = context.measureText(second).width;
      if (firstWidth > maxWidth || secondWidth > maxWidth) continue;
      const score = Math.max(firstWidth, secondWidth) + Math.abs(firstWidth - secondWidth) * 0.2;
      if (!best || score < best.score) best = { lines: [first, second], score };
    }
    if (best) return { lines: best.lines, size };
  }

  context.font = `900 ${minimumSize}px ${SANS}`;
  let shortened = title;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return { lines: [`${shortened.trim()}…`], size: minimumSize };
};

const renderPlaylistIntro = (
  context: CanvasRenderingContext2D,
  card: MovieIntroCard,
  rawProgress: number,
) => {
  const { width, height } = context.canvas;
  const scale = Math.min(width / 1920, height / 1080);
  const progress = clamp01(rawProgress);
  const reveal = easeOutCubic(progress / 0.34);
  const detailsReveal = smoothstep(0.18, 0.48, progress);
  const exitFade = 1 - smoothstep(0.91, 1, progress);
  const margin = Math.max(70 * scale, width * 0.072);

  context.save();
  context.fillStyle = '#040604';
  context.fillRect(0, 0, width, height);

  const ambientGlow = context.createRadialGradient(
    width * 0.83, height * 0.34, 0,
    width * 0.83, height * 0.34, width * 0.72,
  );
  ambientGlow.addColorStop(0, 'rgba(200,245,66,.16)');
  ambientGlow.addColorStop(0.28, 'rgba(90,119,39,.065)');
  ambientGlow.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = ambientGlow;
  context.fillRect(0, 0, width, height);

  const gridSize = 72 * scale;
  const gridOffset = (progress * gridSize * 0.35) % gridSize;
  context.strokeStyle = 'rgba(200,245,66,.038)';
  context.lineWidth = Math.max(1, scale);
  context.beginPath();
  for (let x = gridOffset; x < width; x += gridSize) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let y = gridOffset; y < height; y += gridSize) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();

  context.globalAlpha = exitFade;

  // The large archive number gives the card depth while remaining specific to
  // this playlist. It is deliberately outline-only so the title always wins.
  const archiveNumber = String(card.fragCount ?? 0).padStart(3, '0');
  context.save();
  context.translate(width * 0.91 + (1 - reveal) * 90 * scale, height * 0.68);
  context.rotate(-Math.PI / 2);
  context.font = `900 ${270 * scale}px ${SANS}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = Math.max(1.5, 2.5 * scale);
  context.strokeStyle = 'rgba(200,245,66,.10)';
  context.strokeText(archiveNumber, 0, 0);
  context.restore();

  const topY = height * 0.105;
  context.globalAlpha = detailsReveal * exitFade;
  context.fillStyle = ACID;
  context.beginPath();
  context.arc(margin + 5 * scale, topY - 4 * scale, 5 * scale, 0, Math.PI * 2);
  context.fill();
  text(context, 'PRAXXA FILMS', margin + 25 * scale, topY,
    14 * scale, PAPER, 800, 'left', MONO);
  text(context, 'COUNTER-STRIKE / ARCHIVE CUT', width - margin, topY,
    12 * scale, '#70796d', 650, 'right', MONO);

  const titleMaxWidth = Math.min(width * 0.72, 1320 * scale);
  const titleLayout = playlistTitleLayout(
    context,
    card.focusLabel,
    titleMaxWidth,
    124 * scale,
    46 * scale,
  );
  const lineHeight = titleLayout.size * 0.96;
  const titleBlockHeight = titleLayout.lines.length * lineHeight;
  const titleTop = height * 0.43 - titleBlockHeight / 2;
  const titleX = margin + (1 - reveal) * 88 * scale;

  context.save();
  context.beginPath();
  context.rect(margin - 8 * scale, titleTop - 32 * scale,
    titleMaxWidth + 40 * scale, titleBlockHeight + 82 * scale);
  context.clip();
  context.globalAlpha = reveal * exitFade;
  titleLayout.lines.forEach((line, index) => {
    text(context, line, titleX, titleTop + (index + 0.82) * lineHeight,
      titleLayout.size, PAPER, 900, 'left', SANS);
  });
  context.restore();

  const ruleY = titleTop + titleBlockHeight + 48 * scale;
  context.globalAlpha = exitFade;
  context.fillStyle = 'rgba(200,245,66,.16)';
  context.fillRect(margin, ruleY, titleMaxWidth, Math.max(1, 2 * scale));
  context.fillStyle = ACID;
  context.fillRect(margin, ruleY, titleMaxWidth * reveal, Math.max(2, 4 * scale));

  context.globalAlpha = detailsReveal * exitFade;
  text(context, 'A COUNTER-STRIKE FRAG FILM', margin, ruleY + 54 * scale,
    14 * scale, ACID, 750, 'left', MONO);

  const stats = [
    { label: 'FRAGS', value: String(card.fragCount ?? 0) },
    { label: 'DEMOS', value: String(card.demoCount ?? 0) },
    { label: 'RUNTIME', value: card.runtimeLabel || '—' },
  ];
  const statsY = height * 0.82;
  const statWidth = Math.min(210 * scale, width * 0.14);
  stats.forEach((stat, index) => {
    const x = margin + index * statWidth;
    if (index > 0) {
      context.fillStyle = 'rgba(255,255,255,.12)';
      context.fillRect(x - 24 * scale, statsY - 29 * scale, Math.max(1, scale), 58 * scale);
    }
    text(context, stat.value, x, statsY,
      30 * scale, index === 0 ? ACID : PAPER, 850, 'left', SANS);
    text(context, stat.label, x, statsY + 29 * scale,
      10 * scale, '#717a6e', 650, 'left', MONO);
  });

  text(context, 'ORIGINAL GAME AUDIO / MULTI-DEMO EDIT', width - margin, height * 0.91,
    10 * scale, '#596055', 600, 'right', MONO);
  context.restore();

  if (progress > 0.91) {
    context.fillStyle = `rgba(4,6,4,${smoothstep(0.91, 1, progress)})`;
    context.fillRect(0, 0, width, height);
  }
};

export const renderMovieIntro = (
  context: CanvasRenderingContext2D,
  card: MovieIntroCard,
  progress = 1,
) => {
  if (card.variant === 'playlist') {
    renderPlaylistIntro(context, card, progress);
    return;
  }
  const { width, height } = context.canvas;
  const scale = Math.min(width / 1920, height / 1080);
  const centerX = width / 2;

  context.save();
  context.fillStyle = '#050705';
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(
    centerX, height * 0.48, 0,
    centerX, height * 0.48, Math.max(width, height) * 0.62,
  );
  glow.addColorStop(0, 'rgba(200,245,66,.10)');
  glow.addColorStop(0.5, 'rgba(55,73,32,.035)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.fillStyle = 'rgba(200,245,66,.13)';
  context.fillRect(width * 0.075, height * 0.12, width * 0.85, Math.max(1, 2 * scale));
  text(context, 'PRAXXA HLTV PLAYER / ONLY FRAGS', width * 0.075, height * 0.105,
    14 * scale, ACID, 700, 'left', MONO);
  if (card.matchDate) {
    text(context, 'MATCH DATE', centerX, height * 0.175,
      11 * scale, MUTED, 650, 'center', MONO);
    fittedText(context, card.matchDate.toUpperCase(), centerX, height * 0.225,
      54 * scale, 30 * scale, width * 0.72, PAPER, 850);
  }

  text(context, card.mapName.toUpperCase(), centerX, height * 0.29,
    15 * scale, ACID, 700, 'center', MONO);
  fittedText(context, card.teams[0].toUpperCase(), centerX, height * 0.415,
    58 * scale, 30 * scale, width * 0.78, PAPER, 850);
  text(context, 'VS', centerX, height * 0.495, 18 * scale, '#727b6d', 650, 'center', MONO);
  fittedText(context, card.teams[1].toUpperCase(), centerX, height * 0.59,
    58 * scale, 30 * scale, width * 0.78, PAPER, 850);

  const focusLabel = card.focusKind === 'player'
    ? 'FOLLOWING PLAYER'
    : card.focusKind === 'team'
      ? 'FOLLOWING TEAM'
      : 'SHOWING FRAGS FROM';
  const focusY = height * 0.755;
  const focusWidth = Math.min(width * 0.78, 920 * scale);
  panel(context, centerX - focusWidth / 2, focusY - 52 * scale, focusWidth, 132 * scale, 0.72);
  context.fillStyle = ACID;
  context.fillRect(centerX - focusWidth / 2, focusY - 52 * scale, 4 * scale, 132 * scale);
  text(context, focusLabel, centerX, focusY - 13 * scale,
    12 * scale, MUTED, 650, 'center', MONO);
  fittedText(context, card.focusLabel.toUpperCase(), centerX, focusY + 39 * scale,
    (card.focusKind === 'player' ? 72 : 42) * scale,
    25 * scale, focusWidth - 70 * scale, ACID, 850);

  text(context, 'COUNTER-STRIKE MATCH ARCHIVE', centerX, height * 0.91,
    11 * scale, '#596055', 600, 'center', MONO);
  context.restore();
};

export const renderMovieOutro = (
  context: CanvasRenderingContext2D,
  card: MovieIntroCard,
  rawProgress: number,
  gameplayFrame?: CanvasImageSource,
) => {
  const { width, height } = context.canvas;
  const scale = Math.min(width / 1920, height / 1080);
  const progress = clamp01(rawProgress);
  const transition = smoothstep(0, 0.13, progress);
  const reveal = easeOutCubic(smoothstep(0.08, 0.38, progress));
  const detailsReveal = smoothstep(0.22, 0.48, progress);
  const finalFade = 1 - smoothstep(0.84, 1, progress);
  const margin = Math.max(70 * scale, width * 0.072);

  context.save();
  context.fillStyle = '#020302';
  context.fillRect(0, 0, width, height);
  if (gameplayFrame && transition < 1) {
    context.globalAlpha = 1 - transition;
    context.drawImage(gameplayFrame, 0, 0, width, height);
    context.globalAlpha = 1;
  }

  context.globalAlpha = transition;
  context.fillStyle = '#040604';
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(
    width * 0.2, height * 0.62, 0,
    width * 0.2, height * 0.62, width * 0.72,
  );
  glow.addColorStop(0, 'rgba(200,245,66,.14)');
  glow.addColorStop(0.32, 'rgba(89,116,39,.055)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  const gridSize = 72 * scale;
  const gridOffset = ((1 - progress) * gridSize * 0.25) % gridSize;
  context.strokeStyle = 'rgba(200,245,66,.034)';
  context.lineWidth = Math.max(1, scale);
  context.beginPath();
  for (let x = gridOffset; x < width; x += gridSize) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let y = gridOffset; y < height; y += gridSize) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();

  context.globalAlpha = transition * detailsReveal * finalFade;
  text(context, 'PLAYLIST COMPLETE', margin, height * 0.12,
    14 * scale, ACID, 750, 'left', MONO);
  text(context, 'PRAXXA FILMS / ARCHIVE CUT', width - margin, height * 0.12,
    12 * scale, '#70796d', 650, 'right', MONO);

  const titleMaxWidth = Math.min(width * 0.77, 1400 * scale);
  const titleLayout = playlistTitleLayout(
    context,
    card.focusLabel,
    titleMaxWidth,
    112 * scale,
    44 * scale,
  );
  const lineHeight = titleLayout.size * 0.96;
  const titleBlockHeight = titleLayout.lines.length * lineHeight;
  const titleTop = height * 0.43 - titleBlockHeight / 2;
  const titleX = margin + (1 - reveal) * 72 * scale;

  context.save();
  context.beginPath();
  context.rect(margin - 8 * scale, titleTop - 30 * scale,
    titleMaxWidth + 40 * scale, titleBlockHeight + 74 * scale);
  context.clip();
  context.globalAlpha = transition * reveal * finalFade;
  titleLayout.lines.forEach((line, index) => {
    text(context, line, titleX, titleTop + (index + 0.82) * lineHeight,
      titleLayout.size, PAPER, 900, 'left', SANS);
  });
  context.restore();

  const ruleY = titleTop + titleBlockHeight + 45 * scale;
  context.globalAlpha = transition * finalFade;
  context.fillStyle = 'rgba(200,245,66,.15)';
  context.fillRect(margin, ruleY, titleMaxWidth, Math.max(1, 2 * scale));
  context.fillStyle = ACID;
  context.fillRect(margin, ruleY, titleMaxWidth * reveal, Math.max(2, 4 * scale));

  context.globalAlpha = transition * detailsReveal * finalFade;
  const fragCount = card.fragCount ?? 0;
  const demoCount = card.demoCount ?? 0;
  text(context, `${fragCount} FRAGS`, margin, ruleY + 58 * scale,
    16 * scale, PAPER, 800, 'left', MONO);
  text(context, '/', margin + 142 * scale, ruleY + 58 * scale,
    16 * scale, '#626a60', 600, 'left', MONO);
  text(context, `${demoCount} DEMOS`, margin + 175 * scale, ruleY + 58 * scale,
    16 * scale, PAPER, 800, 'left', MONO);
  text(context, 'THANKS FOR WATCHING', margin, height * 0.82,
    13 * scale, ACID, 750, 'left', MONO);
  text(context, 'COUNTER-STRIKE LIVES FOREVER', width - margin, height * 0.91,
    10 * scale, '#596055', 600, 'right', MONO);

  const archiveNumber = String(fragCount).padStart(3, '0');
  context.save();
  context.globalAlpha = transition * reveal * finalFade;
  context.translate(width * 0.91, height * 0.68);
  context.rotate(-Math.PI / 2);
  context.font = `900 ${250 * scale}px ${SANS}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = Math.max(1.5, 2.5 * scale);
  context.strokeStyle = 'rgba(200,245,66,.09)';
  context.strokeText(archiveNumber, 0, 0);
  context.restore();
  context.restore();

  if (progress > 0.84) {
    context.fillStyle = `rgba(2,3,2,${smoothstep(0.84, 1, progress)})`;
    context.fillRect(0, 0, width, height);
  }
};

export const renderMovieSight = (
  context: CanvasRenderingContext2D,
  frame: MovieHudFrame,
) => {
  const { width, height } = context.canvas;
  if (frame.scope) {
    const radius = Math.min(width, height) * 0.5;
    context.save();
    context.fillStyle = '#000';
    context.beginPath();
    context.rect(0, 0, width, height);
    context.arc(width / 2, height / 2, radius, 0, Math.PI * 2, true);
    context.fill('evenodd');
    context.strokeStyle = 'rgba(0,0,0,.95)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height);
    context.stroke();
    context.restore();
  } else if (frame.crosshair) {
    const x = width / 2;
    const y = height / 2;
    const scale = width / 1280;
    const dimensions: Record<MovieCrosshairStyle, { gap: number; arm: number }> = {
      rifle: { gap: 5.5, arm: 6 },
      pistol: { gap: 4, arm: 5 },
      smg: { gap: 5, arm: 6 },
      heavy: { gap: 7, arm: 7 },
    };
    const { gap: baseGap, arm: baseArm } = dimensions[frame.crosshairStyle];
    const gap = baseGap * scale;
    const arm = baseArm * scale;
    context.save();
    context.strokeStyle = '#35ff35';
    context.lineWidth = Math.max(1, scale * 0.75);
    context.shadowColor = 'rgba(0,35,0,.9)';
    context.shadowBlur = Math.max(1, scale);
    context.beginPath();
    context.moveTo(x, y - gap);
    context.lineTo(x, y - gap - arm);
    context.moveTo(x, y + gap);
    context.lineTo(x, y + gap + arm);
    context.moveTo(x - gap, y);
    context.lineTo(x - gap - arm, y);
    context.moveTo(x + gap, y);
    context.lineTo(x + gap + arm, y);
    context.stroke();
    context.restore();
  }
};

const renderCinematic = (context: CanvasRenderingContext2D, frame: MovieHudFrame) => {
  const { width, height } = context.canvas;
  const scale = width / 1920;
  const opacity = frame.exiting ? 0.45 : 1;
  context.save();
  context.globalAlpha = opacity;

  const topWidth = 500 * scale;
  panel(context, (width - topWidth) / 2, 68 * scale, topWidth, 52 * scale, 0.7);
  text(context, frame.mapName.toUpperCase(), width / 2 - 155 * scale, 101 * scale, 15 * scale, PAPER, 500, 'left', MONO);
  text(context, frame.roundLabel, width / 2, 101 * scale, 15 * scale, ACID, 800, 'center', MONO);
  text(context, frame.timeLabel, width / 2 + 155 * scale, 101 * scale, 15 * scale, PAPER, 500, 'right', MONO);

  const boxX = width * 0.05;
  const boxY = height * 0.78;
  panel(context, boxX, boxY, 680 * scale, 142 * scale, 0.88);
  context.fillStyle = ACID;
  context.fillRect(boxX, boxY, 5 * scale, 142 * scale);
  context.strokeStyle = 'rgba(200,245,66,.65)';
  context.lineWidth = 2 * scale;
  context.beginPath();
  context.arc(boxX + 86 * scale, boxY + 71 * scale, 48 * scale, 0, Math.PI * 2);
  context.stroke();
  text(context, frame.score, boxX + 83 * scale, boxY + 82 * scale, 39 * scale, ACID, 850, 'center');
  text(context, '/100', boxX + 113 * scale, boxY + 83 * scale, 11 * scale, '#7f877c', 500, 'left', MONO);
  text(context, frame.phaseLabel, boxX + 160 * scale, boxY + 44 * scale, 13 * scale, ACID, 700, 'left', MONO);
  text(context, frame.killer.toUpperCase(), boxX + 160 * scale, boxY + 84 * scale, 34 * scale, PAPER, 800);
  text(context, frame.weaponSummary.toUpperCase(), boxX + 160 * scale, boxY + 112 * scale, 14 * scale, MUTED, 500, 'left', MONO);

  if (frame.fragLanded) {
    const confirmWidth = 350 * scale;
    const confirmX = width * 0.95 - confirmWidth;
    panel(context, confirmX, height * 0.80, confirmWidth, 92 * scale, 0.74);
    context.fillStyle = '#fff';
    context.fillRect(confirmX + confirmWidth - 3 * scale, height * 0.80, 3 * scale, 92 * scale);
    text(context, frame.headshot ? 'HEADSHOT' : 'FRAG', confirmX + confirmWidth - 24 * scale, height * 0.80 + 32 * scale, 13 * scale, ACID, 700, 'right', MONO);
    text(context, frame.victim.toUpperCase(), confirmX + confirmWidth - 24 * scale, height * 0.80 + 67 * scale, 27 * scale, PAPER, 800, 'right');
  }
  context.restore();
};

const killfeedColor = (side: MovieKillfeedEntry['killerSide']): string =>
  side === 'TERRORIST' ? '#e6a05b' : side === 'CT' ? '#7ea5e8' : PAPER;

const renderPresentationKillfeed = (
  context: CanvasRenderingContext2D,
  entries: readonly MovieKillfeedEntry[],
) => {
  const { width } = context.canvas;
  const scale = width / 1920;
  const rowHeight = 54 * scale;
  const right = width - 34 * scale;
  entries.slice(-4).reverse().forEach((entry, index) => {
    const y = 42 * scale + index * (rowHeight + 8 * scale);
    const opacity = entry.ageMs > 5_000
      ? Math.max(0, 1 - (entry.ageMs - 5_000) / 1_000)
      : 1;
    context.save();
    context.globalAlpha = opacity;
    context.font = `750 ${20 * scale}px ${SANS}`;
    const victimWidth = context.measureText(entry.victim.toUpperCase()).width;
    context.font = `700 ${14 * scale}px ${MONO}`;
    const weaponLabel = entry.headshot
      ? `${entry.weapon.toUpperCase()} · HS`
      : entry.weapon.toUpperCase();
    const weaponWidth = context.measureText(weaponLabel).width + 30 * scale;
    context.font = `750 ${20 * scale}px ${SANS}`;
    const killerWidth = context.measureText(entry.killer.toUpperCase()).width;
    const rowWidth = Math.min(width * 0.62, killerWidth + weaponWidth + victimWidth + 62 * scale);
    const left = right - rowWidth;
    panel(context, left, y, rowWidth, rowHeight, 0.76);
    context.fillStyle = 'rgba(200,245,66,.65)';
    context.fillRect(right - 2 * scale, y, 2 * scale, rowHeight);

    const baseline = y + 35 * scale;
    text(context, entry.victim.toUpperCase(), right - 18 * scale, baseline,
      20 * scale, killfeedColor(entry.victimSide), 750, 'right');
    const weaponRight = right - 30 * scale - victimWidth;
    panel(context, weaponRight - weaponWidth, y + 8 * scale, weaponWidth, 38 * scale, 0.9);
    text(context, weaponLabel, weaponRight - weaponWidth / 2, baseline,
      14 * scale, entry.headshot ? ACID : MUTED, 700, 'center', MONO);
    text(context, entry.killer.toUpperCase(), weaponRight - weaponWidth - 15 * scale, baseline,
      20 * scale, killfeedColor(entry.killerSide), 750, 'right');
    context.restore();
  });
};

const renderAnalyst = (context: CanvasRenderingContext2D, frame: MovieHudFrame) => {
  const { width, height } = context.canvas;
  const scale = width / 1920;
  context.save();
  context.globalAlpha = frame.exiting ? 0.45 : 1;
  const headerX = width * 0.04;
  const headerY = 64 * scale;
  const headerWidth = width * 0.92;
  panel(context, headerX, headerY, headerWidth, 78 * scale, 0.78);
  context.fillStyle = 'rgba(200,245,66,.65)';
  context.fillRect(headerX, headerY + 76 * scale, headerWidth, 2 * scale);
  text(context, 'REPLAY ANALYSIS', headerX + 24 * scale, headerY + 29 * scale, 12 * scale, '#788074', 600, 'left', MONO);
  text(context, `${frame.mapName} · ${frame.roundLabel}`.toUpperCase(), headerX + 24 * scale, headerY + 58 * scale, 21 * scale, PAPER, 750);
  text(context, frame.score, headerX + headerWidth - 120 * scale, headerY + 57 * scale, 43 * scale, ACID, 850, 'center');
  text(context, 'FRAG\nSCORE', headerX + headerWidth - 40 * scale, headerY + 40 * scale, 11 * scale, '#788074', 600, 'center', MONO);

  frame.reasons.slice(0, 4).forEach((reason, index) => {
    const y = headerY + 100 * scale + index * 47 * scale;
    panel(context, headerX, y, 320 * scale, 38 * scale, 0.66);
    text(context, reason.points > 0 ? `+${reason.points}` : reason.points, headerX + 20 * scale, y + 25 * scale, 15 * scale, ACID, 800, 'left', MONO);
    text(context, reason.label, headerX + 73 * scale, y + 25 * scale, 13 * scale, '#bac0b6', 500);
  });

  const situationWidth = 930 * scale;
  const situationX = (width - situationWidth) / 2;
  const situationY = height * 0.75;
  panel(context, situationX, situationY, situationWidth, 130 * scale, 0.9);
  context.fillStyle = '#70a7ff';
  context.fillRect(situationX, situationY, 150 * scale, 3 * scale);
  context.fillStyle = ACID;
  context.fillRect(situationX + 150 * scale, situationY, 630 * scale, 3 * scale);
  context.fillStyle = '#ed9a4f';
  context.fillRect(situationX + 780 * scale, situationY, 150 * scale, 3 * scale);
  text(context, 'CT ALIVE', situationX + 75 * scale, situationY + 42 * scale, 11 * scale, '#9cc2ff', 600, 'center', MONO);
  text(context, frame.counterTerroristsAlive, situationX + 75 * scale, situationY + 95 * scale, 43 * scale, '#9cc2ff', 800, 'center');
  text(context, frame.phaseLabel, width / 2, situationY + 34 * scale, 11 * scale, ACID, 700, 'center', MONO);
  text(context, frame.killer.toUpperCase(), width / 2, situationY + 72 * scale, 29 * scale, PAPER, 800, 'center');
  text(context, `${frame.weapon} → ${frame.victim}`, width / 2, situationY + 101 * scale, 13 * scale, MUTED, 500, 'center', MONO);
  text(context, 'T ALIVE', situationX + 855 * scale, situationY + 42 * scale, 11 * scale, '#ffc080', 600, 'center', MONO);
  text(context, frame.terroristsAlive, situationX + 855 * scale, situationY + 95 * scale, 43 * scale, '#ffc080', 800, 'center');

  const timelineWidth = 780 * scale;
  const timelineX = (width - timelineWidth) / 2;
  const timelineY = height * 0.94;
  text(context, '−3.0 S', timelineX - 18 * scale, timelineY + 4 * scale, 11 * scale, '#8d958a', 500, 'right', MONO);
  context.fillStyle = 'rgba(255,255,255,.25)';
  context.fillRect(timelineX, timelineY, timelineWidth, 3 * scale);
  context.fillStyle = ACID;
  context.beginPath();
  context.arc(timelineX + timelineWidth * frame.timelinePercent / 100, timelineY + 1.5 * scale, 7 * scale, 0, Math.PI * 2);
  context.fill();
  text(context, 'FRAG', timelineX + timelineWidth + 18 * scale, timelineY + 4 * scale, 11 * scale, '#8d958a', 500, 'left', MONO);
  context.restore();
};

const renderMovie = (context: CanvasRenderingContext2D, frame: MovieHudFrame) => {
  const { width, height } = context.canvas;
  const scale = width / 1920;
  context.save();
  context.globalAlpha = frame.exiting ? 0.45 : 1;
  context.fillStyle = '#000';
  context.fillRect(0, 0, width, height * 0.075);
  context.fillRect(0, height * 0.925, width, height * 0.075);
  const x = width * 0.07;
  const y = height * 0.78;
  context.fillStyle = ACID;
  context.fillRect(x, y, 3 * scale, 126 * scale);
  text(context, frame.phaseLabel, x + 28 * scale, y + 28 * scale, 13 * scale, ACID, 700, 'left', MONO);
  text(context, frame.killer.toUpperCase(), x + 28 * scale, y + 78 * scale, 48 * scale, PAPER, 850);
  text(context, `${frame.headshot ? 'HEADSHOT' : frame.weapon} · ${frame.score}/100`, x + 28 * scale, y + 108 * scale, 14 * scale, '#d2d7cf', 500, 'left', MONO);
  if (frame.fragLanded) {
    text(context, frame.weapon.toUpperCase(), width * 0.93, y + 35 * scale, 13 * scale, ACID, 700, 'right', MONO);
    text(context, frame.victim.toUpperCase(), width * 0.93, y + 79 * scale, 29 * scale, PAPER, 800, 'right');
  }
  context.restore();
};

export const renderMovieHud = (
  context: CanvasRenderingContext2D,
  frame: MovieHudFrame | undefined,
) => {
  if (!frame || frame.preset === 'original' || frame.preset === 'clean') return;
  renderMovieSight(context, frame);
  renderPresentationKillfeed(context, frame.killfeed);
  if (!frame.presentation) return;
  if (frame.preset === 'cinematic') renderCinematic(context, frame);
  else if (frame.preset === 'analyst') renderAnalyst(context, frame);
  else renderMovie(context, frame);
};
