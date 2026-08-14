/*
 * GoldSrc Studio Model v10 parser/renderer support.
 * Adapted from the MIT-licensed KoS GoldSrc MDL implementation:
 * https://github.com/lorikjashari/kos
 * Copyright (c) 2026 KoS. See LICENSE in this directory.
 */
import * as THREE from 'three';

const MAGIC = 0x54534449;
const VERSION = 10;
const STUDIO_RLOOP = 0x8000;
const STUDIO_TYPES = 0x7fff;
const STUDIO_X = 0x0001;
const STUDIO_Y = 0x0002;
const STUDIO_Z = 0x0004;
const STUDIO_XR = 0x0008;
const STUDIO_YR = 0x0010;
const STUDIO_ZR = 0x0020;

type Bone = {
  name: string;
  parent: number;
  controller: number[];
  value: number[];
  scale: number[];
};

type BoneController = {
  type: number;
  start: number;
  index: number;
};

type Sequence = {
  fps: number;
  numFrames: number;
  animIndex: number;
  numBlends: number;
};

type BonePose = { position: THREE.Vector3; rotation: THREE.Quaternion };
type GaitState = { sequenceIndex: number; time: number; framerate: number };

type Texture = {
  width: number;
  height: number;
  rgba: Uint8Array;
};

type MeshSource = {
  vertices: Float32Array;
  uv: Float32Array;
  vertexIndices: Int16Array;
  boneIndices: Uint8Array;
  textureIndex: number;
};

type SubModelSource = { meshes: MeshSource[] };
type BodyPartSource = { base: number; models: SubModelSource[] };

type RenderPart = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  source: MeshSource;
};

type RenderBodyPart = {
  base: number;
  models: Array<{ group: THREE.Group; parts: RenderPart[] }>;
};

const readString = (data: Uint8Array, offset: number, length: number): string => {
  let result = '';
  for (let index = offset; index < offset + length && data[index]; index++) {
    result += String.fromCharCode(data[index]!);
  }
  return result;
};

const signedShort = (view: DataView, offset: number): number => view.getInt16(offset, true);

const decodeTexture = (
  data: Uint8Array,
  name: string,
  width: number,
  height: number,
  offset: number,
): Texture => {
  const rgba = new Uint8Array(width * height * 4);
  const paletteOffset = offset + width * height;
  const masked = name.startsWith('{');
  for (let index = 0; index < width * height; index++) {
    const color = data[offset + index]!;
    const target = index * 4;
    rgba[target] = data[paletteOffset + color * 3]!;
    rgba[target + 1] = data[paletteOffset + color * 3 + 1]!;
    rgba[target + 2] = data[paletteOffset + color * 3 + 2]!;
    rgba[target + 3] = masked && color === 255 ? 0 : 255;
  }
  return { width, height, rgba };
};

const readFaces = (
  view: DataView,
  triOffset: number,
  rawVertices: Float32Array,
  texture: Texture,
) => {
  const rows: number[][] = [];
  let offset = triOffset;
  while (true) {
    const command = signedShort(view, offset);
    if (command === 0) break;
    const fan = command < 0;
    const count = Math.abs(command);
    offset += 2;
    let first: number[] | undefined;

    for (let index = 0; index < count; index++) {
      const vertexIndex = signedShort(view, offset);
      const s = signedShort(view, offset + 4);
      const t = signedShort(view, offset + 6);
      offset += 8;
      const row = [
        rawVertices[vertexIndex * 3]!,
        rawVertices[vertexIndex * 3 + 1]!,
        rawVertices[vertexIndex * 3 + 2]!,
        s / texture.width,
        1 - t / texture.height,
        vertexIndex,
      ];

      if (!fan && index > 2) {
        if (index % 2 === 0) rows.push(rows[rows.length - 3]!, rows[rows.length - 1]!);
        else rows.push(rows[rows.length - 1]!, rows[rows.length - 2]!);
      }
      if (fan) {
        first ??= row;
        if (index > 2) rows.push(first, rows[rows.length - 1]!);
      }
      rows.push(row);
    }
  }

  const vertices = new Float32Array(rows.length * 3);
  const uv = new Float32Array(rows.length * 2);
  const vertexIndices = new Int16Array(rows.length);
  rows.forEach((row, index) => {
    vertices.set(row.slice(0, 3), index * 3);
    uv.set(row.slice(3, 5), index * 2);
    vertexIndices[index] = row[5]!;
  });
  return { vertices, uv, vertexIndices };
};

