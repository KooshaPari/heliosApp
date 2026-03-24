export * from "./protected-paths-types.js";
export {
  DEFAULT_PATTERNS,
  matchesPattern,
  extractFilePaths,
  redactCommandForAudit,
} from "./protected-paths-matching.js";
export { ProtectedPathConfig } from "./protected-paths-config.js";
export { ProtectedPathDetector } from "./protected-paths-detector.js";
