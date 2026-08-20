import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { handleDemoCommentsRequest } from '../demo-comments-store.mjs';

class MockRequest extends EventEmitter {
  method = 'GET';
  url = '/';
}

class MockResponse {
  statusCode = 0;
  headers = new Map<string, unknown>();
  body = '';
  private resolve!: () => void;
  readonly completed = new Promise<void>((resolve) => { this.resolve = resolve; });

  setHeader(name: string, value: unknown) {
    this.headers.set(name, value);
  }

  end(body = '') {
    this.body = String(body);
    this.resolve();
  }
}

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('demo comments store', () => {
  it('persists comments for a known shared demo and returns them', async () => {
    const root = mkdtempSync(join(tmpdir(), 'hltv-comments-'));
    temporaryDirectories.push(root);
    const demosDirectory = join(root, 'demos');
    const commentsFile = join(root, 'comments.json');
    mkdirSync(join(demosDirectory, '2005'), { recursive: true });
    writeFileSync(join(demosDirectory, '2005', 'match.dem'), 'HLDEMO');

    const postRequest = new MockRequest();
    postRequest.method = 'POST';
    postRequest.url = '/api/demo-comments';
    const postResponse = new MockResponse();
    expect(handleDemoCommentsRequest(postRequest, postResponse, {
      commentsFile,
      demosDirectory,
    })).toBe(true);
    postRequest.emit('data', Buffer.from(JSON.stringify({
      demoPath: '2005/match.dem',
      nickname: ' praxxa ',
      body: ' Great match. ',
    })));
    postRequest.emit('end');
    await postResponse.completed;
    expect(postResponse.statusCode).toBe(201);

    const getRequest = new MockRequest();
    getRequest.url = '/api/demo-comments?demo=2005%2Fmatch.dem';
    const getResponse = new MockResponse();
    handleDemoCommentsRequest(getRequest, getResponse, { commentsFile, demosDirectory });
    await getResponse.completed;
    expect(JSON.parse(getResponse.body).comments).toEqual([
      expect.objectContaining({
        demoPath: '2005/match.dem',
        nickname: 'praxxa',
        body: 'Great match.',
      }),
    ]);
    expect(JSON.parse(readFileSync(commentsFile, 'utf8')).comments).toHaveLength(1);
  });
});
