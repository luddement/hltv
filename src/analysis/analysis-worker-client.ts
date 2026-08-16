import type {
  AnalysisProgress,
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
} from '/@/analysis/analysis-worker-protocol';
import type { DemoAnalysisIndex } from '/@/analysis/schema';
import type { DemoSource, GoldSrcDemo } from '/@/demo/goldsrc-demo';

export type WorkerAnalysisResult = {
  index: DemoAnalysisIndex;
  buffer: ArrayBuffer;
  cacheHit: boolean;
};

export type WorkerAnalysisRun = {
  promise: Promise<WorkerAnalysisResult>;
  cancel: () => void;
};

export const analyzeDemoInWorker = (
  demo: GoldSrcDemo,
  source: DemoSource,
  onProgress: (progress: AnalysisProgress) => void,
): WorkerAnalysisRun => {
  const worker = new Worker(new URL('./analysis-worker.ts', import.meta.url), {
    type: 'module',
  });
  let settled = false;
  let rejectRun: (reason?: unknown) => void = () => undefined;

  const finish = (): void => {
    settled = true;
    worker.terminate();
  };

  const promise = new Promise<WorkerAnalysisResult>((resolve, reject) => {
    rejectRun = reject;
    worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress(message.progress);
        return;
      }
      finish();
      if (message.type === 'error') {
        reject(new Error(message.message));
        return;
      }
      resolve({
        index: message.index,
        buffer: message.buffer,
        cacheHit: message.cacheHit,
      });
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || 'The analysis worker stopped unexpectedly.'));
    };
  });

  const request: AnalysisWorkerRequest = {
    type: 'analyze',
    demo: {
      ...demo,
      directory: demo.directory.map((entry) => ({ ...entry })),
    },
    source: source.kind === 'file'
      ? { kind: 'file', name: source.name, file: source.file }
      : { kind: 'url', name: source.name, url: source.url },
  };
  try {
    worker.postMessage(request);
  } catch (error) {
    finish();
    rejectRun(error);
  }

  return {
    promise,
    cancel: () => {
      if (settled) return;
      finish();
      rejectRun(new DOMException('Analysis cancelled.', 'AbortError'));
    },
  };
};
