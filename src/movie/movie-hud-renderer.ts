export type ExportHudPreset = 'original' | 'cinematic' | 'analyst' | 'movie' | 'clean';
export type MovieCrosshairStyle = 'rifle' | 'pistol' | 'smg' | 'heavy';

export type MovieHudReason = { points: number; label: string };

export type MovieIntroCard = {
  teams: [string, string];
  matchDate: string;
  mapName: string;
  focusKind: 'player' | 'team' | 'match';
  focusLabel: string;
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

export const renderMovieIntro = (
  context: CanvasRenderingContext2D,
  card: MovieIntroCard,
) => {
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
  text(context, 'HLTV REPLAY LAB / ENDAST FRAGS', width * 0.075, height * 0.105,
    14 * scale, ACID, 700, 'left', MONO);
  if (card.matchDate) {
    text(context, 'MATCHDATUM', centerX, height * 0.175,
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
    ? 'FÖLJER SPELARE'
    : card.focusKind === 'team'
      ? 'FÖLJER LAG'
      : 'VISAR FRAGS FRÅN';
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
  if (!frame.presentation) return;
  if (frame.preset === 'cinematic') renderCinematic(context, frame);
  else if (frame.preset === 'analyst') renderAnalyst(context, frame);
  else renderMovie(context, frame);
};
