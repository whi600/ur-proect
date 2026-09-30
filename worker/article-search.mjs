import manifest from '../src/data/texts-manifest.json' with { type: 'json' };

export const INDEX_VERSION = 'v1';
export const SHARD_COUNT = 64;
const MAX_SOURCES = 5;
const STOPWORDS = new Set([
  'этот',
  'эта',
  'эти',
  'если',
  'когда',
  'какой',
  'какая',
  'какие',
  'котор',
  'можно',
  'нужно',
  'надо',
  'есть',
  'быть',
  'будет',
  'после',
  'перед',
  'также',
  'только',
  'статья',
  'статьи',
  'статью',
  'закон',
  'закона',
  'кодекс',
  'кодекса',
  'российск',
  'федерац',
  'часть',
  'пункт',
  'права',
  'право',
  'лица',
  'лицо',
  'отношен',
  'говорит',
  'расскажи',
  'объясни',
]);

export function normalizeText(value) {
  return value.normalize('NFKC').toLowerCase().replaceAll('ё', 'е');
}

export function stems(value) {
  return [
    ...new Set(
      (normalizeText(value).match(/[\p{L}\p{N}]+/gu) ?? [])
        .filter((word) => word.length >= 4 && !STOPWORDS.has(word))
        .map((word) => word.slice(0, 4)),
    ),
  ];
}

export function shardFor(stem) {
  let hash = 0;
  for (const character of stem) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  return hash % SHARD_COUNT;
}

export function packReference(documentIndex, pageNumber, fragmentIndex) {
  return documentIndex * 65536 + pageNumber * 256 + fragmentIndex;
}

function unpackReference(value) {
  return {
    documentIndex: Math.floor(value / 65536),
    pageNumber: Math.floor((value % 65536) / 256),
    fragmentIndex: value % 256,
  };
}

function queryTerms(question) {
  const terms = stems(question).slice(0, 8);
  const normalized = normalizeText(question);
  if (/(верну|возврат|покупател|товар)/u.test(normalized)) {
    terms.push('потр', 'возв', 'това');
  }
  if (/(увол|трудов|работодател)/u.test(normalized)) {
    terms.push('труд', 'увол', 'раст');
  }
  return [...new Set(terms)].slice(0, 10);
}

async function assetJson(assets, path) {
  const response = await assets.fetch(new Request(`https://assets.local${path}`));
  if (!response.ok) throw new Error(`Не удалось открыть индекс: ${path}`);
  return response.json();
}

function excerptFor(body, terms) {
  const normalized = normalizeText(body);
  const positions = terms
    .map((term) => normalized.indexOf(term))
    .filter((position) => position >= 0);
  const first = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, first - 200);
  const excerpt = body.slice(start, start + 1800).trim();
  return `${start ? '…' : ''}${excerpt}${start + 1800 < body.length ? '…' : ''}`;
}

function phraseBonus(question, body) {
  const stemWord = (word) => (word.length >= 4 ? word.slice(0, 4) : word);
  const words = (normalizeText(question).match(/[\p{L}\p{N}]+/gu) ?? []).map(stemWord);
  const text = (normalizeText(body).match(/[\p{L}\p{N}]+/gu) ?? []).map(stemWord).join(' ');
  for (let length = Math.min(4, words.length); length >= 2; length -= 1) {
    for (let index = 0; index <= words.length - length; index += 1) {
      const phrase = words.slice(index, index + length);
      if (phrase.filter((word) => word.length >= 4).length < 2) continue;
      if (text.includes(phrase.join(' '))) return length * 15;
    }
  }
  return 0;
}

