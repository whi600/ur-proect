import type { DocumentDetail, DocumentSummary } from '../types/legal';

/**
 * A deliberately small, bundled catalogue of document requisites.
 *
 * It is not a local collection of legislation: no articles, full text, current
 * revision or amendment history is included here. This lets the first version
 * remain useful without implying that a locally stored card is a verified law.
 */
export const OFFLINE_CATALOG_VERSION = '1.0';
export const OFFLINE_CATALOG_UPDATED_AT = '2026-09-25';
export const OFFLINE_CATALOG_SOURCE_NAME = 'Локальный офлайн-каталог «ПравоОрбита»';
export const OFFLINE_CATALOG_REVISION_LABEL = 'Реквизиты офлайн · текст и редакции не включены';

type OfflineCatalogDocument = DocumentDetail & {
  search_terms: readonly string[];
};

type MetadataInput = {
  id: string;
  title: string;
  documentType: string;
  documentNumber: string | null;
  documentDate: string | null;
  legalLevel: string;
  description: string;
  searchTerms: readonly string[];
};

function metadataCard(input: MetadataInput): OfflineCatalogDocument {
  return {
    id: input.id,
    title: input.title,
    document_type: input.documentType,
    source_name: OFFLINE_CATALOG_SOURCE_NAME,
    source_url: null,
    document_number: input.documentNumber,
    published_at: input.documentDate,
    revision_label: OFFLINE_CATALOG_REVISION_LABEL,
    effective_from: null,
    effective_to: null,
    is_demo: false,
    jurisdiction: 'RU',
    legal_level: input.legalLevel,
    content_state: 'offline_metadata',
    source_checked_at: null,
    content:
      `ЛОКАЛЬНЫЕ РЕКВИЗИТЫ. ${input.description}\n\n` +
      'В эту карточку включены только название, вид, номер и дата документа. Полный текст, статьи, история изменений и подтверждённая редакция здесь не хранятся. Перед правовым использованием потребуется отдельная проверка официальной публикации и редакции на нужную дату.',
    search_terms: input.searchTerms,
  };
}

