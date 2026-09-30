import type { AssistantAnswer } from '../types/legal';

type StreamMetadata = Pick<AssistantAnswer, 'sources' | 'disclaimer'>;

export async function readAssistantStream(
  response: Response,
  onProgress: (text: string) => void,
): Promise<AssistantAnswer> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Помощник не вернул поток ответа.');

  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  let dataLines: string[] = [];
  let answer = '';
  let reachedLimit = false;
  const state: { metadata?: StreamMetadata } = {};
  let completed = false;

  const processEvent = () => {
    if (!dataLines.length) {
      eventName = '';
      return;
    }
    const data = dataLines.join('\n');
    dataLines = [];
    if (data === '[DONE]') {
      completed = true;
      eventName = '';
      return;
    }

    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      throw new Error('Помощник прислал ответ в неверном формате.');
    }
    if (eventName === 'meta') {
      if (!Array.isArray(payload?.sources) || typeof payload?.disclaimer !== 'string') {
        throw new Error('Помощник прислал ответ в неверном формате.');
      }
      state.metadata = payload;
    } else if (eventName === 'error' || payload?.error) {
      throw new Error('Ответ прервался. Попробуйте ещё раз.');
    } else {
      if (payload?.choices?.[0]?.finish_reason === 'length') reachedLimit = true;
      const delta = payload?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) {
        answer += delta;
        onProgress(answer);
      }
    }
    eventName = '';
  };

  const processLines = () => {
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      if (line === '') processEvent();
      else if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      newline = buffer.indexOf('\n');
    }
  };

  try {
    while (!completed) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      processLines();
    }
    buffer += decoder.decode();
    if (buffer) {
      buffer += '\n\n';
      processLines();
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('Ответ прервался. Попробуйте ещё раз.');
  } finally {
    await reader.cancel().catch(() => {});
  }

  if (!completed || !answer.trim() || !state.metadata) {
    throw new Error('Ответ прервался. Попробуйте ещё раз.');
  }
  return {
    mode: 'live',
    answer: reachedLimit
      ? `${answer.trim()}\n\nОтвет достиг максимальной длины и может быть неполным.`
      : answer.trim(),
    ...state.metadata,
  };
}
