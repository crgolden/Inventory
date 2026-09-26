export const MANUALS_API_PREFIX = '/manuals/api';

export const CHATS_PATH = '/chats';

export const CHATS_URL = `${MANUALS_API_PREFIX}${CHATS_PATH}`;

export const JSON_CONTENT_TYPE = 'application/json';

export const MERGE_PATCH_CONTENT_TYPE = 'application/merge-patch+json';

export const SseFraming = {
  dataPrefix: 'data: ',
  done: '[DONE]',
} as const;

export function chatUrl(chatId: string): string {
  return `${CHATS_URL}/${chatId}`;
}

export function chatMessagesUrl(chatId: string): string {
  return `${chatUrl(chatId)}/messages`;
}

export function chatStreamUrl(chatId: string): string {
  return `${chatMessagesUrl(chatId)}/stream`;
}

export function frameNotJsonMessage(data: string): string {
  return `The manual stream sent a frame that is not JSON: ${data}`;
}

export function frameWithoutDeltaMessage(data: string): string {
  return `The manual stream sent a frame carrying no delta.content: ${data}`;
}
