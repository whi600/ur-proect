import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChatHistory, recentConversationMessages } from './chat-memory.ts';

test('chat memory keeps recent messages within 250 thousand characters', () => {
  const messages = [
    { role: 'user', text: 'старый вопрос' },
    { role: 'assistant', text: 'А'.repeat(200_000), answer: {} },
    { role: 'user', text: 'новый вопрос' },
    { role: 'assistant', text: 'Б'.repeat(60_000), answer: {} },
  ];
  const history = buildChatHistory(messages);
  assert.deepEqual(
    history.map(({ role }) => role),
    ['user', 'assistant'],
  );
  assert.equal(history[0].content, 'новый вопрос');
  assert.ok(history.reduce((total, item) => total + item.content.length, 0) <= 250_000);
});

test('chat memory excludes errors and unfinished answers', () => {
  const messages = [
    { role: 'user', text: 'Первый вопрос' },
    { role: 'assistant', text: 'Первый ответ', answer: {} },
    { role: 'error', text: 'Ошибка' },
    { role: 'assistant', text: 'Готовим ответ…' },
  ];
  assert.deepEqual(buildChatHistory(messages), [
    { role: 'user', content: 'Первый вопрос' },
    { role: 'assistant', content: 'Первый ответ' },
  ]);
  assert.equal(recentConversationMessages(messages).length, 2);
});
