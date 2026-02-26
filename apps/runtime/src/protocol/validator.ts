import { METHODS } from "./methods";
import { TOPICS } from "./topics";
import type { LocalBusEnvelope } from "./types";
import { ProtocolValidationError } from "./types";

const METHOD_SET = new Set<string>(METHODS);
const TOPIC_SET = new Set<string>(TOPICS);
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const CORRELATION_REQUIRED_METHODS = new Set<string>([
  "lane.create",
  "session.attach",
  "terminal.spawn",
  "terminal.input",
  "terminal.resize"
]);

const CORRELATION_REQUIRED_TOPICS = new Set<string>([
  "lane.create.started",
  "lane.created",
  "lane.create.failed",
  "session.attach.started",
  "session.attached",
  "session.attach.failed",
  "terminal.spawn.started",
  "terminal.spawned",
  "terminal.spawn.failed",
  "terminal.output",
  "terminal.state.changed"
]);

const METHOD_CONTEXT_REQUIREMENTS: Record<
  string,
  Array<"workspace_id" | "lane_id" | "session_id" | "terminal_id">
> = {
  "lane.create": ["workspace_id"],
  "session.attach": ["workspace_id", "lane_id", "session_id"],
  "terminal.spawn": ["workspace_id", "lane_id", "session_id"],
  "terminal.input": ["workspace_id", "lane_id", "session_id", "terminal_id"],
  "terminal.resize": ["workspace_id", "lane_id", "session_id", "terminal_id"]
};

const TOPIC_CONTEXT_REQUIREMENTS: Record<
  string,
  Array<"workspace_id" | "lane_id" | "session_id" | "terminal_id">
> = {
  "lane.create.started": ["workspace_id", "lane_id"],
  "lane.created": ["workspace_id", "lane_id"],
  "lane.create.failed": ["workspace_id", "lane_id"],
  "session.attach.started": ["workspace_id", "lane_id", "session_id"],
  "session.attached": ["workspace_id", "lane_id", "session_id"],
  "session.attach.failed": ["workspace_id", "lane_id", "session_id"],
  "terminal.spawn.started": ["workspace_id", "lane_id", "session_id"],
  "terminal.spawned": ["workspace_id", "lane_id", "session_id", "terminal_id"],
  "terminal.spawn.failed": ["workspace_id", "lane_id", "session_id"],
  "terminal.output": ["workspace_id", "lane_id", "session_id", "terminal_id"],
  "terminal.state.changed": ["workspace_id", "lane_id", "session_id", "terminal_id"]
};

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProtocolValidationError("MALFORMED_ENVELOPE", "Envelope must be an object");
  }
}

function assertStringField(envelope: Record<string, unknown>, field: string): string {
  const value = envelope[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProtocolValidationError(
      "MISSING_REQUIRED_FIELD",
      `Envelope field '${field}' is required`,
      { field }
    );
  }
  return value;
}

function assertIsoTimestamp(value: string, field: string): void {
  if (!RFC3339_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ProtocolValidationError(
      "INVALID_TIMESTAMP",
      `Envelope field '${field}' must be an RFC3339 timestamp with timezone`,
      {
        field,
        value
      }
    );
  }
}

function assertPayloadObject(envelope: Record<string, unknown>): void {
  const payload = envelope.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ProtocolValidationError(
      "MISSING_REQUIRED_FIELD",
      "Envelope field 'payload' must be an object",
      {
        field: "payload"
      }
    );
  }
}

function assertOptionalString(
  envelope: Record<string, unknown>,
  field: string
): string | undefined {
  const value = envelope[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProtocolValidationError(
      "MISSING_CONTEXT_ID",
      `Envelope field '${field}' must be a non-empty string`,
      {
        field
      }
    );
  }
  return value;
}

function assertContext(
  envelope: Record<string, unknown>,
  fields: ReadonlyArray<"workspace_id" | "lane_id" | "session_id" | "terminal_id">
): void {
  for (const field of fields) {
    assertOptionalString(envelope, field);
    if (typeof envelope[field] !== "string" || (envelope[field] as string).trim() === "") {
      throw new ProtocolValidationError(
        "MISSING_CONTEXT_ID",
        `Envelope field '${field}' is required`,
        {
          field
        }
      );
    }
  }
}

