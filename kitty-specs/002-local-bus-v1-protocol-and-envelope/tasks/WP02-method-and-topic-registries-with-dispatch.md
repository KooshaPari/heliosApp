---
work_package_id: WP02
title: Method and Topic Registries with Dispatch
lane: "doing"
dependencies: [WP01]
base_branch: 002-local-bus-v1-protocol-and-envelope-WP01
base_commit: 653850b86743c01cdbaf2042aab76e6988c1c24b
created_at: '2026-02-27T11:28:31.579393+00:00'
subtasks: [T007, T008, T009, T010, T011, T012]
phase: Phase 2 - Core Routing
assignee: ''
agent: "wp02-bus-agent"
shell_pid: "28146"
---

# Work Package Prompt: WP02 - Method and Topic Registries with Dispatch

## Objectives & Success Criteria

- Implement method registry with single-handler binding and command dispatch.
- Implement topic registry with multi-subscriber fan-out and deterministic delivery.
- Guarantee subscriber isolation: one subscriber throwing does not block others.
- Support re-entrant dispatch: handlers can send commands during execution without deadlock.
- Provide unified bus facade API for send/publish/subscribe.

Success criteria:
- Commands route to exactly one handler and return correlated responses.
- Events fan out to all topic subscribers in deterministic registration order.
- A throwing subscriber does not prevent delivery to other subscribers.
- Re-entrant dispatch (handler sends command) completes without deadlock or stack overflow.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/002-local-bus-v1-protocol-and-envelope/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/002-local-bus-v1-protocol-and-envelope/spec.md`
- WP01 types/validation:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/types.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/envelope.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/errors.ts`

Constraints:
- In-process only (no IPC/network).
- Method handlers are synchronous-first (return Promise allowed but not required).
- Event delivery is fire-and-forget from publisher perspective.
- Configurable re-entrant depth limit (default 10) to prevent stack overflow.
- Keep files under 350 lines.

## Subtasks & Detailed Guidance

### Subtask T007 - Implement method registry

- Purpose: provide a type-safe registry where subsystems bind exactly one handler per method name.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/methods.ts`.
  2. Define `MethodHandler` type: `(command: CommandEnvelope) => ResponseEnvelope | Promise<ResponseEnvelope>`.
  3. Implement `MethodRegistry` class with:
     - `register(method: string, handler: MethodHandler): void` — throws if method already registered.
     - `unregister(method: string): boolean` — returns true if removed.
     - `resolve(method: string): MethodHandler | undefined` — lookup.
     - `methods(): string[]` — list all registered method names.
  4. Use a `Map<string, MethodHandler>` internally.
  5. Validate method names: non-empty, alphanumeric with dots (e.g., `lane.create`).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/methods.ts`
- Validation checklist:
  - [ ] Duplicate registration throws with clear message.
  - [ ] `resolve` returns undefined for unregistered methods.
  - [ ] Method name validation rejects empty strings and invalid characters.
- Edge cases:
  - Registering then unregistering then re-registering the same method must work.
  - Method names are case-sensitive.
- Parallel: No.

### Subtask T008 - Implement command dispatch pipeline

- Purpose: route command envelopes through validation, method lookup, handler execution, and response wrapping.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/bus.ts`, implement `dispatch(envelope: unknown): Promise<ResponseEnvelope>`.
  2. Step 1: validate envelope using `validateEnvelope()` — return VALIDATION_ERROR response on failure.
  3. Step 2: assert `isCommand(envelope)` — return VALIDATION_ERROR if not a command.
  4. Step 3: resolve handler from method registry — return METHOD_NOT_FOUND response if absent.
  5. Step 4: execute handler in try/catch — wrap thrown errors as HANDLER_ERROR response.
  6. Step 5: return handler result as ResponseEnvelope (create via `createResponse`).
  7. Track re-entrant depth: increment counter before handler call, decrement after. If depth exceeds limit, return error.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/bus.ts`
- Validation checklist:
  - [ ] Malformed envelope returns VALIDATION_ERROR without reaching handler.
  - [ ] Unknown method returns METHOD_NOT_FOUND with method name in message.
  - [ ] Handler exception returns HANDLER_ERROR with sanitized cause.
  - [ ] Re-entrant dispatch at depth limit returns error, not stack overflow.
  - [ ] Response always carries originating correlation_id.
- Edge cases:
  - Handler returns a promise that rejects — must be caught and wrapped.
  - Handler returns a non-envelope value — must be detected and wrapped as HANDLER_ERROR.
- Parallel: No.

### Subtask T009 - Implement topic registry

- Purpose: manage topic subscriptions with ordered subscriber lists.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/topics.ts`.
  2. Define `TopicSubscriber` type: `(event: EventEnvelope) => void | Promise<void>`.
  3. Implement `TopicRegistry` class with:
     - `subscribe(topic: string, subscriber: TopicSubscriber): () => void` — returns unsubscribe function.
     - `subscribers(topic: string): TopicSubscriber[]` — return ordered list (insertion order).
     - `topics(): string[]` — list all topics with at least one subscriber.
  4. Use `Map<string, TopicSubscriber[]>` internally.
  5. Validate topic names: non-empty, alphanumeric with dots.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/topics.ts`
