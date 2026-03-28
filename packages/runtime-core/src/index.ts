/**
 * @helios/runtime-core
 *
 * Shared runtime protocol, lanes, sessions, and integration layer.
 * Extracted from heliosApp and heliosApp-colab to eliminate the ~95% duplication
 * between the two repos (runtime/src is 95.4% identical per audit).
 *
 * Phase 1: Package scaffold with version constant and re-export stubs.
 * Phase 2: Actual extraction of protocol, lanes, sessions, and runtime modules.
 *
 * See: docs/plans/heliosapp-consolidation-plan.md
 *
 * wraps: nothing — pure first-party extraction
 */

export const RUNTIME_CORE_VERSION = '0.1.0';

/**
 * Phase 2 will uncomment these exports as modules are migrated:
 *
 * export * from './protocol';
 * export * from './lanes';
 * export * from './sessions';
 * export * from './runtime';
 */
