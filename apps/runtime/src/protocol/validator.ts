import { METHODS } from "./methods";
import { TOPICS } from "./topics";
import type { LocalBusEnvelope } from "./types";
import { ProtocolValidationError } from "./types";
import {
  assertIsoTimestamp,
  assertOptionalString,
  assertRecord,
  assertStringField,
  validateCommandEnvelope,
  validateEventEnvelope,
  validateResponseEnvelope,
} from "./validator-rules";

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
    validateCommandEnvelope(envelope);
  }

  if (type === "event") {
    validateEventEnvelope(envelope);
  }

  if (type === "response") {
    validateResponseEnvelope(envelope);
  }

  // id is checked for completeness and stable semantics in thrown errors.
  if (!id) {
    throw new ProtocolValidationError("MISSING_REQUIRED_FIELD", "Envelope field 'id' is required");
  }

  return envelope as LocalBusEnvelope;
}
