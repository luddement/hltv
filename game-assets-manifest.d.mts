export type GameAssetManifestEntry = {
  path: string;
  url: string;
  size: number;
};

export function createGameAssetManifest(options: {
  gameAssetsDirectory: string;
  demoAssetPaths: Set<string>;
  requestedMap?: string;
  requestedChecksum?: number;
}): GameAssetManifestEntry[];
