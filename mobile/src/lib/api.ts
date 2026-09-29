import { Platform } from 'react-native';

import { findDemoDocument } from '../data/demoDocuments';
import { findOfflineCatalogDocument, searchOfflineCatalog } from '../data/offlineCatalog';
import {
  isNativeSourceSnapshotSupported,
  listSourceSnapshotDocuments,
  loadSourceSnapshotDocument,
  loadSourceSnapshotFragmentPage,
  searchSourceSnapshotDocuments,
  type SourceSnapshotFragmentPage,
} from './sourceSnapshotCatalog';
import type {
  AssistantAnswer,
  DocumentDetail,
  DocumentSummary,
  HealthResponse,
  LoadResult,
  SearchResponse,
} from '../types/legal';

// Браузер на этом компьютере может ходить в localhost, тогда как Expo Go на
// iPhone должен обращаться к LAN-адресу компьютера. Оба адреса хранятся
// локально в mobile/.env и не содержат секретов.
const configuredUrl =
  (Platform.OS === 'web'
    ? (process.env.EXPO_PUBLIC_API_BASE_URL_WEB?.trim() ??
      process.env.EXPO_PUBLIC_API_BASE_URL?.trim())
    : process.env.EXPO_PUBLIC_API_BASE_URL?.trim()) ?? '';
