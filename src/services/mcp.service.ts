import { Injectable, signal, OnDestroy } from '@angular/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

@Injectable({
  providedIn: 'root',
})
export class McpService implements OnDestroy {
  notification = signal<{ message: string | null }>({ message: null });
  isConnected = signal(false);
  private client: Client;
  private transport: StreamableHTTPClientTransport;

  // This is the server URL provided by the user.
  // CAUTION: This URL should be treated like a secret/password.
  private readonly serverUrl = "https://corsproxy.io/?https://mcp.zapier.com/api/mcp/s/NTUzNzljYzgtOGI0YS00ZWEyLWIzMjEtZGY1MzJmMmFiZDk1OjUxYjE0Y2JjLWZkYTUtNGJkMC1iMmRkLTAyMjkyMjQ3OTA5ZQ==/mcp";

  constructor() {
    this.client = new Client(
      {
        name: 'sg-school-trainer-hub-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
    this.transport = new StreamableHTTPClientTransport(new URL(this.serverUrl));
    this.connect();
  }

  async connect() {
    try {
      console.log("Connecting to MCP server...");
      await this.client.connect(this.transport);
      this.isConnected.set(true);
      console.log("Connected to MCP server.");
      
      const tools = await this.client.listTools();
      console.log("Available tools from MCP server:", tools);
    } catch (error) {
      console.error("Failed to connect to MCP server:", error);
      this.isConnected.set(false);
      this.showNotification("Error: Could not connect to the tool server.");
    }
  }

  // This is a convenience wrapper for the 'send_notification' tool.
  sendNotification(message: string) {
    // This is a fire-and-forget call for UI purposes.
    // We don't need to wait for the result in the Gemini service.
    this.callTool({ name: 'send_notification', arguments: { message } });
  }

  async callTool(tool: { name: string; arguments: any; }) {
    if (!this.isConnected()) {
        const errorMessage = "Cannot call tool: Not connected to the tool server.";
        console.error(errorMessage);
        this.showNotification(errorMessage);
        return { status: 'error', message: errorMessage };
    }
    
    console.log(`Calling tool via MCP: ${tool.name} with args:`, tool.arguments);
    
    try {
        const result = await this.client.callTool({
            name: tool.name,
            arguments: tool.arguments,
        });

        console.log("MCP tool call result:", result);
        
        // The MCP server is responsible for sending the notification.
        // We can show a local confirmation toast as well for better UX.
        if (tool.name === 'send_notification') {
            this.showNotification(tool.arguments.message || 'Notification request sent!');
        }

        // Assuming a successful call returns a result object with a `result` property.
        return { status: 'success', message: result.result || `Tool '${tool.name}' executed successfully.` };

    } catch (error) {
        const errorMessage = `Error executing tool '${tool.name}' via MCP.`;
        console.error(errorMessage, error);
        this.showNotification(errorMessage);
        return { status: 'error', message: errorMessage };
    }
  }

  showNotification(message: string) {
    this.notification.set({ message });
    setTimeout(() => {
      this.notification.set({ message: null });
    }, 3000); // Hide after 3 seconds
  }
  
  async ngOnDestroy() {
    if (this.isConnected()) {
        console.log("Closing MCP connection...");
        await this.transport?.close();
        await this.client?.close();
        console.log("MCP connection closed.");
    }
  }
}