export interface Chat {
  chatId: string;
  title: string | null;
  createdAt: number;
}

export interface ChatHistoryMessage {
  role: string | null;
  text: string | null;
}

export const ChatRoles = {
  user: 'user',
  assistant: 'assistant',
} as const;

export type ChatRole = (typeof ChatRoles)[keyof typeof ChatRoles];

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatResponse {
  output: string | null;
  chatId: string;
}

export interface ProductContext {
  id: string | null;
  name: string | null;
  brand: string | null;
  modelNumber: string | null;
}
