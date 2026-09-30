import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  filterDocuments,
  getDocument,
  listDocuments,
  loadSourceSnapshotFragmentPage,
} from './lib/catalog';
import {
  downloadAllSourceSnapshotPages,
  SOURCE_SNAPSHOT_PAGE_SIZE,
  SOURCE_SNAPSHOT_WEB_PAGE_COUNT,
} from './lib/texts';
import { readAssistantStream } from './lib/assistant-stream';
import { buildChatHistory, recentConversationMessages } from './lib/chat-memory';
// Shared search runs in the browser; the Worker independently verifies its results.
// @ts-expect-error The shared .mjs module is exercised by Node tests.
import { findArticleSources } from '../worker/article-search.mjs';
import type {
  AssistantAnswer,
  DocumentDetail,
  DocumentFragment,
  DocumentSummary,
} from './types/legal';

const FAVORITES_KEY = '@pravo-orbita/favorite-document-ids/v1';
const CHAT_KEY = '@pravo-orbita/assistant-chat/v1';

function readFavorites(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function useViewportHeight() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      document.documentElement.style.setProperty(
        '--app-height',
        `${viewport?.height ?? window.innerHeight}px`,
      );
    };
    update();
    viewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
    };
  }, []);
}

function DocumentList({ documents }: { documents: DocumentSummary[] }) {
  if (!documents.length)
    return <div className="empty">Документы не найдены. Попробуйте другое название или номер.</div>;
  return (
    <div className="document-list">
      {documents.map((document) => (
        <a
          className="document-row"
          href={`/document/${encodeURIComponent(document.id)}`}
          key={document.id}
        >
          <span className="document-icon">§</span>
          <span className="document-row-copy">
            <strong>{document.title}</strong>
            <small>
              {document.document_type}
              {document.document_number ? ` · ${document.document_number}` : ''}
            </small>
          </span>
          <span className="row-arrow" aria-hidden="true">
            ›
          </span>
        </a>
      ))}
    </div>
  );
}

