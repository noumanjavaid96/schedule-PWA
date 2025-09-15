import { Component, ChangeDetectionStrategy, inject, signal, ElementRef, viewChild, afterNextRender } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatMessage, ScheduleItem } from '../../models/schedule.model';
import { GeminiService } from '../../services/gemini.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class ChatComponent {
  private geminiService = inject(GeminiService);
  
  messages = signal<ChatMessage[]>([
    { role: 'model', content: "Hello Admin! Welcome to the SG School Trainer Hub. You can manage all trainer schedules here. How can I assist you?", followUpQuestions: ["What's on the schedule for today?", "Are there any pending sessions?", "I need to cancel a session."] }
  ]);
  userInput = signal('');
  isLoading = signal(false);
  
  chatContainer = viewChild<ElementRef<HTMLDivElement>>('chatContainer');

  constructor() {
    afterNextRender(() => {
      this.scrollToBottom();
    });
  }

  async sendMessage(): Promise<void> {
    const userMessage = this.userInput().trim();
    if (!userMessage) return;
    this.userInput.set('');
    await this.processMessage(userMessage);
  }

  async sendSuggestedQuestion(question: string): Promise<void> {
    await this.processMessage(question);
  }
  
  async selectSession(session: ScheduleItem, action: 'cancel'): Promise<void> {
    if (action === 'cancel') {
        const message = `I want to cancel the session at ${session.schoolName} on ${new Date(session.date).toLocaleDateString()} (ID: ${session.id}).`;
        await this.processMessage(message);
    }
  }

  formatSessionDate(dateString: string): string {
    return new Date(dateString).toDateString();
  }

  private async processMessage(message: string): Promise<void> {
    if (this.isLoading()) return;

    // Add user message to chat, clearing previous suggestions/actions
    this.messages.update(m => {
      if (m.length > 0) {
        m[m.length - 1].followUpQuestions = [];
        m[m.length - 1].action = undefined;
        m[m.length - 1].actionData = undefined;
      }
      return [...m, { role: 'user', content: message }];
    });

    this.isLoading.set(true);
    this.messages.update(m => [...m, { role: 'model', content: '', isLoading: true }]);
    this.scrollToBottom();

    try {
      const response = await this.geminiService.generateResponse(message);
      
      let newModelMessage: ChatMessage;

      if (typeof response === 'string') {
        newModelMessage = { role: 'model', content: response };
      } else if ('action' in response) {
        newModelMessage = { role: 'model', content: response.data.prompt, action: response.action, actionData: response.data };
      } else {
        newModelMessage = { role: 'model', content: response.response, followUpQuestions: response.followUpQuestions };
      }

      this.messages.update(m => {
        m.pop(); // Remove loader
        return [...m, newModelMessage];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      this.messages.update(m => {
        m.pop(); // Remove loader
        return [...m, { role: 'model', content: 'Sorry, I ran into a problem. Please try again.' }];
      });
    } finally {
      this.isLoading.set(false);
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.chatContainer()?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }
}