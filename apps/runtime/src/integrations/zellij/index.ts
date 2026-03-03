export { ZellijCli } from "./cli.js";
export { ZellijSessionManager, sessionNameForLane } from "./session.js";
export { MuxRegistry } from "./registry.js";
export type {
  ZellijSession,
  SessionOptions,
  MuxSession,
  MuxBinding,
  PaneRecord,
  TabRecord,
  CliResult,
  AvailabilityResult,
} from "./types.js";
export {
  ZellijNotFoundError,
  ZellijVersionError,
  ZellijCliError,
  ZellijTimeoutError,
  SessionNotFoundError,
  SessionAlreadyExistsError,
  DuplicateBindingError,
} from "./errors.js";
