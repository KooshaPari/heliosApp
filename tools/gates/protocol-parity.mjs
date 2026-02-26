import { readFileSync } from "node:fs";

function parseLiteralArray(tsPath, constName) {
  const source = readFileSync(tsPath, "utf8");
  const regex = new RegExp(`export const ${constName} = \\[(?<body>[\\s\\S]*?)\\] as const;`);
  const match = source.match(regex);
  if (!match?.groups?.body) {
    throw new Error(`Unable to parse ${constName} from ${tsPath}`);
  }
  return [...match.groups.body.matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

const runtimeTopics = parseLiteralArray("apps/runtime/src/protocol/topics.ts", "TOPICS");
const runtimeMethods = parseLiteralArray("apps/runtime/src/protocol/methods.ts", "METHODS");
const formalTopics = JSON.parse(readFileSync("specs/protocol/v1/topics.json", "utf8")).topics;
const formalMethods = JSON.parse(readFileSync("specs/protocol/v1/methods.json", "utf8")).methods;

const allowedRuntimeTopicExtensions = new Set([]);
const allowedRuntimeMethodExtensions = new Set([]);

const runtimeOnlyMethods = runtimeMethods.filter(
  (method) => !formalMethods.includes(method) && !allowedRuntimeMethodExtensions.has(method)
);
const runtimeOnlyTopics = runtimeTopics.filter(
  (topic) => !formalTopics.includes(topic) && !allowedRuntimeTopicExtensions.has(topic)
);
const formalOnlyMethods = formalMethods.filter((method) => !runtimeMethods.includes(method));
const formalOnlyTopics = formalTopics.filter((topic) => !runtimeTopics.includes(topic));

if (runtimeOnlyMethods.length || runtimeOnlyTopics.length || formalOnlyMethods.length || formalOnlyTopics.length) {
  console.error("Protocol parity gate failed.");
  if (runtimeOnlyMethods.length) {
    console.error(`Runtime-only methods missing from formal assets: ${runtimeOnlyMethods.join(", ")}`);
  }
  if (runtimeOnlyTopics.length) {
    console.error(`Runtime-only topics missing from formal assets: ${runtimeOnlyTopics.join(", ")}`);
  }
  if (formalOnlyMethods.length) {
    console.error(`Formal-only methods missing from runtime assets: ${formalOnlyMethods.join(", ")}`);
  }
  if (formalOnlyTopics.length) {
    console.error(`Formal-only topics missing from runtime assets: ${formalOnlyTopics.join(", ")}`);
  }
  process.exit(1);
}

console.log("Protocol parity gate passed.");
