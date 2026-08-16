import { loadAnalysisIndex, saveAnalysisIndex } from '/@/analysis/analysis-cache';
import type {
  AnalysisProgress,
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
} from '/@/analysis/analysis-worker-protocol';
import type { DemoSource } from '/@/demo/goldsrc-demo';

type WorkerScope = {
  onmessage: ((event: MessageEvent<AnalysisWorkerRequest>) => void) | null;
  postMessage: (message: AnalysisWorkerResponse, transfer?: Transferable[]) => void;
};

const workerScope = self as unknown as WorkerScope;

const installParserEnvironment = (): void => {
  const workerGlobal = globalThis as unknown as Record<string, unknown>;
  workerGlobal.window ??= globalThis;
  workerGlobal.document ??= {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
};

const report = (progress: AnalysisProgress): void => {
  workerScope.postMessage({ type: 'progress', progress });
};

const readSource = async (
  source: DemoSource,
  expectedSize: number,
): Promise<ArrayBuffer> => {
  const response = source.kind === 'url' ? await fetch(source.url) : undefined;
  if (response && !response.ok) {
    throw new Error(`Could not fetch the demo (${response.status}).`);
  }

  const stream = source.kind === 'file' ? source.file.stream() : response?.body;
  if (!stream) {
    throw new Error('The browser could not stream the demo to the analysis worker.');
  }

  const reader = stream.getReader();
  const output = new Uint8Array(expectedSize);
  let offset = 0;
  report({ phase: 'reading', current: 0, total: expectedSize });

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (offset + value.byteLength > output.byteLength) {
      throw new Error('The demo was larger than the size reported during inspection.');
    }
    output.set(value, offset);
    offset += value.byteLength;
    report({ phase: 'reading', current: offset, total: expectedSize });
  }

  if (offset !== expectedSize) {
    throw new Error(`The demo changed size during analysis (${offset} of ${expectedSize} bytes).`);
  }
  return output.buffer;
};

const runAnalysis = async ({ demo, source }: AnalysisWorkerRequest): Promise<void> => {
  const buffer = await readSource(source, demo.size);
  installParserEnvironment();
  const { analyzeDemo, prepareAnalysisIdentity } = await import('/@/analysis/demo-analyzer');
  report({ phase: 'hashing', current: null, total: null });
  const identity = await prepareAnalysisIdentity(buffer, demo.compatibilityProfile);

  report({ phase: 'cache', current: null, total: null });
  let index = await loadAnalysisIndex(identity.cacheId);
  const cacheHit = Boolean(index);
  if (!index) {
    index = analyzeDemo(buffer, demo, identity, report);
    report({ phase: 'saving', current: null, total: null });
    await saveAnalysisIndex(index);
  }

  const response: AnalysisWorkerResponse = {
    type: 'complete',
    index,
    buffer,
    cacheHit,
  };
  workerScope.postMessage(response, [buffer]);
};

workerScope.onmessage = (event) => {
  if (event.data.type !== 'analyze') return;
  void runAnalysis(event.data).catch((error: unknown) => {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Kunde inte analysera demot.',
    });
  });
};
