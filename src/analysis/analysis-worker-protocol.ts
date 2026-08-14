import type { DemoAnalysisIndex } from '/@/analysis/schema';
import type { DemoSource, GoldSrcDemo } from '/@/demo/goldsrc-demo';

export type AnalysisPhase =
  | 'reading'
  | 'hashing'
  | 'cache'
  | 'parsing'
  | 'indexing'
  | 'saving';

export type AnalysisProgress = {
  phase: AnalysisPhase;
  current: number | null;
  total: number | null;
  demoTimeMs?: number;
  directoryEntry?: number;
  directoryCount?: number;
};

export type AnalysisWorkerRequest = {
  type: 'analyze';
  demo: GoldSrcDemo;
  source: DemoSource;
};

export type AnalysisWorkerResponse =
  | { type: 'progress'; progress: AnalysisProgress }
  | {
      type: 'complete';
      index: DemoAnalysisIndex;
      buffer: ArrayBuffer;
      cacheHit: boolean;
    }
  | { type: 'error'; message: string };
