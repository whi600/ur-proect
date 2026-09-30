import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorker, handleRequest, rankCatalog } from './index.mjs';

const endpoint = 'https://example.workers.dev/api/assistant/ask';

function ask(question = 'Какие права есть у покупателя при возврате товара?') {
  return new Request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
}

function environment(allowed = true) {
  return {
    POLZA_API_KEY: 'provider-secret',
    AI_RATE_LIMIT: { limit: async () => ({ success: allowed }) },
  };
}

test('catalog ranking selects a relevant document, but only metadata', () => {
  const matches = rankCatalog('Какие права есть у покупателя при возврате товара?');
  assert.equal(matches[0]?.id, 'ru-consumer-protection-law');
  assert.equal(matches[0]?.content_state, 'offline_metadata');
});

test('worker refuses paid calls without server key and a rate limiter', async () => {
  const noSecrets = await handleRequest(ask(), {}, () => {
    throw Error('must not call provider');
  });
  assert.equal(noSecrets.status, 503);

  const noLimit = await handleRequest(ask(), { POLZA_API_KEY: 'provider-secret' }, () => {
    throw Error('must not call provider');
  });
  assert.equal(noLimit.status, 503);
});

test('status requires only the server key and rate limiter', async () => {
  const statusRequest = new Request('https://example.workers.dev/api/assistant/status');
  const off = await handleRequest(statusRequest, {});
  const on = await handleRequest(statusRequest, environment());
  assert.deepEqual(await off.json(), { configured: false, revision: 'streaming-v3' });
  assert.deepEqual(await on.json(), { configured: true, revision: 'streaming-v3' });
});

test('worker validates and rate limits requests before calling model', async () => {
  const invalid = await handleRequest(ask('а'), environment(), () => {
    throw Error('must not call provider');
  });
  assert.equal(invalid.status, 400);

  const limited = await handleRequest(ask(), environment(false), () => {
    throw Error('must not call provider');
  });
  assert.equal(limited.status, 429);
});

test('worker sends bounded context to model and labels returned document cards', async () => {
  let outgoing;
  const response = await handleRequest(ask(), environment(), async (url, init) => {
    outgoing = { url, init };
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'Предварительный разбор.' } }] }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });
  const result = await response.json();
  const body = JSON.parse(outgoing.init.body);

  assert.equal(response.status, 200);
  assert.equal(outgoing.url, 'https://polza.ai/api/v1/chat/completions');
  assert.equal(outgoing.init.headers.Authorization, 'Bearer provider-secret');
  assert.equal(body.model, 'deepseek/deepseek-v4-flash');
  assert.equal(body.max_tokens, 600);
  assert.match(body.messages[0].content, /нет доступа к интернету/);
  assert.equal(result.mode, 'live');
  assert.equal(result.sources[0].document_id, 'ru-consumer-protection-law');
  assert.match(result.sources[0].fragment_label, /не статья/);
  assert.doesNotMatch(JSON.stringify(result), /provider-secret/);
});

test('worker forwards model chunks immediately after catalog metadata', async () => {
  let outgoing;
  const streamingRequest = ask();
  streamingRequest.headers.set('Accept', 'text/event-stream');
  const encoder = new TextEncoder();
  let releaseSecondChunk;
  const providerBody = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Первый "}}]}\n\n'));
      releaseSecondChunk = () => {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"фрагмент."}}]}\n\n'),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      };
    },
  });
  const response = await handleRequest(streamingRequest, environment(), async (_url, init) => {
    outgoing = JSON.parse(init.body);
    return new Response(providerBody, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  });
  assert.equal(outgoing.stream, true);
  assert.match(response.headers.get('Content-Type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  const second = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /event: meta/);
  assert.match(first, /ru-consumer-protection-law/);
  assert.match(second, /Первый/);
  releaseSecondChunk();
  const remaining = new TextDecoder().decode((await reader.read()).value);
  assert.match(remaining, /фрагмент/);
  await reader.cancel();
});

test('Cloudflare execution context is not mistaken for the provider fetch function', async () => {
  let providerCalls = 0;
  const worker = createWorker(async () => {
    providerCalls += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Ответ модели.' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const response = await worker.fetch(ask(), environment(), { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.equal(providerCalls, 1);
});

test('provider failures do not leak its response or server secrets', async () => {
  const response = await handleRequest(
    ask(),
    environment(),
    async () => new Response('secret provider diagnostics', { status: 402 }),
  );
  const body = await response.text();
  assert.equal(response.status, 502);
  assert.doesNotMatch(body, /secret provider diagnostics|provider-secret/);
});

test('provider connection diagnostics are safe to display', async () => {
  const response = await handleRequest(ask(), environment(), async () => {
    throw new TypeError('secret provider diagnostics');
  });
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.code, 'provider_connection');
  assert.doesNotMatch(JSON.stringify(body), /secret provider diagnostics|provider-secret/);
});
