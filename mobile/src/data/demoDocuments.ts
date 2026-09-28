import type { AssistantAnswer, DocumentDetail, DocumentSummary } from '../types/legal';

export const demoDocuments: DocumentDetail[] = [
  {
    id: 'ru-constitution-source',
    title: 'Конституция Российской Федерации',
    document_type: 'Конституция',
    source_name: 'Официальный интернет-портал правовой информации',
    source_url: 'https://publication.pravo.gov.ru/document/0001202210060013',
    document_number: null,
    published_at: '2022-10-06',
    revision_label: 'Официальное опубликование · 06.10.2022',
    effective_from: null,
    effective_to: null,
    is_demo: false,
    jurisdiction: 'RU',
    legal_level: 'constitution',
    content_state: 'source_metadata',
    source_checked_at: '2026-09-19',
    content:
      'КАРТОЧКА ОФИЦИАЛЬНОГО ИСТОЧНИКА. Локальный текст Конституции в этот каркас намеренно не загружается. Откройте источник на официальном портале и перед правовым использованием проверьте редакцию и дату, на которую нужен текст.',
  },
  {
    id: 'ru-federal-law-5-fz-source',
    title: 'Федеральный закон от 14.06.1994 № 5-ФЗ',
    document_type: 'Федеральный закон',
    source_name: 'Официальный интернет-портал правовой информации',
    source_url: 'https://pravo.gov.ru/proxy/ips/?docbody=&nd=102030627',
    document_number: '5-ФЗ',
    published_at: null,
    revision_label: 'Карточка источника · редакцию нужно проверить перед применением',
    effective_from: null,
    effective_to: null,
    is_demo: false,
    jurisdiction: 'RU',
    legal_level: 'federal_law',
    content_state: 'source_metadata',
    source_checked_at: '2026-09-19',
    content:
      'КАРТОЧКА ОФИЦИАЛЬНОГО ИСТОЧНИКА. Закон посвящён порядку опубликования и вступления в силу федеральных конституционных законов, федеральных законов и актов палат Федерального Собрания. Полный текст и его редакции в локальное приложение пока не загружены.',
  },
  {
    id: 'ru-federal-laws-catalog',
    title: 'Федеральные законы Российской Федерации',
    document_type: 'Раздел каталога',
    source_name: 'Официальный интернет-портал правовой информации',
    source_url: 'https://publication.pravo.gov.ru/',
    document_number: null,
    published_at: null,
    revision_label: 'Раздел в подготовке · массовая загрузка отключена',
    effective_from: null,
    effective_to: null,
    is_demo: false,
    jurisdiction: 'RU',
    legal_level: 'federal_law',
    content_state: 'planned',
    source_checked_at: '2026-09-19',
    content:
      'РАЗДЕЛ КАТАЛОГА В ПОДГОТОВКЕ. Сюда войдут только отдельно проверенные федеральные законы с официальной публикацией, ссылкой на текущую редакцию, датой проверки и периодом действия. Автоматический сбор и копирование текстов из сторонних правовых баз не выполняются.',
  },
  {
    id: 'demo-source-checklist',
    title: 'Демонстрационный чек-лист проверки источника',
    document_type: 'Учебный материал',
    source_name: 'Внутренний демонстрационный набор «ПравоОрбита»',
    source_url: null,
    document_number: null,
    published_at: null,
    revision_label: 'Демо-редакция 1.0',
    effective_from: null,
    effective_to: null,
    is_demo: true,
    jurisdiction: null,
    legal_level: 'guide',
    content_state: 'demo',
    source_checked_at: null,
    content:
      'ДЕМОНСТРАЦИОННЫЙ МАТЕРИАЛ. Это не нормативный правовой акт и не юридическая консультация.\n\n' +
      '1. Уточните официальный источник, дату публикации и номер документа.\n' +
      '2. Проверьте, какая редакция действовала на интересующую дату.\n' +
      '3. Сохраните ссылку на конкретный фрагмент, а не только на название.\n\n' +
      'Карточка создана только для демонстрации поиска и чтения в прототипе.',
  },
  {
    id: 'demo-version-timeline',
    title: 'Демонстрационный пример карточки редакции',
    document_type: 'Учебный пример',
    source_name: 'Внутренний демонстрационный набор «ПравоОрбита»',
    source_url: null,
    document_number: null,
    published_at: null,
    revision_label: 'Демо-редакция 1.0',
    effective_from: null,
    effective_to: null,
    is_demo: true,
    jurisdiction: null,
    legal_level: 'guide',
    content_state: 'demo',
    source_checked_at: null,
    content:
      'ДЕМОНСТРАЦИОННЫЙ МАТЕРИАЛ. Этот текст вымышлен для интерфейса и не описывает действующее законодательство.\n\n' +
      'Для каждого реального документа система должна хранить источник, номер, дату публикации, редакцию, дату начала и окончания действия.\n\n' +
      'Будущая выдача должна сопоставлять вопрос с редакцией, действующей на указанную пользователем дату.',
  },
  {
    id: 'demo-ai-safety-note',
    title: 'Демонстрационная заметка об ИИ-помощнике',
    document_type: 'Пояснение к прототипу',
    source_name: 'Внутренний демонстрационный набор «ПравоОрбита»',
    source_url: null,
    document_number: null,
    published_at: null,
    revision_label: 'Демо-редакция 1.0',
    effective_from: null,
    effective_to: null,
    is_demo: true,
    jurisdiction: null,
    legal_level: 'guide',
    content_state: 'demo',
    source_checked_at: null,
    content:
      'ДЕМОНСТРАЦИОННЫЙ МАТЕРИАЛ. Ответы прототипа не являются юридическим заключением.\n\n' +
      'Будущий помощник должен сначала запросить дату и существенные обстоятельства, затем найти документы, выбрать подходящие редакции и показать ссылки на конкретные фрагменты.\n\n' +
      'Качество ответов потребует отдельной юридической проверки.',
  },
];

export function asSummaries(documents: DocumentDetail[]): DocumentSummary[] {
  return documents.map(({ content: _content, ...summary }) => summary);
}

export function findDemoDocument(id: string): DocumentDetail | undefined {
  return demoDocuments.find((document) => document.id === id);
}

export function searchDemoDocuments(query: string): DocumentSummary[] {
  const tokens = query.trim().toLocaleLowerCase('ru-RU').split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return asSummaries(demoDocuments);
  }

  return asSummaries(
    demoDocuments.filter((document) => {
      const text = [document.title, document.document_type, document.source_name, document.content]
        .join(' ')
        .toLocaleLowerCase('ru-RU');
      return tokens.every((token) => text.includes(token));
    }),
  );
}

export function localDemoAnswer(question: string): AssistantAnswer {
  const matches = searchDemoDocuments(question)
    .filter((document) => document.is_demo)
    .slice(0, 3);
  const sources = matches.map((document) => {
    const fullDocument = findDemoDocument(document.id);
    return {
      document_id: document.id,
      title: document.title,
      fragment_label: 'Демонстрационный фрагмент',
      excerpt: fullDocument?.content.replace(/\s+/g, ' ').slice(0, 220) ?? '',
      source_url: null,
      is_demo: true,
    };
  });

  return {
    mode: 'demo',
    answer:
      'Локальный демонстрационный ответ: сервер недоступен или не настроен, поэтому никакая модель ИИ не вызывалась. ' +
      (sources.length > 0
        ? 'Подобраны только учебные карточки интерфейса.'
        : 'По учебным карточкам совпадений нет.'),
    sources,
    disclaimer:
      'Демонстрационный режим: это не юридическая консультация и не подтверждение действующей редакции законодательства.',
  };
}