function Home({ documents }: { documents: DocumentSummary[] }) {
  const [query, setQuery] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState('');
  const textCount = documents.filter((item) => item.content_state === 'source_snapshot').length;

  const download = async () => {
    setDownloading(true);
    setProgress('Подготавливаем библиотеку…');
    try {
      await downloadAllSourceSnapshotPages((done, total) => {
        if (done % 12 === 0 || done === total) setProgress(`Сохранено ${done} из ${total} частей`);
      });
      setProgress('Тексты сохранены в этом браузере для чтения без сети.');
    } catch (error) {
      setProgress(error instanceof Error ? error.message : 'Загрузка прервалась. Повторите позже.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="page home-page">
      <section className="hero">
        <div className="eyebrow">ПРАВООРБИТА · ПРАВОВАЯ БИБЛИОТЕКА</div>
        <h1>Найдите нужный документ</h1>
        <p>Конституция, основные кодексы и ключевые федеральные законы — в одном каталоге.</p>
        <form className="search-form" action="/search" method="get">
          <label htmlFor="home-search">Поиск документов</label>
          <div className="search-line">
            <input
              id="home-search"
              name="q"
              placeholder="Название, номер или тема"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit">Найти</button>
          </div>
        </form>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2>Каталог</h2>
            <p>Выберите раздел или откройте весь список</p>
          </div>
          <a href="/search">Все документы →</a>
        </div>
        <div className="category-grid">
          <a className="category-card" href="/document/ru-constitution-source">
            <span className="category-number">01</span>
            <strong>Конституция</strong>
            <span>Основной закон Российской Федерации</span>
            <b aria-hidden="true">→</b>
          </a>
          <a className="category-card" href="/search?q=кодексы">
            <span className="category-number">02</span>
            <strong>Кодексы</strong>
            <span>Гражданское, уголовное, трудовое и другие направления</span>
            <b aria-hidden="true">→</b>
          </a>
          <a className="category-card" href="/search?q=федеральные+законы">
            <span className="category-number">03</span>
            <strong>Федеральные законы</strong>
            <span>Важные отраслевые акты</span>
            <b aria-hidden="true">→</b>
          </a>
        </div>
      </section>

      <a className="assistant-promo" href="/assistant">
        <span className="eyebrow">ИИ-ПОМОЩНИК</span>
        <strong>Не знаете, с чего начать?</strong>
        <span>Задайте вопрос и получите предварительный разбор.</span>
        <b>Открыть помощника →</b>
      </a>

      <section className="offline-panel">
        <div>
          <h2>Чтение без сети</h2>
          <p>
            Каталог доступен сразу. Тексты {textCount} документов загружаются по мере чтения; все{' '}
            {SOURCE_SNAPSHOT_WEB_PAGE_COUNT} небольших частей можно сохранить заранее.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void download()}
          disabled={downloading}
        >
          {downloading ? 'Сохраняем…' : 'Сохранить все тексты'}
        </button>
        {progress && (
          <p className="progress" role="status">
            {progress}
          </p>
        )}
      </section>
      <p className="small-note">
        Тексты взяты из стороннего снимка. Редакции не прошли юридическую сверку; для применения
        нормы проверьте официальный источник на нужную дату.
      </p>
    </div>
  );
}

function Search({ documents }: { documents: DocumentSummary[] }) {
  const initialQuery = new URLSearchParams(window.location.search).get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(() => filterDocuments(documents, query), [documents, query]);
  return (
    <div className="page">
      <header className="page-intro">
        <h1>Каталог документов</h1>
        <p>Поиск по названию, номеру и теме</p>
      </header>
      <div className="search-panel">
        <label htmlFor="catalog-search">Найти в каталоге</label>
        <input
          id="catalog-search"
          type="search"
          placeholder="Например, Гражданский кодекс"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="chips">
          <button type="button" onClick={() => setQuery('конституция')}>
            Конституция
          </button>
          <button type="button" onClick={() => setQuery('кодексы')}>
            Кодексы
          </button>
          <button type="button" onClick={() => setQuery('федеральные законы')}>
            Федеральные законы
          </button>
        </div>
      </div>
      <div className="section-heading results-heading">
        <div>
          <h2>{query ? 'Результаты поиска' : 'Все документы'}</h2>
          <p>{results.length} документов</p>
        </div>
      </div>
      <DocumentList documents={results} />
    </div>
  );
}

function Fragment({ fragment }: { fragment: DocumentFragment }) {
  return (
    <article className="fragment" id={`fragment-${fragment.id}`}>
      <h3>{fragment.label ?? fragment.heading}</h3>
      {fragment.heading && fragment.heading !== fragment.label && <h4>{fragment.heading}</h4>}
      <p>
        {fragment.body || fragment.legal_status || 'Текст фрагмента отсутствует в исходном снимке.'}
      </p>
    </article>
  );
}

function DocumentPage({
  id,
  favorites,
  toggleFavorite,
}: {
  id: string;
  favorites: string[];
  toggleFavorite: (id: string) => void;
}) {
  const [document, setDocument] = useState<DocumentDetail>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const requestedPage = Number(new URLSearchParams(window.location.search).get('page') ?? 0);
  const startOffset =
    Number.isSafeInteger(requestedPage) && requestedPage >= 0
      ? requestedPage * SOURCE_SNAPSHOT_PAGE_SIZE
      : 0;
  const reload = () => {
    setLoading(true);
    setError('');
    void getDocument(id, startOffset)
      .then(setDocument)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Не удалось открыть документ.'),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    let active = true;
    void getDocument(id, startOffset)
      .then((result) => {
        if (active) setDocument(result);
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Не удалось открыть документ.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, startOffset]);
  useEffect(() => {
    if (loading || !document?.fragments || !window.location.hash) return;
    const target = window.document.getElementById(
      decodeURIComponent(window.location.hash.slice(1)),
    );
    target?.scrollIntoView({ block: 'start' });
  }, [document, loading]);
  const loadMore = async () => {
    if (!document?.fragments || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = await loadSourceSnapshotFragmentPage(
        id,
        startOffset + document.fragments.length,
      );
      if (page)
        setDocument({
          ...document,
          fragments: [...document.fragments, ...page.fragments],
          fragments_total: page.total,
        });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Не удалось загрузить следующую часть текста.',
      );
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="page document-page">
      <a className="back-link" href="/search">
        ← К каталогу
      </a>
      {loading && <p role="status">Открываем документ…</p>}
      {error && (
        <div className="error-panel" role="alert">
          {error}{' '}
          <button type="button" onClick={reload}>
            Повторить
          </button>
        </div>
      )}
      {!loading && !document && !error && (
        <div className="empty">Документ не найден в каталоге.</div>
      )}
      {document && (
        <>
          <section className="document-header">
            <span className="eyebrow">{document.document_type}</span>
            <h1>{document.title}</h1>
            <p>{document.document_number}</p>
            <button className="secondary-button" type="button" onClick={() => toggleFavorite(id)}>
              {favorites.includes(id) ? '★ В избранном' : '☆ Добавить в избранное'}
            </button>
          </section>
          <div className="document-meta">
            <span>Источник: {document.source_name}</span>
            <span>{document.revision_label}</span>
            {document.source_url && (
              <a href={document.source_url} target="_blank" rel="noreferrer">
                Открыть источник ↗
              </a>
            )}
          </div>
          <p className="legal-note">
            Текст из стороннего снимка; юридическая сверка редакции не выполнена. Перед
            использованием нормы сравните её с официальной публикацией на нужную дату.
          </p>
          {document.content_state !== 'source_snapshot' && (
            <div className="empty">{document.content}</div>
          )}
          {document.fragments && (
            <section className="fragments">
              <div className="section-heading">
                <div>
                  <h2>Статьи и разделы</h2>
                  <p>
                    Показано {startOffset + document.fragments.length} из{' '}
                    {document.fragments_total ?? document.fragments.length}
                  </p>
                </div>
                {startOffset > 0 && (
                  <a href={`/document/${encodeURIComponent(id)}`}>К началу документа ↑</a>
                )}
              </div>
              {document.fragments.map((fragment) => (
                <Fragment fragment={fragment} key={fragment.id} />
              ))}
              {(document.fragments_total ?? 0) > startOffset + document.fragments.length && (
                <button
                  className="more-button"
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? 'Загружаем…' : 'Показать следующие статьи'}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Favorites({
  documents,
  favorites,
}: {
  documents: DocumentSummary[];
  favorites: string[];
}) {
  const chosen = favorites
    .map((id) => documents.find((document) => document.id === id))
    .filter((document): document is DocumentSummary => Boolean(document));
  return (
    <div className="page">
      <header className="page-intro">
        <h1>Избранное</h1>
        <p>Документы, которые вы сохранили на этом устройстве</p>
      </header>
      {chosen.length ? (
        <DocumentList documents={chosen} />
      ) : (
        <div className="empty">
          Здесь пока пусто. Откройте документ в каталоге и нажмите «Добавить в избранное».
        </div>
      )}
    </div>
  );
}

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant' | 'error';
  text: string;
  answer?: AssistantAnswer;
};

function sourceHref(source: AssistantAnswer['sources'][number]): string {
  return source.internal_url &&
    /^\/document\/[a-z0-9-]+\?page=\d+#fragment-\d+$/.test(source.internal_url)
    ? source.internal_url
    : `/document/${encodeURIComponent(source.document_id)}`;
}

function linkedAnswer(text: string, answer?: AssistantAnswer) {
  if (!answer?.sources.length) return text;
  return text.split(/(\[\d{1,2}\])/g).map((part, index) => {
    const match = /^\[(\d{1,2})\]$/.exec(part);
    const source = match ? answer.sources[Number(match[1]) - 1] : undefined;
    return source ? (
      <a href={sourceHref(source)} key={index} title={`${source.title}, ${source.fragment_label}`}>
        {part}
      </a>
    ) : (
      part
    );
  });
}

function readChatMessages(): ChatMessage[] {
  try {
    const saved = JSON.parse(localStorage.getItem(CHAT_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    const valid = saved.filter(
      (message): message is ChatMessage =>
        typeof message?.id === 'number' &&
        typeof message?.text === 'string' &&
        (message.role === 'user' ||
          (message.role === 'assistant' &&
            typeof message.answer?.answer === 'string' &&
            Array.isArray(message.answer?.sources) &&
            typeof message.answer?.disclaimer === 'string')),
    );
    return recentConversationMessages(valid);
  } catch {
    return [];
  }
}

function Assistant() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(readChatMessages);
  const [pending, setPending] = useState(false);
  const [validation, setValidation] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const stoppedByUser = useRef(false);
  useEffect(() => {
    if (pending) return;
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(recentConversationMessages(messages)));
    } catch {
      // The chat still works if the browser disables local storage.
    }
  }, [messages, pending]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: pending ? 'auto' : 'smooth', block: 'end' });
  }, [messages, pending]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 3) {
      setValidation('Введите вопрос хотя бы из трёх символов.');
      return;
    }
    if (pending) return;
    const history = buildChatHistory(messages);
    setValidation('');
    setQuestion('');
    const userId = Date.now();
    const answerId = userId + 1;
    setMessages((previous) => [
      ...previous,
      { id: userId, role: 'user', text },
      { id: answerId, role: 'assistant', text: 'Готовим ответ…' },
    ]);
    setPending(true);
    const controller = new AbortController();
    activeRequest.current = controller;
    stoppedByUser.current = false;
    const timeout = window.setTimeout(() => controller.abort(), 610_000);
    let frame: number | null = null;
    let latestText = '';
    const showProgress = (value: string) => {
      latestText = value;
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setMessages((previous) =>
          previous.map((message) =>
            message.id === answerId ? { ...message, text: latestText } : message,
          ),
        );
      });
    };
    try {
      const greeting = /^(привет|здравствуйте|добрый день|добрый вечер|спасибо)[!. ]*$/iu.test(
        text,
      );
      showProgress(greeting ? 'Готовим ответ…' : 'Ищем статьи в каталоге…');
      const found = greeting
        ? []
        : ((await findArticleSources(text, {
            fetch: (request: Request) =>
              fetch(new URL(request.url).pathname, { signal: controller.signal }),
          })) as AssistantAnswer['sources']);
      const response = await fetch('/api/assistant/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          question: text,
          history,
          references: found.map(({ document_id, page_number, fragment_id }) => ({
            document_id,
            page_number,
            fragment_id,
          })),
        }),
        signal: controller.signal,
      });
      const contentType = response.headers.get('Content-Type') ?? '';
      if (!response.ok) {
        const data = contentType.includes('application/json')
          ? ((await response.json()) as { error?: string })
          : null;
        throw new Error(data?.error ?? `Помощник недоступен (ошибка ${response.status}).`);
      }
      let data: AssistantAnswer;
      if (contentType.includes('text/event-stream')) {
        data = await readAssistantStream(response, showProgress);
      } else if (contentType.includes('application/json')) {
        data = (await response.json()) as AssistantAnswer;
      } else {
        throw new Error('ИИ доступен на опубликованном адресе PWA через Cloudflare Worker.');
      }
      if (data.mode !== 'live' || !data.answer) {
        throw new Error('Сервер вернул неожиданный ответ.');
      }
      setMessages((previous) =>
        previous.map((message) =>
          message.id === answerId ? { ...message, text: data.answer, answer: data } : message,
        ),
      );
    } catch (cause) {
      setMessages((previous) =>
        previous.map((message) => {
          if (message.id !== answerId) return message;
          if (stoppedByUser.current && latestText) {
            return {
              id: answerId,
              role: 'error' as const,
              text: `${latestText}\n\nОтвет остановлен и может быть неполным.`,
            };
          }
          return {
            id: answerId,
            role: 'error' as const,
            text: stoppedByUser.current
              ? 'Ответ остановлен.'
              : cause instanceof Error && cause.name === 'AbortError'
                ? 'Помощник не закончил ответ за десять минут.'
                : cause instanceof Error
                  ? cause.message
                  : 'Не удалось получить ответ.',
          };
        }),
      );
    } finally {
      window.clearTimeout(timeout);
      if (frame !== null) window.cancelAnimationFrame(frame);
      activeRequest.current = null;
      setPending(false);
    }
  };
  return (
    <div className="assistant-page">
      <header className="assistant-header">
        <div>
          <h1>Помощник</h1>
          <p>Задайте вопрос своими словами</p>
        </div>
        {messages.length > 0 && (
          <button
            className="secondary-button new-chat-button"
            type="button"
            disabled={pending}
            onClick={() => {
              try {
                localStorage.removeItem(CHAT_KEY);
              } catch {
                // The in-memory chat can still be cleared.
              }
              setMessages([]);
              setQuestion('');
              setValidation('');
            }}
          >
            Новый чат
          </button>
        )}
      </header>
      <div className="chat-messages" aria-live="polite">
        {!messages.length && (
          <p className="chat-empty">
            Помогу подобрать документы, разобраться в юридической задаче и понять, какие статьи
            стоит проверить.
          </p>
        )}
        {messages.map((message) => (
          <div className={`chat-bubble ${message.role}`} key={message.id}>
            <p>{linkedAnswer(message.text, message.answer)}</p>
            {message.answer?.sources.length ? (
              <div className="chat-sources">
                <strong>
                  {message.answer.sources.some((source) => source.internal_url)
                    ? 'Статьи из каталога'
                    : 'Связанные документы'}
                </strong>
                {message.answer.sources.map((source, index) => (
                  <div
                    className="chat-source"
                    key={`${source.document_id}-${source.fragment_id ?? index}`}
                  >
                    <a href={sourceHref(source)}>
                      [{index + 1}] {source.title}, {source.fragment_label} →
                    </a>
                    {source.internal_url && source.excerpt && (
                      <span>
                        {source.excerpt.slice(0, 220)}
                        {source.excerpt.length > 220 ? '…' : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            {message.answer && <small>{message.answer.disclaimer}</small>}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form className="chat-composer" onSubmit={(event) => void submit(event)}>
        <label className="sr-only" htmlFor="chat-question">
          Вопрос помощнику
        </label>
        <textarea
          id="chat-question"
          rows={2}
          placeholder="Напишите вопрос…"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !('ontouchstart' in window)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        {pending ? (
          <button
            type="button"
            aria-label="Остановить ответ"
            onClick={() => {
              stoppedByUser.current = true;
              activeRequest.current?.abort();
            }}
          >
            ■
          </button>
        ) : (
          <button type="submit" aria-label="Отправить вопрос">
            ↑
          </button>
        )}
        {validation && (
          <span className="validation" role="alert">
            {validation}
          </span>
        )}
      </form>
    </div>
  );
}

export default function App() {
  useViewportHeight();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [favorites, setFavorites] = useState(readFavorites);
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    void listDocuments().then(setDocuments);
  }, []);
  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((item) => item !== id)
      : [...favorites, id];
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setFavorites(next);
      setStorageError('');
    } catch {
      setStorageError('Не удалось сохранить избранное на этом устройстве.');
    }
  };
  const path = window.location.pathname;
  const active =
    path.startsWith('/search') || path.startsWith('/document/')
      ? 'search'
      : path.startsWith('/favorites')
        ? 'favorites'
        : path.startsWith('/assistant')
          ? 'assistant'
          : 'home';
  const documentId = path.startsWith('/document/')
    ? decodeURIComponent(path.slice('/document/'.length))
    : '';
  return (
    <div className="app-shell">
      <main className={`main-content ${active === 'assistant' ? 'main-chat' : ''}`}>
        {storageError && (
          <p className="storage-error" role="alert">
            {storageError}
          </p>
        )}
        {documentId ? (
          <DocumentPage id={documentId} favorites={favorites} toggleFavorite={toggleFavorite} />
        ) : active === 'search' ? (
          <Search documents={documents} />
        ) : active === 'favorites' ? (
          <Favorites documents={documents} favorites={favorites} />
        ) : active === 'assistant' ? (
          <Assistant />
        ) : (
          <Home documents={documents} />
        )}
      </main>
      <nav className="bottom-nav" aria-label="Основное меню">
        <a
          className={active === 'home' ? 'active' : ''}
          aria-current={active === 'home' ? 'page' : undefined}
          href="/"
        >
          <span>⌂</span>Главная
        </a>
        <a
          className={active === 'search' ? 'active' : ''}
          aria-current={active === 'search' ? 'page' : undefined}
          href="/search"
        >
          <span>☷</span>Каталог
        </a>
        <a
          className={active === 'favorites' ? 'active' : ''}
          aria-current={active === 'favorites' ? 'page' : undefined}
          href="/favorites"
        >
          <span>☆</span>Избранное
        </a>
        <a
          className={active === 'assistant' ? 'active' : ''}
          aria-current={active === 'assistant' ? 'page' : undefined}
          href="/assistant"
        >
          <span>✧</span>Помощник
        </a>
      </nav>
    </div>
  );
}
