import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_NICKNAME_LENGTH = 32;
const MAX_COMMENT_LENGTH = 1_000;

const sendJson = (response, statusCode, value) => {
  const body = JSON.stringify(value);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  response.end(body);
};

const readStore = (commentsFile) => {
  try {
    const value = JSON.parse(readFileSync(commentsFile, 'utf8'));
    return value?.version === 1 && Array.isArray(value.comments)
      ? value
      : { version: 1, comments: [] };
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, comments: [] };
    throw error;
  }
};

const writeStore = (commentsFile, store) => {
  mkdirSync(dirname(commentsFile), { recursive: true });
  const temporaryFile = `${commentsFile}.${process.pid}.tmp`;
  writeFileSync(temporaryFile, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryFile, commentsFile);
};

const validDemoPath = (demosDirectory, demoPath) => {
  if (typeof demoPath !== 'string'
    || !demoPath.toLowerCase().endsWith('.dem')
    || demoPath.includes('\\')) return false;
  const candidate = resolve(demosDirectory, demoPath);
  return candidate.startsWith(`${demosDirectory}${sep}`)
    && existsSync(candidate)
    && !statSync(candidate).isDirectory();
};

const cleanText = (value, maximumLength) => typeof value === 'string'
  ? value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, maximumLength)
  : '';

export const handleDemoCommentsRequest = (
  request,
  response,
  { commentsFile, demosDirectory },
) => {
  const url = new URL(request.url || '/', 'http://localhost');
  if (url.pathname !== '/api/demo-comments') return false;

  if (request.method === 'GET') {
    const demoPath = url.searchParams.get('demo') || '';
    if (!validDemoPath(demosDirectory, demoPath)) {
      sendJson(response, 400, { error: 'Unknown demo.' });
      return true;
    }
    const store = readStore(commentsFile);
    sendJson(response, 200, {
      comments: store.comments
        .filter((comment) => comment.demoPath === demoPath)
        .slice(-200),
    });
    return true;
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return true;
  }

  let size = 0;
  const chunks = [];
  request.on('data', (chunk) => {
    size += chunk.length;
    if (size <= MAX_REQUEST_BYTES) chunks.push(chunk);
  });
  request.on('end', () => {
    if (size > MAX_REQUEST_BYTES) {
      sendJson(response, 413, { error: 'Comment is too large.' });
      return;
    }
    try {
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const demoPath = input.demoPath;
      const nickname = cleanText(input.nickname, MAX_NICKNAME_LENGTH);
      const body = cleanText(input.body, MAX_COMMENT_LENGTH);
      if (!validDemoPath(demosDirectory, demoPath)) {
        sendJson(response, 400, { error: 'Unknown demo.' });
        return;
      }
      if (!nickname || !body) {
        sendJson(response, 400, { error: 'Nickname and comment are required.' });
        return;
      }
      const comment = {
        id: randomUUID(),
        demoPath,
        nickname,
        body,
        createdAt: new Date().toISOString(),
      };
      const store = readStore(commentsFile);
      store.comments.push(comment);
      writeStore(commentsFile, store);
      sendJson(response, 201, { comment });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid comment.' });
    }
  });
  return true;
};
