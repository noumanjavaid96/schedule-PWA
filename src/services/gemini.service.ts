

import { Injectable, inject } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import { ScheduleService } from './schedule.service';
import { McpService } from './mcp.service';
import { ScheduleItem } from '../models/schedule.model';

// IMPORTANT: This service assumes the API key is available via process.env.API_KEY
@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private apiKeyChecked = false; // Flag to prevent repeated checks
  private scheduleService = inject(ScheduleService);
  private mcpService = inject(McpService);

  constructor() {
    // Initialization is deferred to be more resilient to environment variable timing.
  }

  private initializeAi(): void {
    if (this.ai || this.apiKeyChecked) {
      return; // Already initialized or we already know the key is missing
    }

    this.apiKeyChecked = true;
    // The API key is obtained exclusively from the environment variable `process.env.API_KEY`.
    const apiKey = process.env.API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.error("Gemini API Key not found in process.env.API_KEY. AI features will be disabled.");
    }
  }

  async generateResponse(prompt: string): Promise<string | { response: string; followUpQuestions: string[] } | { action: 'PROMPT_FOR_CANCELLATION', data: any }> {
    this.initializeAi(); // Initialize AI client just-in-time

    if (!this.ai) {
      return "The AI assistant is currently unavailable. Please ensure the API key is configured correctly by the administrator.";
    }

    const model = 'gemini-2.5-flash';
    const schedule = this.scheduleService.getSchedule();
    const cancellableSchedule = schedule.filter(item => item.status === 'Confirmed' || item.status === 'Pending');
    const scheduleContext = JSON.stringify(schedule, null, 2);
    const currentDate = new Date().toISOString();

    const systemInstruction = `You are an intelligent administrative assistant for the SG School Trainer Hub.
Your primary role is to manage the trainer's schedule on behalf of the Admin user. You must be professional, concise, and helpful.
Current date is: ${currentDate}.
The user's current schedule is provided below. Use this schedule to answer questions and perform actions.

SCHEDULE:
${scheduleContext}

You have access to two tools:
1. 'update_schedule': Use this to add, modify, or delete a training session. The arguments object should match the ScheduleItem structure. For modifications, you MUST provide the 'id'.
   - **CRITICAL CANCELLATION RULE:** If a user requests to cancel a session, you MUST ask for a detailed reason for the cancellation before using this tool.

2. 'send_notification': Use this to send a notification to the user.

**Response Formatting and Action Rules:**

1.  **If the user expresses an intent to cancel a session** (e.g., "cancel a session", "remove an event"):
    *   Respond ONLY with a single JSON object with an 'action' key.
    *   **Format:** \`{"action": "PROMPT_FOR_CANCELLATION", "data": {"prompt": "Which session would you like to cancel?", "sessions": [...]}}\`
    *   The "sessions" array MUST contain the list of all "Confirmed" and "Pending" sessions from the schedule context.

2.  **If you need to use a tool:** Respond ONLY with a single JSON object for the tool call.
    *   **Format:** \`{"tool_name": "tool_name_here", "arguments": { ... }}\`
    *   **Example:** \`{"tool_name": "update_schedule", "arguments": {"id": 3, "status": "Cancelled", "cancellationReason": "Trainer is sick."}}\`

3.  **For all other conversational answers:** Respond ONLY with a single JSON object containing the answer and follow-up questions.
    *   **Format:** \`{"response": "Your HTML-formatted answer here.", "followUpQuestions": ["Suggested question 1?", "Suggested question 2?"]}\`
    *   **\`response\` field:** Format content using simple HTML tags (\`<b>\`, \`<i>\`, \`<ul><li>\`). Do not use markdown. **CRITICAL:** Ensure all HTML tags are correctly formed and closed to prevent display issues.
    *   **\`followUpQuestions\` field:** Provide 2-3 short, relevant follow-up questions.
    *   **Example:** \`{"response": "Yes, everything is on schedule except for the session at <b>National Junior College</b>.", "followUpQuestions": ["Can you confirm the NJC session?", "What is my schedule for tomorrow?"]}\`

If you cannot perform a request, explain why in a conversational response, following rule #3.`;
    
    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
          model: model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            systemInstruction: systemInstruction,
          }
      });
      
      const responseText = response.text.trim();
      
      if (responseText.startsWith('{') && responseText.endsWith('}')) {
        try {
          const jsonResponse = JSON.parse(responseText);
          
          if (jsonResponse.action === 'PROMPT_FOR_CANCELLATION' && jsonResponse.data) {
             // Pass only the relevant sessions to the UI
            jsonResponse.data.sessions = cancellableSchedule;
            return jsonResponse;
          }
          
          if (jsonResponse.tool_name && jsonResponse.arguments) {
            return await this.handleToolCall(jsonResponse.tool_name, jsonResponse.arguments);
          }
          
          if (jsonResponse.response && Array.isArray(jsonResponse.followUpQuestions)) {
            return jsonResponse;
          }

        } catch (e) {
          console.warn("Response looked like JSON but failed to parse or match format.", e);
        }
      }
      
      return responseText;

    } catch (error) {
      console.error('Error generating response from Gemini:', error);
      return 'Sorry, I encountered an error. Please try again.';
    }
  }

  private async handleToolCall(toolName: string, args: any): Promise<string> {
    if (toolName === 'update_schedule') {
        if (args.id) { // Update existing
            const existingItem = this.scheduleService.getSchedule().find(i => i.id === args.id);
            if (!existingItem) {
                return `Sorry, I couldn't find a session with ID ${args.id}.`;
            }
            const updatedItem = { ...existingItem, ...args };
            this.scheduleService.updateScheduleItem(updatedItem);
            return `OK, I've updated the session for "<b>${updatedItem.trainer}</b>" at "<b>${updatedItem.schoolName}</b>".`;
        } else { // Add new
            const newItem = args as Omit<ScheduleItem, 'id'>;
            this.scheduleService.addScheduleItem(newItem);
            return `OK, I've added the new session for "<b>${newItem.trainer}</b>" at "<b>${newItem.schoolName}</b>" to the schedule.`;
        }
    } else if (toolName === 'send_notification') {
        const result = await this.mcpService.callTool({ name: 'send_notification', arguments: args });
        return result.message;
    }
    return `Unknown tool: ${toolName}`;
  }
}