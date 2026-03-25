import type { MCPTool } from "../adapter.js";
import type { EventPublisher } from "./events.js";

export type ToolEntry = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const MOCK_TOOLS: ToolEntry[] = [
  {
    name: "read_file",
    description: "Read contents of a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write contents to a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
        content: { type: "string", description: "File content" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_directory",
    description: "List contents of a directory",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path" },
      },
      required: ["path"],
    },
  },
];

export class MCPToolCatalog {
  private readonly tools = new Map<string, ToolEntry>();

  clear(): void {
    this.tools.clear();
  }

  getTool(name: string): ToolEntry | undefined {
    return this.tools.get(name);
  }

  list(): ToolEntry[] {
    return [...this.tools.values()];
  }

  getTools(): MCPTool[] {
    return this.list().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  async discover(publisher: EventPublisher): Promise<void> {
    for (const tool of MOCK_TOOLS) {
      this.tools.set(tool.name, tool);
      await publisher.publish("provider.mcp.tool.discovered", {
        toolName: tool.name,
        description: tool.description,
      });
    }
  }
}
