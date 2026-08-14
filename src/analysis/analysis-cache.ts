import { get, set } from 'idb-keyval';
import type { DemoAnalysisIndex } from '/@/analysis/schema';

const CACHE_PREFIX = 'hltv-replay-analysis:';

const isCurrentIndex = (value: unknown): value is DemoAnalysisIndex => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DemoAnalysisIndex>;
  return candidate.schemaVersion === 2
    && typeof candidate.cacheId === 'string'
    && Array.isArray(candidate.events)
    && Array.isArray(candidate.players);
};

export const loadAnalysisIndex = async (
  cacheId: string,
): Promise<DemoAnalysisIndex | undefined> => {
  const cached: unknown = await get(`${CACHE_PREFIX}${cacheId}`);
  return isCurrentIndex(cached) && cached.cacheId === cacheId
    ? cached
    : undefined;
};

export const saveAnalysisIndex = async (
  index: DemoAnalysisIndex,
): Promise<void> => {
  await set(`${CACHE_PREFIX}${index.cacheId}`, index);
};
