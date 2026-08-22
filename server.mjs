import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameAssetManifest } from './game-assets-manifest.mjs';
import { formatGoldSrcChecksum } from './goldsrc-map-crc.mjs';
import { handleDemoCommentsRequest } from './demo-comments-store.mjs';

const appDirectory = dirname(fileURLToPath(import.meta.url));
const distDirectory = resolve(appDirectory, 'dist');
const demoPath = resolve(appDirectory, '../r60_sthlm.dem');
const demosDirectory = resolve(appDirectory, '../demos');
const demoAnalysisDirectory = resolve(appDirectory, '../demo-analysis');
const scoreboardImagesDirectory = resolve(
  process.env.HLTV_SCOREBOARD_IMAGES || resolve(appDirectory, '../scoreboard-screenshots'),
);
const commentsFile = resolve(process.env.HLTV_COMMENTS_FILE || resolve(appDirectory, '../demo-comments.json'));
const gameAssetsDirectory = resolve(appDirectory, 'game-assets');
const demoAssetPaths = new Set(
  JSON.parse(readFileSync(resolve(appDirectory, 'demo-assets.json'), 'utf8')),
);
const port = Number(process.env.HLTV_PORT || 4173);
const NO_CACHE = 'no-cache';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pk3': 'application/octet-stream',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

const sendFile = (
  request,
  response,
  filePath,
  allowRanges = false,
  cacheControl = NO_CACHE,
) => {
  const { size } = statSync(filePath);
  response.setHeader('Cache-Control', cacheControl);
  if (size === 0) {
    response.statusCode = 200;
    response.setHeader('Content-Type', mimeTypes[extname(filePath)] || 'application/octet-stream');
    response.setHeader('Content-Length', 0);
    response.end();
    return;
  }
  const range = allowRanges ? request.headers.range?.match(/^bytes=(\d+)-(\d*)$/) : null;
  const start = range ? Number(range[1]) : 0;
  const end = range ? Math.min(range[2] ? Number(range[2]) : size - 1, size - 1) : size - 1;

  response.statusCode = range ? 206 : 200;
  response.setHeader('Content-Type', mimeTypes[extname(filePath)] || 'application/octet-stream');
  response.setHeader('Content-Length', end - start + 1);
  if (allowRanges) response.setHeader('Accept-Ranges', 'bytes');
  if (range) response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
  createReadStream(filePath, { start, end }).pipe(response);
};

const archiveFile = (root, relativePath) => {
  const candidate = resolve(root, relativePath);
  return candidate.startsWith(`${root}${sep}`)
    && existsSync(candidate)
    && !statSync(candidate).isDirectory()
    ? candidate
    : undefined;
};

createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);

  if (handleDemoCommentsRequest(request, response, { commentsFile, demosDirectory })) return;

  if (requestPath === '/demos/r60_sthlm.dem') {
    sendFile(request, response, demoPath, true);
    return;
  }

  if (requestPath.startsWith('/demo-files/')) {
    const filePath = archiveFile(demosDirectory, requestPath.slice('/demo-files/'.length));
    if (filePath?.toLowerCase().endsWith('.dem')) {
      sendFile(request, response, filePath, true);
      return;
    }
    response.statusCode = 404;
    response.end('Demo not found.');
    return;
  }

  if (requestPath.startsWith('/demo-analysis/')) {
    const filePath = archiveFile(
      demoAnalysisDirectory,
      requestPath.slice('/demo-analysis/'.length),
    );
    if (filePath?.toLowerCase().endsWith('.dem.json')) {
      sendFile(request, response, filePath);
      return;
    }
    response.statusCode = 404;
    response.end('Demo analysis not found.');
    return;
  }

  if (requestPath.startsWith('/scoreboard-images/')) {
    const filePath = archiveFile(
      scoreboardImagesDirectory,
      requestPath.slice('/scoreboard-images/'.length),
    );
    if (filePath && /\/half-[12]\.(?:jpe?g|png)$/i.test(filePath)) {
      sendFile(request, response, filePath);
      return;
    }
    response.statusCode = 404;
    response.end('Scoreboard image not found.');
    return;
  }

  if (requestPath === '/game-assets-manifest.json') {
    const requestedMap = new URL(request.url || '/', 'http://localhost').searchParams
      .get('map')?.toLowerCase() || 'de_train';
    const checksumText = new URL(request.url || '/', 'http://localhost').searchParams
      .get('checksum')?.toLowerCase();
    const safeMap = /^[a-z0-9_]+$/.test(requestedMap) ? requestedMap : 'de_train';
    const requestedChecksum = checksumText && /^[0-9a-f]{8}$/.test(checksumText)
      ? Number.parseInt(checksumText, 16) >>> 0
      : undefined;
    const body = JSON.stringify(createGameAssetManifest({
      gameAssetsDirectory,
      demoAssetPaths,
      requestedMap: safeMap,
      requestedChecksum,
    }));
    if (requestedChecksum !== undefined) {
      response.setHeader('X-HLTV-Map-Checksum', formatGoldSrcChecksum(requestedChecksum));
    }
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', NO_CACHE);
    response.setHeader('Content-Length', Buffer.byteLength(body));
    response.end(body);
    return;
  }

  if (requestPath.startsWith('/game-assets/')) {
    const relativePath = requestPath.slice('/game-assets/'.length);
    const candidate = resolve(gameAssetsDirectory, relativePath);
    const safeCandidate = candidate.startsWith(`${gameAssetsDirectory}${sep}`) ? candidate : '';
    if (safeCandidate && existsSync(safeCandidate) && !statSync(safeCandidate).isDirectory()) {
      sendFile(request, response, safeCandidate, true, IMMUTABLE_CACHE);
      return;
    }
    response.statusCode = 404;
    response.end('Spelresursen saknas.');
    return;
  }

  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const candidate = resolve(distDirectory, relativePath);
  const safeCandidate = candidate.startsWith(`${distDirectory}${sep}`) ? candidate : '';
  const filePath = safeCandidate && existsSync(safeCandidate) && !statSync(safeCandidate).isDirectory()
    ? safeCandidate
    : resolve(distDirectory, 'index.html');

  if (!existsSync(filePath)) {
    response.statusCode = 404;
    response.end('Build missing. Run pnpm build first.');
    return;
  }

  sendFile(
    request,
    response,
    filePath,
    false,
    relativePath.startsWith('assets/') ? IMMUTABLE_CACHE : NO_CACHE,
  );
}).listen(port, '127.0.0.1', () => {
  console.log(`PRAXXA HLTV Player: http://127.0.0.1:${port}`);
});
