export const CHAT_CONTEXT_LIMIT = 250_000;

type ChatLike = {
  role: 'user' | 'assistant' | 'error';
  text: string;
  answer?: unknown;
};

export type ChatHistoryItem = { role: 'user' | 'assistant'; content: string };

export function recentConversationMessages<T extends ChatLike>(
  messages: readonly T[],
  limit = CHAT_CONTEXT_LIMIT,
): T[] {
  const recent: T[] = [];
  let used = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'error' || (message.role === 'assistant' && !message.answer)) continue;
    if (!message.text.trim()) continue;
    if (used + message.text.length > limit) break;
    recent.push(message);
    used += message.text.length;
  }
  return recent.reverse();
}

export function buildChatHistory(messages: readonly ChatLike[]): ChatHistoryItem[] {
  return recentConversationMessages(messages).map(({ role, text }) => ({
    role: role as 'user' | 'assistant',
    content: text,
  }));
}
