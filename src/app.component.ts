import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { ScheduleComponent } from './components/schedule/schedule.component';
import { ChatComponent } from './components/chat/chat.component';
import { McpService } from './services/mcp.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScheduleComponent, ChatComponent],
})
export class AppComponent {
  mcpService = inject(McpService);
  notification = this.mcpService.notification;

  activeView = signal<'schedule' | 'chat'>('schedule');
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

  setView(view: 'schedule' | 'chat'): void {
    this.activeView.set(view);
  }

  toggleDarkMode(): void {
    this.isDarkMode.update(value => !value);
  }
}
