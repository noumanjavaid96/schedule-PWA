export interface ScheduleItem {
  id: number;
  schoolName: string;
  topic: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: 'Confirmed' | 'Pending' | 'Cancelled';
  trainer: string;
  cancellationReason?: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'tool';
  content: string;
  isLoading?: boolean;
  followUpQuestions?: string[];
  action?: 'PROMPT_FOR_CANCELLATION';
  actionData?: {
    prompt: string;
    sessions: ScheduleItem[];
  };
}