const quaternion = (pitch: number, roll: number, yaw: number): THREE.Quaternion => {
  const cy = Math.cos(yaw * 0.5);
  const sy = Math.sin(yaw * 0.5);
  const cp = Math.cos(roll * 0.5);
  const sp = Math.sin(roll * 0.5);
  const cr = Math.cos(pitch * 0.5);
  const sr = Math.sin(pitch * 0.5);
  return new THREE.Quaternion(
    sr * cp * cy - cr * sp * sy,
    cr * sp * cy + sr * cp * sy,
    cr * cp * sy - sr * sp * cy,
    cr * cp * cy + sr * sp * sy,
  );
};

export class StudioModelInstance {
  readonly root = new THREE.Group();
  private bodyParts: RenderBodyPart[] = [];
  private lastSequence = -1;
  private lastFrame = -1;
  private lastBody = -1;
  private lastBlending = [-1, -1];
  private lastGaitFrame = -1;
  private lastGaitSequence = -1;
  private lastMergeRevision = -1;
  private transforms: Float32Array[] = [];
  private revision = 0;

  constructor(private asset: StudioModelAsset) {
    for (const bodyPart of asset.bodyParts) {
      const renderBodyPart: RenderBodyPart = { base: bodyPart.base, models: [] };
      for (const submodel of bodyPart.models) {
        const group = new THREE.Group();
        const parts: RenderPart[] = [];
        for (const source of submodel.meshes) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(source.vertices.slice(), 3));
          geometry.setAttribute('uv', new THREE.BufferAttribute(source.uv.slice(), 2));
          const mesh = new THREE.Mesh(geometry, asset.materials[source.textureIndex]!);
          mesh.frustumCulled = false;
          group.add(mesh);
          parts.push({ mesh, source });
        }
        group.visible = false;
        this.root.add(group);
        renderBodyPart.models.push({ group, parts });
      }
      this.bodyParts.push(renderBodyPart);
    }
    this.update(0, 0, 0);
  }

  update(
    sequenceIndex: number,
    normalizedFrame: number,
    body: number,
    blending: [number, number] = [0, 0],
    gait?: GaitState,
    boneMerge?: StudioModelInstance,
  ): void {
    const safeSequence = Math.min(
      Math.max(0, sequenceIndex || 0),
      Math.max(0, this.asset.sequences.length - 1),
    );
    const sequence = this.asset.sequences[safeSequence];
    const frame = sequence
      ? Math.max(0, Math.min(sequence.numFrames - 1, normalizedFrame * (sequence.numFrames - 1)))
      : 0;
    const roundedFrame = Math.round(frame * 8) / 8;
    const gaitSequence = gait ? this.asset.sequences[gait.sequenceIndex] : undefined;
    const gaitFrame = gaitSequence && gait
      ? (gait.time * gaitSequence.fps * gait.framerate) % Math.max(1, gaitSequence.numFrames - 1)
      : 0;
    const roundedGaitFrame = Math.round(gaitFrame * 8) / 8;
    if (
      safeSequence === this.lastSequence &&
      roundedFrame === this.lastFrame &&
      body === this.lastBody &&
      blending[0] === this.lastBlending[0] &&
      blending[1] === this.lastBlending[1] &&
      (gait?.sequenceIndex ?? -1) === this.lastGaitSequence &&
      roundedGaitFrame === this.lastGaitFrame &&
      (!boneMerge || boneMerge.revision === this.lastMergeRevision)
    ) return;

    this.lastSequence = safeSequence;
    this.lastFrame = roundedFrame;
    this.lastBody = body;
    this.lastBlending = [...blending];
    this.lastGaitSequence = gait?.sequenceIndex ?? -1;
    this.lastGaitFrame = roundedGaitFrame;
    this.lastMergeRevision = boneMerge?.revision ?? -1;
    this.transforms = this.asset.boneTransforms(
      safeSequence,
      roundedFrame,
      blending,
      gait ? { ...gait, time: roundedGaitFrame } : undefined,
    );
    this.revision++;
    const renderTransforms = boneMerge
      ? this.mergeBoneTransforms(boneMerge)
      : this.transforms;

    for (const bodyPart of this.bodyParts) {
      const selected = bodyPart.models.length
        ? Math.floor(body / Math.max(1, bodyPart.base)) % bodyPart.models.length
        : 0;
      bodyPart.models.forEach((model, index) => {
        model.group.visible = index === selected;
        if (!model.group.visible) return;
        for (const part of model.parts) {
          const destination = part.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
          const output = destination.array as Float32Array;
          const source = part.source;
          for (let vertex = 0; vertex < source.vertexIndices.length; vertex++) {
            const bone = source.boneIndices[source.vertexIndices[vertex]!]!;
            const matrix = renderTransforms[bone] ?? renderTransforms[0]!;
            const x = source.vertices[vertex * 3]!;
            const y = source.vertices[vertex * 3 + 1]!;
            const z = source.vertices[vertex * 3 + 2]!;
            output[vertex * 3] = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!;
            output[vertex * 3 + 1] = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!;
            output[vertex * 3 + 2] = matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!;
          }
          destination.needsUpdate = true;
        }
      });
    }
  }

  private transformForBone(name: string): Float32Array | undefined {
    const index = this.asset.bones.findIndex((bone) => bone.name === name);
    return index === -1 ? undefined : this.transforms[index];
  }

  private mergeBoneTransforms(source: StudioModelInstance): Float32Array[] {
    const merged: Float32Array[] = [];
    this.asset.bones.forEach((bone, index) => {
      const external = source.transformForBone(bone.name);
      if (external) {
        merged.push(external);
        return;
      }
      const own = new THREE.Matrix4().fromArray(this.transforms[index]!);
      if (bone.parent === -1) {
        merged.push(own.toArray() as unknown as Float32Array);
        return;
      }
      const ownParentInverse = new THREE.Matrix4()
        .fromArray(this.transforms[bone.parent]!)
        .invert();
      const local = new THREE.Matrix4().multiplyMatrices(ownParentInverse, own);
      const world = new THREE.Matrix4().multiplyMatrices(
        new THREE.Matrix4().fromArray(merged[bone.parent]!),
        local,
      );
      merged.push(world.toArray() as unknown as Float32Array);
    });
    return merged;
  }

  dispose(): void {
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
  }
}

