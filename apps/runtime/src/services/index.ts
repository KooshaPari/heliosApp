/**
 * @helios/runtime Services - Unified runtime service APIs
 *
 * This module aggregates the public APIs of all major runtime services:
 * - **PTY Service**: Pseudo-terminal management (spawning, I/O, signals)
 * - **Renderer Service**: UI rendering with switching and recovery
 * - **Secrets Service**: Credential and sensitive data management
 * - **Lanes Service**: Workspace/lane orchestration and management
 *
 * Each service maintains its own internal module structure and exports
 * a public API through its respective index.ts.
 *
 * @module services
 */

export type { LaneManager } from "./lanes/index.js";
// Lanes Service
export * as lanesService from "./lanes/index.js";
// Re-export key types for convenience
export type { PtyManager } from "./pty/index.js";
// PTY Service
export * as ptyService from "./pty/index.js";
export type { RendererRegistry, RendererStateMachine } from "./renderer/index.js";
// Renderer Service
export * as rendererService from "./renderer/index.js";
export type { CredentialStore, RedactionEngine } from "./secrets/index.js";
// Secrets Service
export * as secretsService from "./secrets/index.js";