const OFFLINE_CATALOG: OfflineCatalogDocument[] = [
  metadataCard({
    id: 'ru-constitution-source',
    title: 'Конституция Российской Федерации',
    documentType: 'Конституция',
    documentNumber: null,
    documentDate: '1993-12-12',
    legalLevel: 'constitution',
    description:
      'Основной закон Российской Федерации; дата — день принятия на всенародном голосовании.',
    searchTerms: ['конституция', 'основной закон', 'конституционное право'],
  }),

  metadataCard({
    id: 'ru-civil-code',
    title: 'Гражданский кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: 'части 1–4: № 51-ФЗ, 14-ФЗ, 146-ФЗ, 230-ФЗ',
    documentDate: null,
    legalLevel: 'code',
    description: 'Составной кодекс: четыре части приняты отдельными федеральными законами.',
    searchTerms: ['гк', 'гражданский', 'кодексы', 'имущество', 'договор', 'обязательства'],
  }),
  metadataCard({
    id: 'ru-tax-code',
    title: 'Налоговый кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: 'части 1–2: № 146-ФЗ, 117-ФЗ',
    documentDate: null,
    legalLevel: 'code',
    description:
      'Составной кодекс: первая и вторая части приняты отдельными федеральными законами.',
    searchTerms: ['нк', 'налоговый', 'налоги', 'сборы', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-budget-code',
    title: 'Бюджетный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 145-ФЗ',
    documentDate: '1998-07-31',
    legalLevel: 'code',
    description: 'Кодекс о бюджетной системе и бюджетном процессе.',
    searchTerms: ['бк', 'бюджетный', 'бюджет', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-labour-code',
    title: 'Трудовой кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 197-ФЗ',
    documentDate: '2001-12-30',
    legalLevel: 'code',
    description: 'Кодекс о трудовых отношениях и связанных с ними отношениях.',
    searchTerms: ['тк', 'трудовой', 'труд', 'работник', 'работодатель', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-family-code',
    title: 'Семейный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 223-ФЗ',
    documentDate: '1995-12-29',
    legalLevel: 'code',
    description: 'Кодекс о семейных отношениях.',
    searchTerms: ['ск', 'семейный', 'семья', 'брак', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-housing-code',
    title: 'Жилищный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 188-ФЗ',
    documentDate: '2004-12-29',
    legalLevel: 'code',
    description: 'Кодекс о жилищных отношениях.',
    searchTerms: ['жк', 'жилищный', 'жилье', 'квартира', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-land-code',
    title: 'Земельный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 136-ФЗ',
    documentDate: '2001-10-25',
    legalLevel: 'code',
    description: 'Кодекс о земельных отношениях.',
    searchTerms: ['зк', 'земельный', 'земля', 'участок', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-forest-code',
    title: 'Лесной кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 200-ФЗ',
    documentDate: '2006-12-04',
    legalLevel: 'code',
    description: 'Кодекс о лесных отношениях.',
    searchTerms: ['лесной', 'лес', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-water-code',
    title: 'Водный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 74-ФЗ',
    documentDate: '2006-06-03',
    legalLevel: 'code',
    description: 'Кодекс о водных отношениях.',
    searchTerms: ['водный', 'вода', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-town-planning-code',
    title: 'Градостроительный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 190-ФЗ',
    documentDate: '2004-12-29',
    legalLevel: 'code',
    description: 'Кодекс о градостроительной деятельности.',
    searchTerms: ['градостроительный', 'строительство', 'застройка', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-air-code',
    title: 'Воздушный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 60-ФЗ',
    documentDate: '1997-03-19',
    legalLevel: 'code',
    description: 'Кодекс о воздушном законодательстве.',
    searchTerms: ['воздушный', 'авиация', 'самолет', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-merchant-shipping-code',
    title: 'Кодекс торгового мореплавания Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 81-ФЗ',
    documentDate: '1999-04-30',
    legalLevel: 'code',
    description: 'Кодекс о торговом мореплавании.',
    searchTerms: ['ктм', 'торговое мореплавание', 'море', 'судно', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-inland-water-transport-code',
    title: 'Кодекс внутреннего водного транспорта Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 24-ФЗ',
    documentDate: '2001-03-07',
    legalLevel: 'code',
    description: 'Кодекс о внутреннем водном транспорте.',
    searchTerms: ['кввт', 'внутренний водный транспорт', 'река', 'судно', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-criminal-code',
    title: 'Уголовный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 63-ФЗ',
    documentDate: '1996-06-13',
    legalLevel: 'code',
    description: 'Кодекс об уголовной ответственности.',
    searchTerms: ['ук', 'уголовный', 'преступление', 'наказание', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-criminal-procedure-code',
    title: 'Уголовно-процессуальный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 174-ФЗ',
    documentDate: '2001-12-18',
    legalLevel: 'code',
    description: 'Кодекс об уголовном судопроизводстве.',
    searchTerms: ['упк', 'уголовно-процессуальный', 'уголовный процесс', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-criminal-executive-code',
    title: 'Уголовно-исполнительный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 1-ФЗ',
    documentDate: '1997-01-08',
    legalLevel: 'code',
    description: 'Кодекс об исполнении уголовных наказаний.',
    searchTerms: ['уик', 'уголовно-исполнительный', 'исполнение наказаний', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-administrative-offences-code',
    title: 'Кодекс Российской Федерации об административных правонарушениях',
    documentType: 'Кодекс',
    documentNumber: '№ 195-ФЗ',
    documentDate: '2001-12-30',
    legalLevel: 'code',
    description: 'Кодекс об административной ответственности.',
    searchTerms: ['коап', 'административный', 'правонарушение', 'штраф', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-administrative-procedure-code',
    title: 'Кодекс административного судопроизводства Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 21-ФЗ',
    documentDate: '2015-03-08',
    legalLevel: 'code',
    description: 'Кодекс об административном судопроизводстве.',
    searchTerms: ['кас', 'административное судопроизводство', 'суд', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-civil-procedure-code',
    title: 'Гражданский процессуальный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 138-ФЗ',
    documentDate: '2002-11-14',
    legalLevel: 'code',
    description: 'Кодекс о гражданском судопроизводстве.',
    searchTerms: ['гпк', 'гражданский процесс', 'суд', 'кодексы'],
  }),
  metadataCard({
    id: 'ru-arbitration-procedure-code',
    title: 'Арбитражный процессуальный кодекс Российской Федерации',
    documentType: 'Кодекс',
    documentNumber: '№ 95-ФЗ',
    documentDate: '2002-07-24',
    legalLevel: 'code',
    description: 'Кодекс об арбитражном судопроизводстве.',
    searchTerms: ['апк', 'арбитражный процесс', 'суд', 'кодексы'],
  }),

  metadataCard({
    id: 'ru-federal-law-5-fz-source',
    title:
      'О порядке опубликования и вступления в силу федеральных конституционных законов, федеральных законов, актов палат Федерального Собрания',
    documentType: 'Федеральный закон',
    documentNumber: '№ 5-ФЗ',
    documentDate: '1994-06-14',
    legalLevel: 'federal_law',
    description: 'Федеральный закон о порядке опубликования и вступления в силу указанных актов.',
    searchTerms: ['5-фз', '5 фз', 'опубликование', 'вступление в силу', 'федеральные законы'],
  }),
  metadataCard({
    id: 'ru-federal-law-59-fz',
    title: 'О порядке рассмотрения обращений граждан Российской Федерации',
    documentType: 'Федеральный закон',
    documentNumber: '№ 59-ФЗ',
    documentDate: '2006-05-02',
    legalLevel: 'federal_law',
    description: 'Федеральный закон об обращениях граждан.',
    searchTerms: [
      '59-фз',
      '59 фз',
      'обращения граждан',
      'жалоба',
      'заявление',
      'федеральные законы',
    ],
  }),
  metadataCard({
    id: 'ru-federal-law-149-fz',
    title: 'Об информации, информационных технологиях и о защите информации',
    documentType: 'Федеральный закон',
    documentNumber: '№ 149-ФЗ',
    documentDate: '2006-07-27',
    legalLevel: 'federal_law',
    description: 'Федеральный закон об информации и её защите.',
    searchTerms: [
      '149-фз',
      '149 фз',
      'информация',
      'информационные технологии',
      'федеральные законы',
    ],
  }),
  metadataCard({
    id: 'ru-federal-law-152-fz',
    title: 'О персональных данных',
    documentType: 'Федеральный закон',
    documentNumber: '№ 152-ФЗ',
    documentDate: '2006-07-27',
    legalLevel: 'federal_law',
    description: 'Федеральный закон о персональных данных.',
    searchTerms: ['152-фз', '152 фз', 'персональные данные', 'данные', 'федеральные законы'],
  }),
  metadataCard({
    id: 'ru-federal-law-218-fz',
    title: 'О государственной регистрации недвижимости',
    documentType: 'Федеральный закон',
    documentNumber: '№ 218-ФЗ',
    documentDate: '2015-07-13',
    legalLevel: 'federal_law',
    description: 'Федеральный закон о государственной регистрации недвижимости.',
    searchTerms: [
      '218-фз',
      '218 фз',
      'недвижимость',
      'регистрация',
      'росреестр',
      'федеральные законы',
    ],
  }),
  metadataCard({
    id: 'ru-federal-law-229-fz',
    title: 'Об исполнительном производстве',
    documentType: 'Федеральный закон',
    documentNumber: '№ 229-ФЗ',
    documentDate: '2007-10-02',
    legalLevel: 'federal_law',
    description: 'Федеральный закон об исполнительном производстве.',
    searchTerms: [
      '229-фз',
      '229 фз',
      'исполнительное производство',
      'пристав',
      'федеральные законы',
    ],
  }),
  metadataCard({
    id: 'ru-federal-law-127-fz',
    title: 'О несостоятельности (банкротстве)',
    documentType: 'Федеральный закон',
    documentNumber: '№ 127-ФЗ',
    documentDate: '2002-10-26',
    legalLevel: 'federal_law',
    description: 'Федеральный закон о несостоятельности (банкротстве).',
    searchTerms: ['127-фз', '127 фз', 'банкротство', 'несостоятельность', 'федеральные законы'],
  }),
  metadataCard({
    id: 'ru-federal-law-402-fz',
    title: 'О бухгалтерском учёте',
    documentType: 'Федеральный закон',
    documentNumber: '№ 402-ФЗ',
    documentDate: '2011-12-06',
    legalLevel: 'federal_law',
    description: 'Федеральный закон о бухгалтерском учёте.',
    searchTerms: [
      '402-фз',
      '402 фз',
      'бухгалтерский учет',
      'бухгалтерский учёт',
      'федеральные законы',
    ],
  }),
  metadataCard({
    id: 'ru-federal-law-273-fz',
    title: 'Об образовании в Российской Федерации',
    documentType: 'Федеральный закон',
    documentNumber: '№ 273-ФЗ',
    documentDate: '2012-12-29',
    legalLevel: 'federal_law',
    description: 'Федеральный закон об образовании.',
    searchTerms: ['273-фз', '273 фз', 'образование', 'школа', 'вуз', 'федеральные законы'],
  }),
  metadataCard({
    id: 'ru-federal-law-323-fz',
    title: 'Об основах охраны здоровья граждан в Российской Федерации',
    documentType: 'Федеральный закон',
    documentNumber: '№ 323-ФЗ',
    documentDate: '2011-11-21',
    legalLevel: 'federal_law',
    description: 'Федеральный закон об основах охраны здоровья граждан.',
    searchTerms: [
      '323-фз',
      '323 фз',
      'здравоохранение',
      'здоровье',
      'медицина',
      'федеральные законы',
    ],
  }),
  metadataCard({
    id: 'ru-federal-law-400-fz',
    title: 'О страховых пенсиях',
    documentType: 'Федеральный закон',
    documentNumber: '№ 400-ФЗ',
    documentDate: '2013-12-28',
    legalLevel: 'federal_law',
    description: 'Федеральный закон о страховых пенсиях.',
    searchTerms: ['400-фз', '400 фз', 'пенсия', 'страховая пенсия', 'федеральные законы'],
  }),
  metadataCard({
    id: 'ru-federal-law-44-fz',
    title:
      'О контрактной системе в сфере закупок товаров, работ, услуг для обеспечения государственных и муниципальных нужд',
    documentType: 'Федеральный закон',
    documentNumber: '№ 44-ФЗ',
    documentDate: '2013-04-05',
    legalLevel: 'federal_law',
    description: 'Федеральный закон о контрактной системе в сфере закупок.',
    searchTerms: [
      '44-фз',
      '44 фз',
      'закупки',
      'контрактная система',
      'госзакупки',
      'федеральные законы',
    ],
  }),
  metadataCard({
    id: 'ru-consumer-protection-law',
    title: 'О защите прав потребителей',
    documentType: 'Закон Российской Федерации',
    documentNumber: '№ 2300-1',
    documentDate: '1992-02-07',
    legalLevel: 'law',
    description: 'Закон Российской Федерации о защите прав потребителей.',
    searchTerms: [
      '2300-1',
      'защита прав потребителей',
      'потребитель',
      'покупатель',
      'федеральные законы',
    ],
  }),
];

function toSummary(document: OfflineCatalogDocument): DocumentSummary {
  const { content: _content, search_terms: _searchTerms, ...summary } = document;
  return summary;
}

function normalise(value: string): string {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
}

/** Returns bundled metadata cards, never the hidden teaching cards used by the AI demo. */
export function getOfflineCatalog(): DocumentSummary[] {
  return OFFLINE_CATALOG.map(toSummary);
}

export function findOfflineCatalogDocument(id: string): DocumentDetail | undefined {
  return OFFLINE_CATALOG.find((document) => document.id === id);
}

export function searchOfflineCatalog(query: string): DocumentSummary[] {
  const tokens = normalise(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return getOfflineCatalog();
  }

  return OFFLINE_CATALOG.filter((document) => {
    const haystack = normalise(
      [
        document.title,
        document.document_type,
        document.document_number ?? '',
        document.legal_level ?? '',
        ...document.search_terms,
      ].join(' '),
    );
    return tokens.every((token) => haystack.includes(token));
  }).map(toSummary);
}

export function countOfflineCatalogByLevel(level: string): number {
  return OFFLINE_CATALOG.filter((document) => document.legal_level === level).length;
}
