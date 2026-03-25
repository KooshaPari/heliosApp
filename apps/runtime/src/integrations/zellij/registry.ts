/**
 * T005 - Session-to-lane binding registry.
 *
 * Maintains the authoritative mapping between mux sessions and lanes.
 * Enforces a one-to-one relationship: one session per lane, one lane per session.
 */

import type { ZellijCli } from "./cli.js";
import { DuplicateBindingError } from "./errors.js";
import type { MuxBinding, MuxSession } from "./types.js";

export class MuxRegistry {
	private readonly bySession = new Map<string, MuxBinding>();
	private readonly byLane = new Map<string, MuxBinding>();
	private readonly cli: ZellijCli | undefined;

	constructor(cli?: ZellijCli) {
		this.cli = cli;
	}

	/**
	 * Bind a session to a lane. Throws if either is already bound.
	 */
	bind(sessionName: string, laneId: string, session: MuxSession): void {
		const existingBySession = this.bySession.get(sessionName);
		if (existingBySession) {
			throw new DuplicateBindingError(
				`session=${sessionName}`,
				`lane=${existingBySession.laneId}`,
			);
		}

		const existingByLane = this.byLane.get(laneId);
		if (existingByLane) {
			throw new DuplicateBindingError(
				`lane=${laneId}`,
				`session=${existingByLane.sessionName}`,
			);
		}

		const binding: MuxBinding = {
			sessionName,
			laneId,
			session,
			boundAt: new Date(),
		};

		this.bySession.set(sessionName, binding);
		this.byLane.set(laneId, binding);
	}

	/**
	 * Look up a binding by session name.
	 */
	getBySession(sessionName: string): MuxBinding | undefined {
		return this.bySession.get(sessionName);
	}

	/**
	 * Look up a binding by lane ID.
	 */
	getByLane(laneId: string): MuxBinding | undefined {
		return this.byLane.get(laneId);
	}

	/**
	 * Remove a binding by session name. No-op if not found.
	 */
	unbind(sessionName: string): void {
		const binding = this.bySession.get(sessionName);
		if (!binding) return;

		this.bySession.delete(sessionName);
		this.byLane.delete(binding.laneId);
	}

	/**
	 * List all bindings.
	 */
	list(): MuxBinding[] {
		return [...this.bySession.values()];
	}

	/**
	 * Compatibility shim for watchdog SessionRegistry interface.
	 * Accepts either a session name or a lane id.
	 */
	getSession(sessionId: string): { id: string; laneId?: string } | null {
		const bySession = this.bySession.get(sessionId);
		if (bySession) {
			return { id: bySession.sessionName, laneId: bySession.laneId };
		}

		const byLane = this.byLane.get(sessionId);
		if (byLane) {
			return { id: byLane.sessionName, laneId: byLane.laneId };
		}

		const canonicalName = `helios-lane-${sessionId}`;
		const byCanonicalName = this.bySession.get(canonicalName);
		if (byCanonicalName) {
			return {
				id: byCanonicalName.sessionName,
				laneId: byCanonicalName.laneId,
			};
		}

		return null;
	}

	/**
	 * Compatibility shim for watchdog SessionRegistry interface.
	 */
	getSessions(): Array<{ id: string; laneId?: string }> {
		return this.list().map((binding) => ({
			id: binding.sessionName,
			laneId: binding.laneId,
		}));
	}

	/**
	 * Return bindings whose sessions no longer exist in zellij.
	 * Requires a ZellijCli instance to query live sessions.
	 */
	async getOrphaned(): Promise<MuxBinding[]> {
		if (!this.cli) {
			console.warn(
				"[zellij-registry] getOrphaned() called without a cli; returning cached bindings only",
			);
			return [];
		}

		const liveSessions = await this.cli.listSessions();
		const liveNames = new Set(liveSessions.map((s) => s.name));

		return this.list().filter((b) => !liveNames.has(b.sessionName));
	}
}
