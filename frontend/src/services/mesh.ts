// TypeScript module shim for `@/src/services/mesh`. At runtime, Metro resolves
// `./mesh` to `mesh.web.ts` (web) or `mesh.native.ts` (native) via platform
// extensions. TypeScript cannot do platform resolution, so this file provides
// the shared types and re-exports the web implementation for type-checking.

export {
  startMesh,
  broadcastMeshMessage,
  sendMeshMessage,
  stopMesh,
} from "./mesh.web";
export type { MeshTransportStatus } from "./mesh.web";
