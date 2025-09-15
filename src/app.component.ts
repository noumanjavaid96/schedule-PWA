import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { ScheduleComponent } from './components/schedule/schedule.component.js';
import { ChatComponent } from './components/chat/chat.component.js';
import { McpService } from './services/mcp.service.js';
import { ChatCommsService } from './services/chat-comms.service.js';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScheduleComponent, ChatComponent],
})
export class AppComponent {
  mcpService = inject(McpService); // Initialize MCP
  chatCommsService = inject(ChatCommsService);

  activeView = signal('schedule');
  isDarkMode = signal(false);

  constructor() {
    effect(() => {
      if (this.isDarkMode()) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
  }

  title = computed(() => {
    return this.activeView() === 'schedule' ? 'Upcoming Sessions' : 'AI Assistant';
  });

  setView(view) {
    this.activeView.set(view);
  }

  toggleDarkMode() {
    this.isDarkMode.update(value => !value);
  }
  
  handleScheduleAction(actionText: string) {
    this.chatCommsService.messageToSend.set(actionText);
    this.setView('chat');
  }
}