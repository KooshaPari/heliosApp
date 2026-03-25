/**
 * Method registry for the Helios local bus.
 *
 * Provides single-handler binding per method name with strict validation.
 */

import type { CommandEnvelope, ResponseEnvelope } from "./types.js";

export const METHODS = [
	"workspace.create",
	"workspace.open",
	"project.clone",
	"project.init",
	"session.create",
	"session.attach",
	"session.terminate",
	"terminal.spawn",
	"terminal.resize",
	"terminal.input",
	"renderer.switch",
	"renderer.capabilities",
	"agent.run",
	"agent.cancel",
	"approval.request.resolve",
	"share.upterm.start",
	"share.upterm.stop",
	"share.tmate.start",
	"share.tmate.stop",
	"zmx.checkpoint",
	"zmx.restore",
	"lane.create",
	"lane.attach",
	"lane.cleanup",
] as const;

export type ProtocolMethod = (typeof METHODS)[number];

export type MethodHandler = (
	command: CommandEnvelope,
) => ResponseEnvelope | Promise<ResponseEnvelope>;

const METHOD_NAME_RE = /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/;

function assertValidMethodName(method: string): void {
	if (!METHOD_NAME_RE.test(method)) {
		throw new Error(
			`Invalid method name "${method}": must be non-empty, alphanumeric segments separated by dots`,
		);
	}
}

export class MethodRegistry {
	private readonly handlers = new Map<string, MethodHandler>();

	register(method: string, handler: MethodHandler): void {
		assertValidMethodName(method);
		if (this.handlers.has(method)) {
			throw new Error(`Method "${method}" is already registered`);
		}
		this.handlers.set(method, handler);
	}

	unregister(method: string): boolean {
		return this.handlers.delete(method);
	}

	resolve(method: string): MethodHandler | undefined {
		return this.handlers.get(method);
	}

	methods(): string[] {
		return [...this.handlers.keys()];
	}

	clear(): void {
		this.handlers.clear();
	}
}