// The published PWA reads static legal pages, not the development FastAPI.
// In particular, the developer's LAN/localhost address must not be embedded.
const isRemoteWeb =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  !['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isRemoteWeb ? '' : configuredUrl.replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 7_000;

export const isApiConfigured = API_BASE_URL.length > 0;

export type ApiStatus =
  | { kind: 'online'; message: string }
  | { kind: 'not-configured'; message: string }
  | { kind: 'unavailable'; message: string };

class ApiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiRequestError('Адрес API не задан в mobile/.env.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiRequestError(`API вернул ${response.status}.`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiRequestError('API не ответил за 7 секунд.');
    }
    throw new ApiRequestError('Не удалось подключиться к локальному API.');
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackNotice(error?: unknown): string {
  const detail = error instanceof Error ? error.message : 'Неизвестная ошибка подключения.';
  return `Серверный контур недоступен. ${detail}`;
}

function sourceSnapshotFailureNotice(error: unknown): string {
  const detail = error instanceof Error ? error.message : 'Неизвестная ошибка локального пакета.';
  return `Библиотека текстов не открылась. Показываем карточки реквизитов. ${detail}`;
}

function mergeWithMetadata(
  sourceSnapshotDocuments: DocumentSummary[],
  metadataDocuments: DocumentSummary[],
): DocumentSummary[] {
  const byId = new Map<string, DocumentSummary>();
  for (const document of sourceSnapshotDocuments) {
    byId.set(document.id, document);
  }
  for (const document of metadataDocuments) {
    if (!byId.has(document.id)) {
      byId.set(document.id, document);
    }
  }
  return [...byId.values()];
}

export async function checkApi(): Promise<ApiStatus> {
  if (!isApiConfigured) {
    return {
      kind: 'not-configured',
      message: 'API не настроен. Каталог реквизитов доступен в приложении.',
    };
  }

  try {
    const health = await request<HealthResponse>('/health');
    return {
      kind: 'online',
      message: `API доступен · режим ${health.data_mode} · v${health.version}. Каталог работает отдельно.`,
    };
  } catch (error) {
    return { kind: 'unavailable', message: fallbackNotice(error) };
  }
}

export async function loadDocuments(query = ''): Promise<LoadResult<DocumentSummary[]>> {
  const metadataDocuments = searchOfflineCatalog(query);
  if (Platform.OS === 'web') {
    try {
      const sourceSnapshotDocuments = query.trim()
        ? await searchSourceSnapshotDocuments(query)
        : await listSourceSnapshotDocuments();
      return {
        data: mergeWithMetadata(sourceSnapshotDocuments, metadataDocuments),
        origin: 'offline-catalog',
      };
    } catch (error) {
      return {
        data: metadataDocuments,
        origin: 'offline-catalog',
        notice: sourceSnapshotFailureNotice(error),
      };
    }
  }

  if (!isNativeSourceSnapshotSupported) {
    return { data: metadataDocuments, origin: 'offline-catalog' };
  }

  try {
    const sourceSnapshotDocuments = query.trim()
      ? await searchSourceSnapshotDocuments(query)
      : await listSourceSnapshotDocuments();
    return {
      data: mergeWithMetadata(sourceSnapshotDocuments, metadataDocuments),
      origin: 'offline-catalog',
    };
  } catch (error) {
    return {
      data: metadataDocuments,
      origin: 'offline-catalog',
      notice: sourceSnapshotFailureNotice(error),
    };
  }
}

export async function searchDocuments(query: string): Promise<LoadResult<SearchResponse>> {
  const trimmedQuery = query.trim();
  const result = await loadDocuments(trimmedQuery);
  return {
    data: { query: trimmedQuery, results: result.data },
    origin: result.origin,
    notice: result.notice,
  };
}

export async function loadDocument(id: string): Promise<LoadResult<DocumentDetail | undefined>> {
  let snapshotNotice: string | undefined;
  if (Platform.OS === 'web') {
    try {
      const data = await loadSourceSnapshotDocument(id);
      if (data) return { data, origin: 'offline-catalog' };
    } catch (error) {
      snapshotNotice = sourceSnapshotFailureNotice(error);
    }
  }

  if (isNativeSourceSnapshotSupported) {
    try {
      const sourceSnapshotDocument = await loadSourceSnapshotDocument(id);
      if (sourceSnapshotDocument) {
        return { data: sourceSnapshotDocument, origin: 'offline-catalog' };
      }
    } catch (error) {
      snapshotNotice = sourceSnapshotFailureNotice(error);
    }
  }

  const offlineDocument = findOfflineCatalogDocument(id);
  if (offlineDocument) {
    return { data: offlineDocument, origin: 'offline-catalog', notice: snapshotNotice };
  }

  // Teaching material remains reachable from the explicitly labelled assistant
  // demo, but it is never mixed into the ordinary document catalogue.
  const demoDocument = findDemoDocument(id);
  if (demoDocument) {
    return { data: demoDocument, origin: 'local-demo' };
  }

  if (!isApiConfigured) {
    return { data: undefined, origin: 'offline-catalog', notice: snapshotNotice };
  }

  try {
    const data = await request<DocumentDetail>(`/documents/${encodeURIComponent(id)}`);
    return { data, origin: 'api' };
  } catch (error) {
    return {
      data: undefined,
      origin: 'offline-catalog',
      notice: fallbackNotice(error),
    };
  }
}

/** Loads one more page of locally stored text for a source-snapshot document. */
export async function loadMoreDocumentFragments(
  id: string,
  offset: number,
): Promise<SourceSnapshotFragmentPage | undefined> {
  if (Platform.OS === 'web') {
    return loadSourceSnapshotFragmentPage(id, offset);
  }
  if (!isNativeSourceSnapshotSupported) {
    return undefined;
  }
  return loadSourceSnapshotFragmentPage(id, offset);
}

export async function askAssistant(payload: {
  question: string;
  as_of_date?: string;
  circumstances?: string;
  accessCode: string;
}): Promise<LoadResult<AssistantAnswer | undefined>> {
  const endpoint =
    Platform.OS === 'web'
      ? process.env.EXPO_PUBLIC_ASSISTANT_API_URL_WEB?.trim() || '/api/assistant/ask'
      : process.env.EXPO_PUBLIC_ASSISTANT_API_URL?.trim() ||
        'https://ur-proect.gudronovandrej.workers.dev/api/assistant/ask';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Assistant-Access': payload.accessCode,
      },
      body: JSON.stringify({
        question: payload.question,
        as_of_date: payload.as_of_date,
        circumstances: payload.circumstances,
      }),
      signal: controller.signal,
    });
    const data = (await response.json()) as AssistantAnswer & { error?: string };
    if (!response.ok) {
      return {
        data: undefined,
        origin: 'api',
        notice: data.error || `Помощник сейчас недоступен (ошибка ${response.status}).`,
      };
    }
    if (data.mode !== 'live' || typeof data.answer !== 'string') {
      return { data: undefined, origin: 'api', notice: 'Сервер вернул неожиданный ответ.' };
    }
    return { data, origin: 'api' };
  } catch (error) {
    return {
      data: undefined,
      origin: 'api',
      notice:
        error instanceof Error && error.name === 'AbortError'
          ? 'Помощник не ответил за 35 секунд.'
          : 'Не удалось связаться с помощником. Проверьте интернет и адрес сервиса.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
