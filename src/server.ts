import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";

/**
 * Create and configure the MCP server
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "eventkit-reminders",
    version: "0.1.2",
  });

  // Register all tools
  registerTools(server);

  // Register all prompt templates
  registerPrompts(server);

  return server;
}