export class StudioModelAsset {
  readonly materials: THREE.MeshBasicMaterial[];

  private constructor(
    private data: Uint8Array,
    private view: DataView,
    readonly bones: Bone[],
    private controllers: BoneController[],
    readonly sequences: Sequence[],
    readonly bodyParts: BodyPartSource[],
    textures: Texture[],
  ) {
    this.materials = textures.map((texture) => {
      const map = new THREE.DataTexture(
        texture.rgba,
        texture.width,
        texture.height,
        THREE.RGBAFormat,
      );
      map.needsUpdate = true;
      map.flipY = true;
      map.magFilter = THREE.LinearFilter;
      map.minFilter = THREE.LinearFilter;
      map.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({
        map,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.4,
      });
    });
  }

  static parse(buffer: ArrayBuffer): StudioModelAsset {
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);
    if (view.getInt32(0, true) !== MAGIC || view.getInt32(4, true) !== VERSION) {
      throw new Error('Spelmodellen är inte GoldSrc MDL v10.');
    }

    const bones: Bone[] = [];
    const boneCount = view.getInt32(140, true);
    const boneOffset = view.getInt32(144, true);
    for (let index = 0; index < boneCount; index++) {
      const offset = boneOffset + index * 112;
      bones.push({
        name: readString(data, offset, 32),
        parent: view.getInt32(offset + 32, true),
        controller: Array.from({ length: 6 }, (_, axis) =>
          view.getInt32(offset + 40 + axis * 4, true),
        ),
        value: Array.from({ length: 6 }, (_, axis) =>
          view.getFloat32(offset + 64 + axis * 4, true),
        ),
        scale: Array.from({ length: 6 }, (_, axis) =>
          view.getFloat32(offset + 88 + axis * 4, true),
        ),
      });
    }

