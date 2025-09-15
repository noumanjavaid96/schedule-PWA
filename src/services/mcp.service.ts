
import { Injectable, signal } from '@angular/core';

interface Notification {
  message: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class McpService {
  notification = signal<Notification>({ message: null });
  
  // This simulates the client.callTool method from the user's example
  async callTool(tool: { name: string, arguments: any }): Promise<{ status: string, message: string }> {
    console.log(`Calling tool: ${tool.name} with args:`, tool.arguments);
    
    if (tool.name === 'send_notification') {
      const message = tool.arguments.message || 'Notification sent!';
      this.showNotification(message);
      return { status: 'success', message: `Notification tool executed successfully.` };
    }

    return { status: 'error', message: `Tool '${tool.name}' not found.` };
  }

  private showNotification(message: string) {
    this.notification.set({ message });
    setTimeout(() => {
      this.notification.set({ message: null });
    }, 3000); // Hide after 3 seconds
  }
}
