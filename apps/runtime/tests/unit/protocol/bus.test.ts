import { describe, expect, it, beforeEach } from 'bun:test';
import { createBus, LocalBus } from '../../../src/protocol/bus.js';
import { createCommand, createResponse } from '../../../src/protocol/envelope.js';
import type { CommandEnvelope, ResponseEnvelope } from '../../../src/protocol/types.js';

// FR-003: Command dispatch pipeline
// FR-004: Event fan-out
// FR-009: Subscriber isolation
// FR-010: Snapshot-based iteration

describe('LocalBus — command dispatch', () => {
  let bus: LocalBus;

  beforeEach(() => {
    bus = createBus();
  });

  // FR-003: registered handler receives command and returns correlated response
  it('dispatches command to registered handler', async () => {
    bus.registerMethod('test.echo', (cmd) => createResponse(cmd, { echo: cmd.payload }));

    const cmd = createCommand('test.echo', 'hello');
    const res = await bus.send(cmd);

    expect(res.type).toBe('response');
    expect(res.correlation_id).toBe(cmd.correlation_id);
    expect(res.error).toBeUndefined();
    expect((res.payload as { echo: unknown }).echo).toBe('hello');
  });

  // FR-003: METHOD_NOT_FOUND for unregistered method
  it('returns METHOD_NOT_FOUND for unregistered method', async () => {
    const cmd = createCommand('no.such.method', null);
    const res = await bus.send(cmd);

    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('METHOD_NOT_FOUND');
    expect(res.error!.message).toContain('no.such.method');
  });

  // FR-003: HANDLER_ERROR when handler throws
  it('returns HANDLER_ERROR when handler throws synchronously', async () => {
    bus.registerMethod('fail.sync', () => {
      throw new Error('sync boom');
    });

    const cmd = createCommand('fail.sync', null);
    const res = await bus.send(cmd);

    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('HANDLER_ERROR');
    expect(res.error!.message).toContain('sync boom');
  });

  // FR-003: HANDLER_ERROR when async handler rejects
  it('returns HANDLER_ERROR when handler returns a rejected promise', async () => {
    bus.registerMethod('fail.async', async () => {
      throw new Error('async boom');
    });

    const cmd = createCommand('fail.async', null);
    const res = await bus.send(cmd);

    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('HANDLER_ERROR');
  });

  // FR-003: VALIDATION_ERROR for malformed envelope
  it('returns VALIDATION_ERROR for malformed envelope', async () => {
    const res = await bus.send({ garbage: true });

    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('VALIDATION_ERROR');
  });

  // FR-003: VALIDATION_ERROR for non-command envelope
  it('returns VALIDATION_ERROR when sending a non-command envelope', async () => {
    const event = {
      id: 'evt_123',
      correlation_id: 'cor_123',
      timestamp: 1,
      type: 'event',
      topic: 'test',
      payload: null,
      sequence: 1,
    };
    const res = await bus.send(event);

    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('VALIDATION_ERROR');
    expect(res.error!.message).toContain('command');
  });

  // FR-003: re-entrant dispatch works
  it('supports re-entrant dispatch (handler sends nested command)', async () => {
    bus.registerMethod('inner', (cmd) => createResponse(cmd, 'inner-result'));
    bus.registerMethod('outer', async (cmd) => {
      const innerCmd = createCommand('inner', 'nested');
      const innerRes = await bus.send(innerCmd);
      return createResponse(cmd, { inner: innerRes.payload });
    });

    const cmd = createCommand('outer', null);
    const res = await bus.send(cmd);

    expect(res.error).toBeUndefined();
    expect((res.payload as { inner: unknown }).inner).toBe('inner-result');
  });

  // FR-003: re-entrant depth limit
  it('returns error when re-entrant depth limit exceeded', async () => {
    const depthBus = createBus({ maxDepth: 3 });

    depthBus.registerMethod('recurse', async (cmd) => {
      const nested = createCommand('recurse', null);
      return await depthBus.send(nested);
    });

    const cmd = createCommand('recurse', null);
    const res = await depthBus.send(cmd);

    // At some depth it should return an error, not stack overflow
    expect(res.error).toBeDefined();
    expect(res.error!.message).toContain('depth limit');
  });

  it('returns HANDLER_ERROR when handler returns non-envelope value', async () => {
    bus.registerMethod('bad.return', (() => ({ notAnEnvelope: true })) as unknown as (cmd: CommandEnvelope) => ResponseEnvelope);

    const cmd = createCommand('bad.return', null);
    const res = await bus.send(cmd);

    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('HANDLER_ERROR');
  });

  it('returns structured error after destroy, not a crash', async () => {
    bus.destroy();
    const cmd = createCommand('test.method', null);
    const res = await bus.send(cmd);

    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('VALIDATION_ERROR');
    expect(res.error!.message).toContain('destroyed');
  });

  it('carries correlation_id through to response', async () => {
    bus.registerMethod('corr.test', (cmd) => createResponse(cmd, null));

    const cmd = createCommand('corr.test', null, 'my_correlation_123');
    const res = await bus.send(cmd);

    expect(res.correlation_id).toBe('my_correlation_123');
  });

  // FR-003: correlation propagation to events within handlers
  it('exposes active correlation_id during handler execution', async () => {
    let capturedCorrelation: string | undefined;

    bus.registerMethod('check.correlation', (cmd) => {
      capturedCorrelation = bus.getActiveCorrelationId();
      return createResponse(cmd, null);
    });

    const cmd = createCommand('check.correlation', null, 'trace_abc');
    await bus.send(cmd);

    expect(capturedCorrelation).toBe('trace_abc');
  });

  it('async handler that resolves after delay works correctly', async () => {
    bus.registerMethod('delayed', async (cmd) => {
      await new Promise((r) => setTimeout(r, 10));
      return createResponse(cmd, 'delayed-result');
    });

    const cmd = createCommand('delayed', null);
    const res = await bus.send(cmd);

    expect(res.error).toBeUndefined();
    expect(res.payload).toBe('delayed-result');
  });
});