    const controllers: BoneController[] = [];
    const controllerCount = view.getInt32(148, true);
    const controllerOffset = view.getInt32(152, true);
    for (let index = 0; index < controllerCount; index++) {
      const offset = controllerOffset + index * 24;
      controllers.push({
        type: view.getInt32(offset + 4, true),
        start: view.getFloat32(offset + 8, true),
        index: view.getInt32(offset + 20, true),
      });
    }

    const sequences: Sequence[] = [];
    const sequenceCount = view.getInt32(164, true);
    const sequenceOffset = view.getInt32(168, true);
    for (let index = 0; index < sequenceCount; index++) {
      const offset = sequenceOffset + index * 176;
      sequences.push({
        fps: view.getFloat32(offset + 32, true),
        numFrames: view.getInt32(offset + 56, true),
        numBlends: view.getInt32(offset + 120, true),
        animIndex: view.getInt32(offset + 124, true),
      });
    }

    const textures: Texture[] = [];
    const textureCount = view.getInt32(180, true);
    const textureOffset = view.getInt32(184, true);
    for (let index = 0; index < textureCount; index++) {
      const offset = textureOffset + index * 80;
      textures.push(
        decodeTexture(
          data,
          readString(data, offset, 64),
          view.getInt32(offset + 68, true),
          view.getInt32(offset + 72, true),
          view.getInt32(offset + 76, true),
        ),
      );
    }

    const skinReferenceCount = view.getInt32(192, true);
    const skinOffset = view.getInt32(200, true);
    const bodyParts: BodyPartSource[] = [];
    const bodyPartCount = view.getInt32(204, true);
    const bodyPartOffset = view.getInt32(208, true);
    for (let bodyIndex = 0; bodyIndex < bodyPartCount; bodyIndex++) {
      const offset = bodyPartOffset + bodyIndex * 76;
      const modelCount = view.getInt32(offset + 64, true);
      const base = view.getInt32(offset + 68, true);
      const modelOffset = view.getInt32(offset + 72, true);
      const models: SubModelSource[] = [];

      for (let modelIndex = 0; modelIndex < modelCount; modelIndex++) {
        const modelHeader = modelOffset + modelIndex * 112;
        const meshCount = view.getInt32(modelHeader + 72, true);
        const meshOffset = view.getInt32(modelHeader + 76, true);
        const vertexCount = view.getInt32(modelHeader + 80, true);
        const boneIndexOffset = view.getInt32(modelHeader + 84, true);
        const vertexOffset = view.getInt32(modelHeader + 88, true);
        const rawVertices = new Float32Array(vertexCount * 3);
        for (let vertex = 0; vertex < vertexCount * 3; vertex++) {
          rawVertices[vertex] = view.getFloat32(vertexOffset + vertex * 4, true);
        }
        const boneIndices = data.slice(boneIndexOffset, boneIndexOffset + vertexCount);
        const meshes: MeshSource[] = [];
        for (let meshIndex = 0; meshIndex < meshCount; meshIndex++) {
          const meshHeader = meshOffset + meshIndex * 20;
          const triOffset = view.getInt32(meshHeader + 4, true);
          const skinReference = view.getInt32(meshHeader + 8, true);
          const textureIndex = signedShort(
            view,
            skinOffset + 2 * (skinReference % Math.max(1, skinReferenceCount)),
          );
          const safeTextureIndex = textures[textureIndex] ? textureIndex : 0;
          const texture = textures[safeTextureIndex];
          if (!texture) continue;
          const faces = readFaces(view, triOffset, rawVertices, texture);
          meshes.push({ ...faces, boneIndices, textureIndex: safeTextureIndex });
        }
        models.push({ meshes });
      }
      bodyParts.push({ base, models });
    }