- Validation checklist:
  - [ ] Subscribers receive events in registration order.
  - [ ] Unsubscribe function removes only the target subscriber.
  - [ ] Topic with zero subscribers after unsubscribe is cleaned up.
- Edge cases:
  - Same function subscribed twice to the same topic — both registrations are independent.
  - Unsubscribe called twice — second call is a no-op.
- Parallel: No.

### Subtask T010 - Implement event publish pipeline with fan-out

- Purpose: deliver events to all topic subscribers with isolation and correlation propagation.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/bus.ts`, implement `publish(envelope: unknown): Promise<void>`.
  2. Step 1: validate envelope — silently discard (with logging) if invalid (events are fire-and-forget).
  3. Step 2: assert `isEvent(envelope)`.
  4. Step 3: look up subscribers from topic registry.
  5. Step 4: if no subscribers, return immediately (no error per spec).
  6. Step 5: iterate subscribers in order. Wrap each call in try/catch. If one throws, log error and continue to next subscriber.
  7. Step 6: collect any subscriber errors and log them; do not propagate to publisher.
  8. Propagate `correlation_id` from any active dispatch context to events created within handlers.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/bus.ts`
- Validation checklist:
  - [ ] All subscribers receive the event even if one throws.
  - [ ] Events with no subscribers do not error.
  - [ ] Subscriber error is logged with topic and subscriber index.
  - [ ] correlation_id from active command context is available to events.
- Edge cases:
  - Subscriber that subscribes/unsubscribes during fan-out iteration — snapshot subscriber list before iteration.
  - Async subscribers — await each in order for deterministic delivery.
- Parallel: No.

### Subtask T011 - Wire bus facade API

- Purpose: provide a unified entry point so consumers don't interact with registries directly.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/bus.ts`, implement `LocalBus` class or module facade.
  2. Expose: `registerMethod(method, handler)`, `send(command)` (alias for dispatch), `subscribe(topic, subscriber)`, `publish(event)`.
  3. Instantiate method registry and topic registry internally.
  4. Export a singleton or factory function `createBus(): LocalBus`.
  5. Add `destroy()` method that unregisters all handlers and subscribers (for testing).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/protocol/bus.ts`
- Validation checklist:
  - [ ] Facade delegates correctly to internal registries.
  - [ ] `destroy()` cleans up all state.
  - [ ] Facade is the only public API; registries are not exported.
- Edge cases:
  - Calling `send` after `destroy` returns a structured error, not a crash.
- Parallel: No.

### Subtask T012 - Add Vitest unit tests for dispatch and fan-out

- Purpose: verify end-to-end bus behavior including edge cases.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/protocol/bus.test.ts`.
  2. Test command dispatch: registered handler receives command, response carries correlation_id.
  3. Test unregistered method: returns METHOD_NOT_FOUND.
  4. Test handler throws: returns HANDLER_ERROR.
  5. Test re-entrant dispatch: handler sends nested command, both complete.
  6. Test re-entrant depth limit: deeply nested dispatch returns error.
  7. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/protocol/topics.test.ts`.
  8. Test fan-out: 3 subscribers all receive event in order.
  9. Test subscriber isolation: subscriber 2 throws, subscribers 1 and 3 still receive.
  10. Test no subscribers: publish completes without error.
  11. Test unsubscribe during iteration: snapshot ensures stable delivery.
  12. Add FR traceability comments: `// FR-003`, `// FR-004`, `// FR-009`, `// FR-010`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/protocol/bus.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/protocol/topics.test.ts`
- Validation checklist:
  - [ ] >= 15 test cases covering all dispatch and fan-out paths.
  - [ ] FR traceability comments present.
  - [ ] Tests run in < 5 seconds.
- Edge cases:
  - Test with async handlers that resolve after a delay.
  - Test with handler that returns invalid (non-envelope) value.
- Parallel: Yes (after T008/T010 interfaces are stable).

## Test Strategy

- Run unit tests via `bun test` / Vitest.
- Cover all dispatch paths and fan-out scenarios.
- Subscriber isolation is a critical test — must be proven, not assumed.
- Re-entrant safety must be tested with real nested dispatch.

## Risks & Mitigations

- Risk: re-entrant dispatch causes subtle state corruption in registries.
- Mitigation: registries are read-only during dispatch; mutations only allowed outside dispatch cycle.
- Risk: async subscriber ordering is nondeterministic.
- Mitigation: await each subscriber sequentially in registration order.

## Review Guidance

- Confirm no handler can crash the bus (all paths wrapped in error handling).
- Confirm subscriber snapshot prevents mutation during iteration.
- Confirm re-entrant depth limit is configurable and tested.
- Confirm facade API is the only public surface.

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
- 2026-02-27T11:28:31Z – wp02-bus-agent – shell_pid=28146 – lane=doing – Assigned agent via workflow command