function assertErrorPayload(envelope: Record<string, unknown>): void {
  const error = envelope.error;
  if (error === undefined || error === null) {
    return;
  }
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    throw new ProtocolValidationError(
      "INVALID_ERROR_PAYLOAD",
      "Envelope field 'error' must be an object"
    );
  }

  const typedError = error as Record<string, unknown>;
  if (typeof typedError.code !== "string" || typeof typedError.message !== "string") {
      throw new ProtocolValidationError(
        "INVALID_ERROR_PAYLOAD",
        "Envelope error payload must include code and message"
      );
  }
  if (typeof typedError.retryable !== "boolean") {
    throw new ProtocolValidationError(
      "INVALID_ERROR_PAYLOAD",
      "Envelope error payload must include retryable boolean"
    );
  }
}

function assertCorrelationId(
  envelope: Record<string, unknown>,
  requiredBy: "method" | "topic",
  name: string
): void {
  const correlationId = assertOptionalString(envelope, "correlation_id");
  if (!correlationId) {
    throw new ProtocolValidationError(
      "MISSING_CORRELATION_ID",
      "Envelope field 'correlation_id' is required",
      {
        required_by: requiredBy,
        name
      }
    );
  }
}

export function validateEnvelope(input: unknown): LocalBusEnvelope {
  assertRecord(input);

  const envelope = input;
  const type = assertStringField(envelope, "type");
  if (type !== "command" && type !== "event" && type !== "response") {
    throw new ProtocolValidationError(
      "INVALID_ENVELOPE_TYPE",
      `Unsupported envelope type '${type}'`,
      { type }
    );
  }

  const id = assertStringField(envelope, "id");
  const ts = assertStringField(envelope, "ts");
  assertIsoTimestamp(ts, "ts");
  assertOptionalString(envelope, "workspace_id");
  assertOptionalString(envelope, "lane_id");
  assertOptionalString(envelope, "session_id");
  assertOptionalString(envelope, "terminal_id");
  assertOptionalString(envelope, "envelope_id");
  const timestamp = assertOptionalString(envelope, "timestamp");
  if (timestamp) {
    assertIsoTimestamp(timestamp, "timestamp");
  }
  assertOptionalString(envelope, "correlation_id");

  if (type === "command") {
    const method = assertStringField(envelope, "method");
    if (!METHOD_SET.has(method)) {
      throw new ProtocolValidationError(
        "INVALID_METHOD",
        `Unsupported method '${method}'`,
        { method }
      );
    }
    assertPayloadObject(envelope);

    const requiredContext = METHOD_CONTEXT_REQUIREMENTS[method];
    if (requiredContext) {
      assertContext(envelope, requiredContext);
    }
    if (CORRELATION_REQUIRED_METHODS.has(method)) {
      assertCorrelationId(envelope, "method", method);
    }
  }

  if (type === "event") {
    const topic = assertStringField(envelope, "topic");
    if (!TOPIC_SET.has(topic)) {
      throw new ProtocolValidationError("INVALID_TOPIC", `Unsupported topic '${topic}'`, { topic });
    }
    assertPayloadObject(envelope);

    const requiredContext = TOPIC_CONTEXT_REQUIREMENTS[topic];
    if (requiredContext) {
      assertContext(envelope, requiredContext);
    }
    if (CORRELATION_REQUIRED_TOPICS.has(topic)) {
      assertCorrelationId(envelope, "topic", topic);
    }
  }

  if (type === "response") {
    const status = assertStringField(envelope, "status");
    if (status !== "ok" && status !== "error") {
      throw new ProtocolValidationError(
        "INVALID_STATUS",
        `Unsupported status '${status}'`,
        { status }
      );
    }
    assertErrorPayload(envelope);

    const method = assertOptionalString(envelope, "method");
    if (method && !METHOD_SET.has(method)) {
      throw new ProtocolValidationError(
        "INVALID_METHOD",
        `Unsupported method '${method}'`,
        { method }
      );
    }

    const topic = assertOptionalString(envelope, "topic");
    if (topic && !TOPIC_SET.has(topic)) {
      throw new ProtocolValidationError("INVALID_TOPIC", `Unsupported topic '${topic}'`, {
        topic
      });
    }
  }

  // id is checked for completeness and stable semantics in thrown errors.
  if (!id) {
    throw new ProtocolValidationError("MISSING_REQUIRED_FIELD", "Envelope field 'id' is required");
  }

  return envelope as LocalBusEnvelope;
}
