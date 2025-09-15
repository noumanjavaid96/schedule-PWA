import { Component, ChangeDetectionStrategy, inject, signal, viewChild, afterNextRender, ElementRef, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service.js';
import { ChatMessage, ScheduleItem } from '../../models/schedule.model.js';
import { ChatCommsService } from '../../services/chat-comms.service.js';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class ChatComponent {
  geminiService = inject(GeminiService);
  chatCommsService = inject(ChatCommsService);
  
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

    effect(() => {
        const message = this.chatCommsService.messageToSend();
        if (message) {
            this.processMessage(message);
            this.chatCommsService.messageToSend.set(null); // Reset after processing
        }
    });
  }

  async sendMessage() {
    const userMessage = this.userInput().trim();
    if (!userMessage) return;
    this.userInput.set('');
    await this.processMessage(userMessage);
  }

  async sendSuggestedQuestion(question: string) {
    await this.processMessage(question);
  }
  
  async selectSession(session: ScheduleItem, action: string) {
    if (action === 'cancel') {
        const message = `I want to cancel the session at ${session.schoolName} on ${new Date(session.date).toLocaleDateString()} (ID: ${session.id}).`;
        await this.processMessage(message);
    }
  }

  formatSessionDate(dateString: string) {
    return new Date(dateString).toDateString();
  }

  async processMessage(message: string) {
    if (this.isLoading()) return;

    // Immutably update messages: clear follow-ups from the last model message, then add the new user message.
    this.messages.update(currentMessages => {
      let newMessages = [...currentMessages];
      if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model') {
        const lastMessage = { ...newMessages[newMessages.length - 1] };
        // Remove interactive elements for a clean history
        delete lastMessage.followUpQuestions;
        delete lastMessage.action;
        delete lastMessage.actionData;
        newMessages[newMessages.length - 1] = lastMessage;
      }
      return [...newMessages, { role: 'user', content: message }];
    });


    this.isLoading.set(true);
    this.messages.update(m => [...m, { role: 'model', content: '', isLoading: true }]);
    this.scrollToBottom();

    try {
      const historyForApi = this.messages().filter(m => !m.isLoading);
      const response = await this.geminiService.generateResponse(historyForApi);
      
      let newModelMessage: ChatMessage;

      if (typeof response === 'string') {
        newModelMessage = { role: 'model', content: response };
      } else if (response && 'action' in response) {
        newModelMessage = { role: 'model', content: response.data.prompt, action: response.action, actionData: response.data };
      } else if (response && 'response' in response) {
        newModelMessage = { role: 'model', content: response.response, followUpQuestions: response.followUpQuestions };
      } else {
        // Fallback for unexpected response structure
        newModelMessage = { role: 'model', content: 'Sorry, I received an unexpected response.' };
      }

      // Replace the loader with the new message immutably
      this.messages.update(m => [...m.slice(0, -1), newModelMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      // Replace the loader with an error message immutably
      this.messages.update(m => [...m.slice(0, -1), { role: 'model', content: 'Sorry, I ran into a problem. Please try again.' }]);
    } finally {
      this.isLoading.set(false);
      this.scrollToBottom();
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      const container = this.chatContainer()?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }
}