export async function findArticleSources(question, assets, preferredDocuments = []) {
  if (!assets?.fetch) throw new Error('Хранилище текстов не подключено.');
  const terms = queryTerms(question);
  const articleNumber = /(?:статья|статье|статью|ст\.)\s*(\d+(?:\.\d+)*)/iu.exec(question)?.[1];
  if (!terms.length && !articleNumber) return [];
  const shards = new Map();
  for (const term of terms) {
    const shard = shardFor(term);
    if (!shards.has(shard)) shards.set(shard, []);
    shards.get(shard).push(term);
  }
  const shardData = await Promise.all(
    [...shards].map(async ([shard, words]) => {
      const file = `${String(shard).padStart(2, '0')}.json`;
      const data = await assetJson(assets, `/ai-index/${INDEX_VERSION}/${file}`);
      return { words, postings: data.postings ?? {} };
    }),
  );
  const lengths = await assetJson(assets, `/ai-index/${INDEX_VERSION}/lengths.json`);

  const scores = new Map();
  for (const { words, postings } of shardData) {
    for (const word of words) {
      const references = postings[word] ?? [];
      if (references.length > 2500) continue; // Very common terms add noise and cost.
      const weight = Math.max(1, Math.log2(11000 / (references.length + 1)));
      for (const reference of references)
        scores.set(reference, (scores.get(reference) ?? 0) + weight);
    }
  }
  if (articleNumber) {
    const labels = await assetJson(assets, `/ai-index/${INDEX_VERSION}/labels.json`);
    for (const reference of labels[articleNumber] ?? []) {
      scores.set(reference, (scores.get(reference) ?? 0) + 80);
    }
  }
  if (!scores.size) return [];

  const titleTokens = stems(question);
  const preferred = new Map(
    preferredDocuments.map((document, index) => [document.id, 20 - index * 3]),
  );
  const candidates = [...scores]
    .map(([reference, score]) => {
      const position = unpackReference(reference);
      const document = manifest.documents[position.documentIndex];
      const title = normalizeText(`${document.title} ${document.document_number ?? ''}`);
      const titleBoost =
        titleTokens.filter((token) => title.includes(token)).length * (articleNumber ? 60 : 10);
      const domainBoost =
        /(увол|трудов|работодател)/u.test(normalizeText(question)) &&
        document.id === 'ru-labour-code'
          ? 25
          : /(верну|возврат|покупател|товар)/u.test(normalizeText(question)) &&
              document.id === 'ru-consumer-protection-law'
            ? 25
            : 0;
      const lengthPenalty = Math.log2(2 + (lengths[reference] ?? 1000) / 300);
      return {
        ...position,
        document,
        score: score / lengthPenalty + titleBoost + (preferred.get(document.id) ?? 0) + domainBoost,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const pages = new Map();
  await Promise.all(
    candidates.map(async (candidate) => {
      const key = `${candidate.document.id}/${candidate.pageNumber}`;
      if (!pages.has(key)) {
        pages.set(key, assetJson(assets, `/legal-texts/${manifest.version}/${key}.json`));
      }
      await pages.get(key);
    }),
  );

  const resolved = await Promise.all(
    candidates.map(async (candidate) => {
      const page = await pages.get(`${candidate.document.id}/${candidate.pageNumber}`);
      const fragment = page.fragments?.[candidate.fragmentIndex];
      const phraseScore = phraseBonus(question, fragment?.body ?? '');
      return { ...candidate, fragment, phraseScore, score: candidate.score + phraseScore };
    }),
  );
  resolved.sort((a, b) => b.score - a.score);
  const strongestPhrase = Math.max(0, ...resolved.map((candidate) => candidate.phraseScore));
  const distinct = new Set();
  const sources = [];
  for (const candidate of resolved) {
    if (strongestPhrase >= 30 && candidate.phraseScore < strongestPhrase - 15) continue;
    const fragment = candidate.fragment;
    if (
      !fragment ||
      fragment.kind !== 'article' ||
      !fragment.body ||
      distinct.has(fragment.id + ':' + candidate.document.id)
    )
      continue;
    distinct.add(fragment.id + ':' + candidate.document.id);
    const internalUrl = `/document/${encodeURIComponent(candidate.document.id)}?page=${candidate.pageNumber}#fragment-${fragment.id}`;
    sources.push({
      document_id: candidate.document.id,
      title: candidate.document.title,
      page_number: candidate.pageNumber,
      fragment_id: fragment.id,
      fragment_label: fragment.label ?? fragment.heading,
      excerpt: excerptFor(fragment.body, terms),
      internal_url: internalUrl,
      source_url: candidate.document.source_url,
      is_demo: false,
    });
    if (sources.length === MAX_SOURCES) break;
  }
  return sources;
}

export async function validateArticleReferences(question, references, assets) {
  if (!Array.isArray(references) || references.length > MAX_SOURCES) {
    throw new Error('Неверный список статей.');
  }
  if (!references.length) return [];
  if (!assets?.fetch) throw new Error('Хранилище текстов не подключено.');
  const documents = new Map(manifest.documents.map((document) => [document.id, document]));
  const pages = new Map();
  const seen = new Set();
  const verified = [];
  for (const reference of references) {
    const document = documents.get(reference?.document_id);
    const pageNumber = reference?.page_number;
    const fragmentId = reference?.fragment_id;
    if (
      !document ||
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 0 ||
      pageNumber >= document.page_count ||
      !Number.isSafeInteger(fragmentId) ||
      seen.has(`${document.id}:${fragmentId}`)
    ) {
      throw new Error('Неверная ссылка на статью.');
    }
    seen.add(`${document.id}:${fragmentId}`);
    const key = `${document.id}/${pageNumber}`;
    if (!pages.has(key)) {
      pages.set(key, assetJson(assets, `/legal-texts/${manifest.version}/${key}.json`));
    }
    verified.push({ document, pageNumber, fragmentId, page: pages.get(key) });
  }
  return Promise.all(
    verified.map(async ({ document, pageNumber, fragmentId, page }) => {
      const data = await page;
      if (
        data.version !== manifest.version ||
        data.document_id !== document.id ||
        data.offset !== pageNumber * manifest.page_size
      ) {
        throw new Error('Страница статьи не совпадает с каталогом.');
      }
      const fragment = data.fragments?.find((item) => item.id === fragmentId);
      if (!fragment || fragment.kind !== 'article' || !fragment.body) {
        throw new Error('Статья не найдена на указанной странице.');
      }
      return {
        document_id: document.id,
        title: document.title,
        page_number: pageNumber,
        fragment_id: fragment.id,
        fragment_label: fragment.label ?? fragment.heading,
        excerpt: excerptFor(fragment.body, queryTerms(question)),
        internal_url: `/document/${encodeURIComponent(document.id)}?page=${pageNumber}#fragment-${fragment.id}`,
        source_url: document.source_url,
        is_demo: false,
      };
    }),
  );
}
