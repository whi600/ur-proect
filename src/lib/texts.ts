import rawManifest from '../data/texts-manifest.json';
import type { DocumentDetail, DocumentFragment, DocumentSummary } from '../types/legal';

/** The web build includes a small index, but never bundles all article texts. */
export const isNativeSourceSnapshotSupported = false;

export type SourceSnapshotFragmentPage = {
  fragments: DocumentFragment[];
  total: number;
};

type WebDocument = DocumentSummary & { fragments_total: number; page_count: number };
type WebManifest = { version: string; page_size: number; documents: WebDocument[] };
const manifest = rawManifest as unknown as WebManifest;
const byId = new Map(manifest.documents.map((document) => [document.id, document]));
export const SOURCE_SNAPSHOT_WEB_PAGE_COUNT = manifest.documents.reduce(
  (total, document) => total + document.page_count,
  0,
);
const textCacheName = `legal-texts-${manifest.version}`;

function pageUrl(document: WebDocument, pageNumber: number): string {
  return `/legal-texts/${manifest.version}/${document.id}/${pageNumber}.json`;
}

function normalise(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
}

function summary(document: WebDocument): DocumentSummary {
  const { fragments_total: _total, page_count: _pages, ...card } = document;
  return card;
}

async function fetchPage(
  document: WebDocument,
  offset: number,
): Promise<SourceSnapshotFragmentPage> {
  const pageNumber = Math.floor(offset / manifest.page_size);
  if (offset < 0 || offset % manifest.page_size !== 0 || pageNumber >= document.page_count) {
    throw new Error('Недопустимая страница документа.');
  }
  const response = await fetch(pageUrl(document, pageNumber));
  if (!response.ok) {
    throw new Error('Страница текста недоступна. Подключитесь к сети и попробуйте ещё раз.');
  }
  const data = (await response.json()) as {
    version?: string;
    document_id?: string;
    offset?: number;
    total?: number;
    fragments?: DocumentFragment[];
  };
  if (
    data.version !== manifest.version ||
    data.document_id !== document.id ||
    data.offset !== offset ||
    data.total !== document.fragments_total ||
    !Array.isArray(data.fragments)
  ) {
    throw new Error('Версия текста не совпадает с каталогом. Обновите приложение.');
  }
  return { fragments: data.fragments, total: data.total };
}

export async function listSourceSnapshotDocuments(): Promise<DocumentSummary[]> {
  return manifest.documents.map(summary);
}

export async function searchSourceSnapshotDocuments(query: string): Promise<DocumentSummary[]> {
  const tokens: string[] = normalise(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) return listSourceSnapshotDocuments();
  if (tokens.some((token) => token === 'кодекс' || token === 'кодексы')) {
    return manifest.documents.filter((document) => document.legal_level === 'code').map(summary);
  }
  if (tokens.includes('федеральные') && tokens.includes('законы')) {
    return manifest.documents
      .filter((document) => ['federal_law', 'law'].includes(document.legal_level ?? ''))
      .map(summary);
  }
  return manifest.documents
    .filter((document) => {
      const haystack = normalise(
        [document.title, document.document_type, document.document_number ?? ''].join(' '),
      );
      return tokens.every((token) => haystack.includes(token));
    })
    .map(summary);
}

export async function loadSourceSnapshotDocument(id: string): Promise<DocumentDetail | undefined> {
  const document = byId.get(id);
  if (!document) return undefined;
  const page = await fetchPage(document, 0);
  return {
    ...summary(document),
    content: 'Текст из открытого стороннего снимка. Юридическая сверка редакции не выполнена.',
    fragments: page.fragments,
    fragments_total: page.total,
  };
}

export async function loadSourceSnapshotFragmentPage(
  id: string,
  offset: number,
): Promise<SourceSnapshotFragmentPage | undefined> {
  const document = byId.get(id);
  if (!document) return undefined;
  return fetchPage(document, offset);
}

/** Optional one-time download; normal startup never fetches all legal texts. */
export async function downloadAllSourceSnapshotPages(
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  if (!('caches' in globalThis)) {
    throw new Error('Этот браузер не поддерживает офлайн-хранилище.');
  }
  const cache = await caches.open(textCacheName);
  const pages = manifest.documents.flatMap((document) =>
    Array.from({ length: document.page_count }, (_, pageNumber) => ({ document, pageNumber })),
  );
  let next = 0;
  let done = 0;
  onProgress(done, pages.length);
  async function worker(): Promise<void> {
    while (next < pages.length) {
      const item = pages[next++];
      const url = pageUrl(item.document, item.pageNumber);
      if (!(await cache.match(url))) {
        const response = await fetch(url);
        if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) {
          throw new Error('Загрузка текстов прервана. Повторите её при стабильном интернете.');
        }
        await cache.put(url, response);
      }
      done += 1;
      onProgress(done, pages.length);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
}
