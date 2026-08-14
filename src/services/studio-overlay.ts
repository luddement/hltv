import * as THREE from 'three';
import type { HLViewerHandle } from '/@/vendor/hlviewer/hlviewer.js';
import {
  StudioModelAsset,
  type StudioModelInstance,
} from '/@/vendor/goldsrc-mdl/goldsrc-mdl';

type Resource = { index: number; name: string };
type EntityState = Record<string, number | boolean | undefined>;

type ReplayMap = {
  resources?: { models?: Resource[] };
};

type ReplayState = {
  entities?: Array<EntityState | undefined>;
  viewEntity?: number;
  viewModel?: number;
};

type InternalGame = {
  canvas: HTMLCanvasElement;
  context: { gl: WebGLRenderingContext };
  camera: {
    projectionMatrix: ArrayLike<number>;
    viewMatrix: ArrayLike<number>;
  };
  player: {
    replay?: { maps?: ReplayMap[] };
    state?: ReplayState;
    currentTime?: number;
  };
};

type RenderedModel = {
  instance: StudioModelInstance;
  modelIndex: number;
  path: string;
};

const numberValue = (entity: EntityState, key: string, fallback = 0): number => {
  const value = entity[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const coordinate = (entity: EntityState, key: string, axis: number): number =>
  numberValue(entity, `${key}[${axis}]`, numberValue(entity, key === 'origin' ? `origin${axis}` : `${key}${axis}`));

const normalizePath = (path: string): string => path.replace(/\\/g, '/').replace(/^\/+/, '');

/**
 * Adds GoldSrc Studio (.mdl) entities to HLViewer's existing WebGL canvas.
 * HLViewer draws the BSP first; this renderer deliberately keeps its depth buffer
 * so players and carried weapons are hidden correctly by walls.
 */
export class StudioOverlay {
  private readonly game: InternalGame;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly instances = new Map<string, RenderedModel>();
  private readonly assets = new Map<string, Promise<StudioModelAsset | null>>();
  private frameRequest = 0;
  private running = false;
  private firstVisibleReport = true;

  constructor(
    viewer: HLViewerHandle,
    private readonly assetRoot: string,
    private readonly report: (message: string, error: boolean) => void,
  ) {
    const game = viewer.game as InternalGame | undefined;
    if (!game?.context?.gl || !game.canvas) {
      throw new Error('HLViewer exponerade inte sin WebGL-yta.');
    }
    this.game = game;
    this.camera.matrixAutoUpdate = false;
    this.renderer = new THREE.WebGLRenderer({
      canvas: game.canvas,
      context: game.context.gl,
      alpha: false,
    });
    this.renderer.autoClear = false;
    this.renderer.sortObjects = true;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.frameRequest = requestAnimationFrame(this.draw);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameRequest);
    for (const rendered of this.instances.values()) {
      this.scene.remove(rendered.instance.root);
      rendered.instance.dispose();
    }
    this.instances.clear();
  }

  getVisibleCount(): number {
    let count = 0;
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.visible) count++;
    });
    return count;
  }

  private draw = (): void => {
    if (!this.running) return;
    this.frameRequest = requestAnimationFrame(this.draw);
    try {
      this.syncEntities();
      if (!this.instances.size) return;

      this.camera.projectionMatrix.fromArray(this.game.camera.projectionMatrix);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      this.camera.matrixWorldInverse.fromArray(this.game.camera.viewMatrix);
      this.camera.matrixWorld.copy(this.camera.matrixWorldInverse).invert();

      const gl = this.game.context.gl;
      this.renderer.resetState();
      this.renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      this.renderer.render(this.scene, this.camera);
      this.restoreViewerState(gl);

      if (this.firstVisibleReport && this.getVisibleCount()) {
        this.firstVisibleReport = false;
        this.report('Studio-overlay aktiv: spelare och vapen renderas från GoldSrc MDL.', false);
      }
    } catch (error) {
      this.running = false;
      this.report(
        `Modellrenderingen stannade: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    }
  };

  private syncEntities(): void {
    const replay = this.game.player.replay;
    const state = this.game.player.state;
    const map = replay?.maps?.[0];
    const resources = map?.resources?.models ?? [];
    const entities = state?.entities ?? [];
    if (!resources.length || !entities.length) return;

    const active = new Set<string>();
    entities.forEach((entity, entityIndex) => {
      if (!entity || entity.__remove || numberValue(entity, 'effects') & 128) return;
      const modelIndex = numberValue(entity, 'modelindex');
      if (!modelIndex || entityIndex === state?.viewEntity) return;

      this.syncModel(`entity:${entityIndex}`, entity, modelIndex, resources, active);

      const weaponModel = numberValue(entity, 'weaponmodel');
      if (weaponModel) {
        this.syncModel(`weapon:${entityIndex}`, entity, weaponModel, resources, active, true);
      }
    });

    for (const [key, rendered] of this.instances) {
      if (active.has(key)) continue;
      this.scene.remove(rendered.instance.root);
      rendered.instance.dispose();
      this.instances.delete(key);
    }
  }

  private syncModel(
    key: string,
    entity: EntityState,
    modelIndex: number,
    resources: Resource[],
    active: Set<string>,
    weapon = false,
  ): void {
    const resource = resources.find((candidate) => candidate.index === modelIndex);
    if (!resource || !resource.name.toLowerCase().endsWith('.mdl')) return;
    const path = normalizePath(resource.name);
    active.add(key);

    const rendered = this.instances.get(key);
    if (!rendered || rendered.modelIndex !== modelIndex) {
      if (rendered) {
        this.scene.remove(rendered.instance.root);
        rendered.instance.dispose();
        this.instances.delete(key);
      }
      void this.attachModel(key, modelIndex, path);
      return;
    }

    const root = rendered.instance.root;
    root.position.set(
      coordinate(entity, 'origin', 0),
      coordinate(entity, 'origin', 1),
      coordinate(entity, 'origin', 2),
    );
    root.rotation.set(
      THREE.MathUtils.degToRad(coordinate(entity, 'angles', 2)),
      THREE.MathUtils.degToRad(coordinate(entity, 'angles', 0)),
      THREE.MathUtils.degToRad(coordinate(entity, 'angles', 1)),
      'ZYX',
    );
    const sequence = weapon ? 0 : numberValue(entity, 'sequence');
    const normalizedFrame = numberValue(entity, 'frame') / 256;
    const playerModel = weapon
      ? this.instances.get(key.replace('weapon:', 'entity:'))?.instance
      : undefined;
    const gaitSequence = numberValue(entity, 'gaitsequence');
    const gait = !weapon && gaitSequence
      ? {
          sequenceIndex: gaitSequence,
          time: this.game.player.currentTime ?? 0,
          framerate: numberValue(entity, 'framerate', 1),
        }
      : undefined;
    rendered.instance.update(
      sequence,
      normalizedFrame,
      numberValue(entity, 'body'),
      [numberValue(entity, 'blending[0]'), numberValue(entity, 'blending[1]')],
      gait,
      playerModel,
    );
  }

  private async attachModel(key: string, modelIndex: number, path: string): Promise<void> {
    const asset = await this.loadAsset(path);
    if (!asset || !this.running || this.instances.has(key)) return;
    const instance = asset.createInstance();
    instance.root.name = key;
    this.instances.set(key, { instance, modelIndex, path });
    this.scene.add(instance.root);
  }

  private loadAsset(path: string): Promise<StudioModelAsset | null> {
    const cacheKey = path.toLowerCase();
    const cached = this.assets.get(cacheKey);
    if (cached) return cached;
    const pending = fetch(`${this.assetRoot}/${path}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
        return StudioModelAsset.parse(await response.arrayBuffer());
      })
      .catch((error) => {
        this.report(
          `Kunde inte läsa ${path}: ${error instanceof Error ? error.message : String(error)}`,
          true,
        );
        return null;
      });
    this.assets.set(cacheKey, pending);
    return pending;
  }

  private restoreViewerState(gl: WebGLRenderingContext): void {
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    gl.activeTexture(gl.TEXTURE0);
  }
}
