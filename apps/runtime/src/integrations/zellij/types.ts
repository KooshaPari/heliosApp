/**
 * Core types for the Zellij mux session adapter.
 */

/** Represents a zellij session as reported by `zellij list-sessions`. */
export interface ZellijSession {
  name: string;
  created: Date;
  attached: boolean;
}

/** Options for creating a new mux session. */
export interface SessionOptions {
  layout?: string | undefined;
  cwd?: string | undefined;
}

/** A pane record within a mux session. */
export interface PaneRecord {
  id: number;
  title: string;
  command?: string | undefined;
}

/** A tab record within a mux session. */
export interface TabRecord {
  index: number;
  name: string;
  panes: PaneRecord[];
}

/** A fully resolved mux session with lane binding information. */
export interface MuxSession {
  sessionName: string;
  laneId: string;
  createdAt: Date;
  panes: PaneRecord[];
  tabs: TabRecord[];
}

/** A binding between a mux session and a lane. */
export interface MuxBinding {
  sessionName: string;
  laneId: string;
  session: MuxSession;
  boundAt: Date;
}

/** Result of a CLI command execution. */
export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Result of a zellij availability check. */
export interface AvailabilityResult {
  available: boolean;
  version?: string | undefined;
  path?: string | undefined;
}
