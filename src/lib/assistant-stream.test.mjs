import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { readAssistantStream } from './assistant-stream.ts';
import { handleRequest } from '../../worker/index.mjs';

function chunkedResponse(chunks) {
  const bytes = new TextEncoder().encode(chunks.join(''));
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let index = 0; index < bytes.length; index += 7) {
          controller.enqueue(bytes.slice(index, index + 7));
        }
        controller.close();
      },
    }),
  );
}

test('browser stream parser assembles split UTF-8 chunks and metadata', async () => {
  const progress = [];
  const response = chunkedResponse([
    'event: meta\ndata: {"sources":[],"disclaimer":"Проверяйте закон."}\n\n',
    'data: {"choices":[{"delta":{"content":"Первая "}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"статья"}}]}\n\n',
    'data: [DONE]\n\n',
  ]);
  const result = await readAssistantStream(response, (text) => progress.push(text));
  assert.deepEqual(progress, ['Первая ', 'Первая статья']);
  assert.deepEqual(result, {
    mode: 'live',
    answer: 'Первая статья',
    sources: [],
    disclaimer: 'Проверяйте закон.',
  });
});

test('browser stream parser rejects incomplete answers', async () => {
  const response = chunkedResponse([
    'event: meta\ndata: {"sources":[],"disclaimer":"Проверяйте закон."}\n\n',
    'data: {"choices":[{"delta":{"content":"Обрыв"}}]}\n\n',
  ]);
  await assert.rejects(
    readAssistantStream(response, () => {}),
    /Ответ прервался/,
  );
});

test('browser marks answers cut off by the model limit', async () => {
  const response = chunkedResponse([
    'event: meta\ndata: {"sources":[],"disclaimer":"Проверяйте закон."}\n\n',
    'data: {"choices":[{"delta":{"content":"Начало ответа"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n',
    'data: [DONE]\n\n',
  ]);
  const result = await readAssistantStream(response, () => {});
  assert.match(result.answer, /может быть неполным/);
});

test('browser stream parser does not expose provider error details', async () => {
  const response = chunkedResponse(['data: {"error":"private provider diagnostics"}\n\n']);
  await assert.rejects(
    readAssistantStream(response, () => {}),
    /Ответ прервался/,
  );
});

test('browser reads a streamed answer from the Worker protocol', async () => {
  const request = new Request('https://example.workers.dev/api/assistant/ask', {
    method: 'POST',
    headers: { Accept: 'text/event-stream' },
    body: JSON.stringify({
      question: 'Как вернуть товар покупателю?',
      references: [
        { document_id: 'ru-consumer-protection-law', page_number: 1, fragment_id: 10849 },
      ],
    }),
  });
  const environment = {
    POLZA_API_KEY: 'test-secret',
    AI_RATE_LIMIT: { limit: async () => ({ success: true }) },
    ASSETS: {
      async fetch(request) {
        const pathname = new URL(request.url).pathname;
        return new Response(await readFile(new URL(`../../public${pathname}`, import.meta.url)));
      },
    },
  };
  const response = await handleRequest(request, environment, async () =>
    chunkedResponse([
      'data: {"choices":[{"delta":{"content":"Проверьте закон."}}]}\n\n',
      'data: [DONE]\n\n',
    ]),
  );
  const result = await readAssistantStream(response, () => {});
  assert.equal(result.answer, 'Проверьте закон.');
  assert.equal(result.mode, 'live');
  assert.ok(result.sources.length > 0);
});