    return new StudioModelAsset(data, view, bones, controllers, sequences, bodyParts, textures);
  }

  createInstance(): StudioModelInstance {
    return new StudioModelInstance(this);
  }

  boneTransforms(
    sequenceIndex: number,
    frame: number,
    blending: [number, number] = [0, 0],
    gait?: GaitState,
  ): Float32Array[] {
    const sequence = this.sequences[sequenceIndex] ?? this.sequences[0];
    if (!sequence) return [new THREE.Matrix4().toArray() as unknown as Float32Array];
    const adjustment = new Array(this.controllers.length).fill(0);
    this.controllers.forEach((controller, index) => {
      let value = controller.start;
      if (controller.index <= 3 && controller.type & STUDIO_RLOOP) value = controller.start;
      switch (controller.type & STUDIO_TYPES) {
        case STUDIO_XR:
        case STUDIO_YR:
        case STUDIO_ZR:
          adjustment[index] = THREE.MathUtils.degToRad(value);
          break;
        case STUDIO_X:
        case STUDIO_Y:
        case STUDIO_Z:
          adjustment[index] = value;
      }
    });

    let pose: BonePose[];
    if (sequence.numBlends === 9) {
      const x = this.threeWayBlend(blending[0]);
      const y = this.threeWayBlend(blending[1]);
      const top = this.blendPoses(
        this.trackPose(sequence, frame, y.low * 3 + x.low, adjustment),
        this.trackPose(sequence, frame, y.low * 3 + x.high, adjustment),
        x.weight,
      );
      const bottom = this.blendPoses(
        this.trackPose(sequence, frame, y.high * 3 + x.low, adjustment),
        this.trackPose(sequence, frame, y.high * 3 + x.high, adjustment),
        x.weight,
      );
      pose = this.blendPoses(top, bottom, y.weight);
    } else if (sequence.numBlends === 4) {
      const x = THREE.MathUtils.clamp(blending[0] / 255, 0, 1);
      const y = THREE.MathUtils.clamp(blending[1] / 255, 0, 1);
      pose = this.blendPoses(
        this.blendPoses(
          this.trackPose(sequence, frame, 0, adjustment),
          this.trackPose(sequence, frame, 1, adjustment),
          x,
        ),
        this.blendPoses(
          this.trackPose(sequence, frame, 2, adjustment),
          this.trackPose(sequence, frame, 3, adjustment),
          x,
        ),
        y,
      );
    } else if (sequence.numBlends === 3) {
      const x = this.threeWayBlend(blending[0]);
      pose = this.blendPoses(
        this.trackPose(sequence, frame, x.low, adjustment),
        this.trackPose(sequence, frame, x.high, adjustment),
        x.weight,
      );
    } else if (sequence.numBlends > 1) {
      pose = this.blendPoses(
        this.trackPose(sequence, frame, 0, adjustment),
        this.trackPose(sequence, frame, 1, adjustment),
        THREE.MathUtils.clamp(blending[0] / 255, 0, 1),
      );
    } else {
      pose = this.trackPose(sequence, frame, 0, adjustment);
    }

    const gaitSequence = gait ? this.sequences[gait.sequenceIndex] : undefined;
    if (gaitSequence && gait && gait.sequenceIndex > 0) {
      const gaitPose = this.trackPose(gaitSequence, gait.time, 0, adjustment);
      let copyLowerBody = true;
      this.bones.forEach((bone, index) => {
        if (bone.name === 'Bip01 Spine') copyLowerBody = false;
        else if (bone.parent >= 0 && this.bones[bone.parent]?.name === 'Bip01 Pelvis') {
          copyLowerBody = true;
        }
        if (copyLowerBody) pose[index] = gaitPose[index]!;
      });
    }

    const transforms: Float32Array[] = [];
    pose.forEach((bonePose, boneIndex) => {
      const bone = this.bones[boneIndex]!;
      const local = new THREE.Matrix4().makeRotationFromQuaternion(bonePose.rotation);
      local.setPosition(bonePose.position);
      const world = bone.parent === -1
        ? local
        : new THREE.Matrix4().multiplyMatrices(
            new THREE.Matrix4().fromArray(transforms[bone.parent]!),
            local,
          );
      transforms.push(world.toArray() as unknown as Float32Array);
    });
    return transforms;
  }

  private trackPose(
    sequence: Sequence,
    frame: number,
    blendIndex: number,
    adjustment: number[],
  ): BonePose[] {
    const fraction = frame - Math.floor(frame);
    return this.bones.map((bone, boneIndex) => {
      const animationOffset =
        sequence.animIndex + (blendIndex * this.bones.length + boneIndex) * 12;
      const angles1 = bone.value.slice(3, 6);
      const angles2 = bone.value.slice(3, 6);
      const position = new THREE.Vector3(bone.value[0], bone.value[1], bone.value[2]);

      for (let axis = 0; axis < 6; axis++) {
        const sampled = this.sampleAnimation(animationOffset, axis, frame);
        if (sampled) {
          const [first, second] = sampled;
          if (axis < 3) {
            position.setComponent(
              axis,
              bone.value[axis]! + THREE.MathUtils.lerp(first, second, fraction) * bone.scale[axis]!,
            );
          } else {
            angles1[axis - 3] = bone.value[axis]! + first * bone.scale[axis]!;
            angles2[axis - 3] = bone.value[axis]! + second * bone.scale[axis]!;
          }
        }
        const controller = bone.controller[axis]!;
        if (controller !== -1) {
          if (axis < 3) {
            position.setComponent(axis, position.getComponent(axis) + (adjustment[controller] ?? 0));
          } else {
            angles1[axis - 3]! += adjustment[controller] ?? 0;
            angles2[axis - 3]! += adjustment[controller] ?? 0;
          }
        }
      }

      const rotation = quaternion(angles1[0]!, angles1[1]!, angles1[2]!).slerp(
        quaternion(angles2[0]!, angles2[1]!, angles2[2]!),
        fraction,
      );
      return { position, rotation };
    });
  }

  private sampleAnimation(
    animationOffset: number,
    axis: number,
    frame: number,
  ): [number, number] | undefined {
    const channelOffset = this.view.getUint16(animationOffset + axis * 2, true);
    if (!channelOffset) return undefined;
    let cursor = animationOffset + channelOffset;
    let key = Math.floor(frame);
    while (this.data[cursor + 1]! <= key && this.data[cursor + 1]) {
      key -= this.data[cursor + 1]!;
      cursor += this.data[cursor]! * 2 + 2;
    }
    const valid = this.data[cursor]!;
    const total = this.data[cursor + 1]!;
    const valueAt = (index: number) => signedShort(this.view, cursor + index * 2);
    const first = valid > key ? valueAt(key + 1) : valueAt(valid);
    const second =
      valid > key + 1 ? valueAt(key + 2) : total > key + 1 ? first : valueAt(valid + 2);
    return [first, second];
  }

  private threeWayBlend(value: number): { low: number; high: number; weight: number } {
    const safe = THREE.MathUtils.clamp(value, 0, 255);
    return safe <= 127
      ? { low: 0, high: 1, weight: (safe * 2) / 255 }
      : { low: 1, high: 2, weight: (2 * (safe - 127)) / 255 };
  }

  private blendPoses(first: BonePose[], second: BonePose[], amount: number): BonePose[] {
    const safe = THREE.MathUtils.clamp(amount, 0, 1);
    return first.map((pose, index) => ({
      position: pose.position.clone().lerp(second[index]!.position, safe),
      rotation: pose.rotation.clone().slerp(second[index]!.rotation, safe),
    }));
  }
}
