import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { METHODS } from "../../../src/protocol/methods";
import { TOPICS } from "../../../src/protocol/topics";

type StringCollectionDoc = {
  methods?: string[];
  topics?: string[];
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

describe("protocol asset parity", () => {
  test("keeps runtime methods and topics aligned with protocol specs", () => {
    const methodsDoc = readJson<StringCollectionDoc>("specs/protocol/v1/methods.json");
    const topicsDoc = readJson<StringCollectionDoc>("specs/protocol/v1/topics.json");

    expect(methodsDoc.methods ?? []).toEqual([...METHODS]);
    expect(topicsDoc.topics ?? []).toEqual([...TOPICS]);
  });

  test("keeps contract schema enums aligned with runtime protocol sets", () => {
    const contract = readJson<Record<string, unknown>>(
      [
        "kitty-specs",
        "001-colab-agent-terminal-control-plane",
        "contracts",
        "orchestration-envelope.schema.json"
      ].join("/")
    );
    const properties = (contract.properties as Record<string, unknown>) ?? {};
    const methodProp = (properties.method as Record<string, unknown>) ?? {};
    const topicProp = (properties.topic as Record<string, unknown>) ?? {};
    const methodEnum = ((methodProp.enum as Array<string | null>) ?? []).filter(Boolean);
    const topicEnum = ((topicProp.enum as Array<string | null>) ?? []).filter(Boolean);

    expect(methodEnum).toEqual([...METHODS]);
    expect(topicEnum).toEqual([...TOPICS]);
  });
});
