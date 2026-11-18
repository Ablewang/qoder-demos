import type { BufferGeometry, Material, Mesh } from "three";

// Mesh whose material kind is only known at runtime (checked via isXxxMaterial flags).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMesh = Mesh<BufferGeometry, any>;

export interface TextBatch {
  count: number;
  material?: Material | null;
  size?: number[];
  update(dt?: number): void;
}
