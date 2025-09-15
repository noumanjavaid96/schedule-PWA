import { Injectable, inject } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { ScheduleService } from './schedule.service.js';
import { McpService } from './mcp.service.js';
import { ChatMessage } from '../models/schedule.model.js';

// IMPORTANT: This service assumes the API key is available via process.env.API_KEY
@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  ai: GoogleGenAI | null = null;
  apiKeyChecked = false; // Flag to prevent repeated checks
  scheduleService = inject(ScheduleService);
  mcpService = inject(McpService);

  constructor() {
    // Initialization is deferred to be more resilient to environment variable timing.
  }

  initializeAi() {
    if (this.ai || this.apiKeyChecked) {
      return; // Already initialized or we already know the key is missing
    }

    this.apiKeyChecked = true;
    // The API key is obtained exclusively from the environment.
    // In a browser-only environment, `process` might not be defined. This code safely checks for it.
    let apiKey: string | undefined;
    try {
        // This check is to prevent reference errors in browsers where `process` doesn't exist.
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            apiKey = process.env.API_KEY;
        }
    } catch (e) {
        console.warn('Could not access process.env.API_KEY. This is expected in some environments.', e);
    }
    
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.error("Gemini API Key not found. AI features will be disabled. Ensure the API key is configured as an environment variable in your deployment service (e.g., Vercel).");
    }
  }

  async generateResponse(chatHistory: ChatMessage[]) {
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
1. 'update_schedule': Use this to add, modify, or delete a training session. The arguments object should match the ScheduleItem structure which includes fields like 'schoolName', 'topic', 'date', 'time', 'status', 'trainer', 'location', and 'notes'. For modifications, you MUST provide the 'id'. To set a reminder, provide the 'id' and 'reminderMinutes' (e.g., {"id": 2, "reminderMinutes": 30}).
   - **CRITICAL CANCELLATION RULE:** If a user requests to cancel a session, you MUST ask for a detailed reason for the cancellation before using this tool.
2. 'send_notification': Sends a simple success notification to the UI. Use it to confirm actions like setting a reminder. Example: {"tool_name": "send_notification", "arguments": {"message": "Reminder set!"}}


**Response Formatting and Action Rules:**

1.  **If the user expresses an intent to cancel a session** (e.g., "cancel a session", "remove an event"):
    *   Respond ONLY with a single JSON object with an 'action' key.
    *   **Format:** \`{"action": "PROMPT_FOR_CANCELLATION", "data": {"prompt": "Which session would you like to cancel?", "sessions": [...]}}\`
    *   The "sessions" array MUST contain the list of all "Confirmed" and "Pending" sessions from the schedule context.

2.  **If you need to use a tool:** Respond ONLY with a single JSON object for the tool call, OR a JSON array of tool call objects if multiple actions are required (e.g., "confirm all pending sessions").
    *   **Single Tool Call Format:** \`{"tool_name": "tool_name_here", "arguments": { ... }}\`
    *   **Multiple Tool Calls Format:** \`[{"tool_name": "update_schedule", "arguments": {"id": 3, "status": "Confirmed"}}, {"tool_name": "update_schedule", "arguments": {"id": 6, "status": "Confirmed"}}]\`

3.  **For all other conversational answers:** Respond ONLY with a single JSON object containing the answer and follow-up questions.
    *   **Format:** \`{"response": "Your HTML-formatted answer here.", "followUpQuestions": [...]}\`
    *   **\`response\` field:** Format content using simple HTML tags (\`<b>\`, \`<i>\`, \`<ul><li>\`). Do not use markdown. **CRITICAL:** Ensure all HTML tags are correctly formed and closed to prevent display issues.
    *   **\`followUpQuestions\` field:** Provide 2-3 short, relevant follow-up questions. If a question is about a specific session from the SCHEDULE context, you MUST include its 'id' in a 'sessionId' field (e.g., {"text": "Confirm this session?", "sessionId": 3}). General questions should not have a 'sessionId'.
    *   **Example:** \`{"response": "Yes, everything is on schedule except for the session at <b>National Junior College</b>.", "followUpQuestions": [{"text": "Can you confirm the NJC session?", "sessionId": 3}, {"text": "What is my schedule for tomorrow?"}]}\`

If you cannot perform a request, explain why in a conversational response, following rule #3.`;

    const contents = chatHistory
      .filter(m => (m.role === 'user' || m.role === 'model') && m.content)
      .map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      
    try {
      const response = await this.ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json", // Enforce JSON output
          }
      });
      
      const responseText = response.text.trim();
      
      try {
        const jsonResponse = JSON.parse(responseText);
        
        // HANDLE BATCH TOOL CALLS (Array of tools)
        if (Array.isArray(jsonResponse) && jsonResponse.every(item => item.tool_name && item.arguments)) {
          const toolPromises = jsonResponse.map(tool => this.handleToolCall(tool.tool_name, tool.arguments));
          const toolResults = await Promise.all(toolPromises);
          
          const summary = `I've completed the following actions:<ul>${toolResults.map(res => `<li>${res}</li>`).join('')}</ul>`;
          
          return {
            response: summary,
            followUpQuestions: ["Is there anything else I can help with?", "Show me the updated schedule."]
          };
        }

        // HANDLE SINGLE TOOL CALL
        if (jsonResponse.tool_name && jsonResponse.arguments) {
          const result = await this.handleToolCall(jsonResponse.tool_name, jsonResponse.arguments);
          return {
            response: result,
            followUpQuestions: ["What else can I do for you?", "Show me my schedule for today."]
          };
        }
        
        if (jsonResponse.action === 'PROMPT_FOR_CANCELLATION' && jsonResponse.data) {
          jsonResponse.data.sessions = cancellableSchedule;
          return jsonResponse;
        }
        
        if (jsonResponse.response && Array.isArray(jsonResponse.followUpQuestions)) {
            this.scheduleService.clearAllSuggestedActions();
            const generalFollowUps = [];
            for (const q of jsonResponse.followUpQuestions) {
                if (q.sessionId) {
                    this.scheduleService.addSuggestedActions(q.sessionId, [{ text: q.text }]);
                } else {
                    generalFollowUps.push(q.text || q);
                }
            }
            jsonResponse.followUpQuestions = generalFollowUps;
            return jsonResponse;
        }
        
        console.error('AI returned valid JSON but with an unknown format:', jsonResponse);
        return `Sorry, I received an unexpected response from the AI. Please try rephrasing your request.`;

      } catch (e) {
        console.error("Failed to parse JSON response from Gemini:", e, "\nRaw response:", responseText);
        return 'Sorry, I had trouble understanding the AI\'s response. Please try again.';
      }

    } catch (error) {
      console.error('Error generating response from Gemini:', error);
      const errorString = JSON.stringify(error) || '';
      if (errorString.includes('403') || (error instanceof Error && error.message.includes('403'))) {
        return "I'm having trouble connecting to the AI service due to a permission issue (Error 403). Please ask the administrator to verify that the API key is correct and has the necessary permissions enabled.";
      }
      return 'Sorry, I encountered an error communicating with the AI. Please try again later.';
    }
  }

  async handleToolCall(toolName, args) {
    if (toolName === 'update_schedule') {
        if (args.id) { // Update existing
            const existingItem = this.scheduleService.getSchedule().find(i => i.id === args.id);
            if (!existingItem) {
                return `Sorry, I couldn't find a session with ID ${args.id}.`;
            }
            const updatedItem = { ...existingItem, ...args };
            this.scheduleService.updateScheduleItem(updatedItem);
            
            if (Object.keys(args).length === 2 && args.reminderMinutes !== undefined) {
              const message = `Reminder set for the "${updatedItem.schoolName}" session.`;
              this.mcpService.sendNotification(message);
              return `Set a reminder for the "<b>${updatedItem.schoolName}</b>" session, ${args.reminderMinutes} minutes before it starts.`;
            }
            
            return `Updated the session for "<b>${updatedItem.trainer}</b>" at "<b>${updatedItem.schoolName}</b>".`;
        } else { // Add new
            const newItem = args;
            this.scheduleService.addScheduleItem(newItem);
            return `Added the new session for "<b>${newItem.trainer}</b>" at "<b>${newItem.schoolName}</b>" to the schedule.`;
        }
    }
    if (toolName === 'send_notification') {
        this.mcpService.sendNotification(args.message);
        return `Sent the notification: "${args.message}"`;
    }
    return `Unknown tool: ${toolName}`;
  }
}