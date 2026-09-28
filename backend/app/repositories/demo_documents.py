from __future__ import annotations

from datetime import date

from app.domain.documents import DocumentRecord

OFFLINE_CATALOG_SOURCE = "Локальный стартовый каталог реквизитов «ПравоОрбита»"
OFFLINE_CATALOG_LABEL = "Офлайн-каталог реквизитов · текст и редакция не включены"
OFFLINE_CATALOG_CONTENT = (
    "ЛОКАЛЬНЫЙ ОФЛАЙН-КАТАЛОГ РЕКВИЗИТОВ. В этот стартовый пакет включены "
    "название, тип, номер и дата исходного акта. Полный текст документа, его "
    "действующая редакция, период действия и поиск по статьям здесь не сохранены. "
    "Карточка не заменяет верифицированный текст акта на нужную дату."
)


def _offline_metadata_card(
    *,
    document_id: str,
    title: str,
    document_type: str,
    document_number: str | None,
    legal_level: str,
    original_act_date: date | None,
) -> DocumentRecord:
    date_note = (
        f"Исходный акт от {original_act_date:%d.%m.%Y} · {OFFLINE_CATALOG_LABEL}"
        if original_act_date
        else OFFLINE_CATALOG_LABEL
    )
    return DocumentRecord(
        id=document_id,
        title=title,
        document_type=document_type,
        source_name=OFFLINE_CATALOG_SOURCE,
        source_url=None,
        document_number=document_number,
        # The package contains the date of the source act, not a verified date of
        # official publication. Keep this future field empty rather than conflate them.
        published_at=None,
        revision_label=date_note,
        effective_from=None,
        effective_to=None,
        content=OFFLINE_CATALOG_CONTENT,
        is_demo=False,
        jurisdiction="RU",
        legal_level=legal_level,
        content_state="offline_metadata",
        source_checked_at=None,
    )


CONSTITUTION_CARD = _offline_metadata_card(
    document_id="ru-constitution-source",
    title="Конституция Российской Федерации",
    document_type="Конституция",
    document_number=None,
    legal_level="constitution",
    original_act_date=date(1993, 12, 12),
)

CORE_CODE_CARDS: tuple[DocumentRecord, ...] = (
    _offline_metadata_card(
        document_id="ru-civil-code",
        title="Гражданский кодекс Российской Федерации (части первая–четвёртая)",
        document_type="Кодекс Российской Федерации",
        document_number="51-ФЗ; 14-ФЗ; 146-ФЗ; 230-ФЗ",
        legal_level="code",
        original_act_date=None,
    ),
    _offline_metadata_card(
        document_id="ru-tax-code",
        title="Налоговый кодекс Российской Федерации (части первая и вторая)",
        document_type="Кодекс Российской Федерации",
        document_number="146-ФЗ; 117-ФЗ",
        legal_level="code",
        original_act_date=None,
    ),
    _offline_metadata_card(
        document_id="ru-budget-code",
        title="Бюджетный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="145-ФЗ",
        legal_level="code",
        original_act_date=date(1998, 7, 31),
    ),
    _offline_metadata_card(
        document_id="ru-labour-code",
        title="Трудовой кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="197-ФЗ",
        legal_level="code",
        original_act_date=date(2001, 12, 30),
    ),
    _offline_metadata_card(
        document_id="ru-family-code",
        title="Семейный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="223-ФЗ",
        legal_level="code",
        original_act_date=date(1995, 12, 29),
    ),
    _offline_metadata_card(
        document_id="ru-housing-code",
        title="Жилищный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="188-ФЗ",
        legal_level="code",
        original_act_date=date(2004, 12, 29),
    ),
    _offline_metadata_card(
        document_id="ru-land-code",
        title="Земельный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="136-ФЗ",
        legal_level="code",
        original_act_date=date(2001, 10, 25),
    ),
    _offline_metadata_card(
        document_id="ru-forest-code",
        title="Лесной кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="200-ФЗ",
        legal_level="code",
        original_act_date=date(2006, 12, 4),
    ),
    _offline_metadata_card(
        document_id="ru-water-code",
        title="Водный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="74-ФЗ",
        legal_level="code",
        original_act_date=date(2006, 6, 3),
    ),
    _offline_metadata_card(
        document_id="ru-town-planning-code",
        title="Градостроительный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="190-ФЗ",
        legal_level="code",
        original_act_date=date(2004, 12, 29),
    ),
    _offline_metadata_card(
        document_id="ru-air-code",
        title="Воздушный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="60-ФЗ",
        legal_level="code",
        original_act_date=date(1997, 3, 19),
    ),
    _offline_metadata_card(
        document_id="ru-merchant-shipping-code",
        title="Кодекс торгового мореплавания Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="81-ФЗ",
        legal_level="code",
        original_act_date=date(1999, 4, 30),
    ),
    _offline_metadata_card(
        document_id="ru-inland-water-transport-code",
        title="Кодекс внутреннего водного транспорта Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="24-ФЗ",
        legal_level="code",
        original_act_date=date(2001, 3, 7),
    ),
    _offline_metadata_card(
        document_id="ru-criminal-code",
        title="Уголовный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="63-ФЗ",
        legal_level="code",
        original_act_date=date(1996, 6, 13),
    ),
    _offline_metadata_card(
        document_id="ru-criminal-procedure-code",
        title="Уголовно-процессуальный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="174-ФЗ",
        legal_level="code",
        original_act_date=date(2001, 12, 18),
    ),
    _offline_metadata_card(
        document_id="ru-criminal-executive-code",
        title="Уголовно-исполнительный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="1-ФЗ",
        legal_level="code",
        original_act_date=date(1997, 1, 8),
    ),
    _offline_metadata_card(
        document_id="ru-administrative-offences-code",
        title="Кодекс Российской Федерации об административных правонарушениях",
        document_type="Кодекс Российской Федерации",
        document_number="195-ФЗ",
        legal_level="code",
        original_act_date=date(2001, 12, 30),
    ),
    _offline_metadata_card(
        document_id="ru-administrative-procedure-code",
        title="Кодекс административного судопроизводства Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="21-ФЗ",
        legal_level="code",
        original_act_date=date(2015, 3, 8),
    ),
    _offline_metadata_card(
        document_id="ru-civil-procedure-code",
        title="Гражданский процессуальный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="138-ФЗ",
        legal_level="code",
        original_act_date=date(2002, 11, 14),
    ),
    _offline_metadata_card(
        document_id="ru-arbitration-procedure-code",
        title="Арбитражный процессуальный кодекс Российской Федерации",
        document_type="Кодекс Российской Федерации",
        document_number="95-ФЗ",
        legal_level="code",
        original_act_date=date(2002, 7, 24),
    ),
)

FEDERAL_LAWS_SECTION = DocumentRecord(
    id="ru-federal-laws-catalog",
    title="Федеральные законы Российской Федерации",
    document_type="Раздел офлайн-каталога",
    source_name=OFFLINE_CATALOG_SOURCE,
    source_url=None,
    document_number=None,
    published_at=None,
    revision_label="Офлайн-каталог реквизитов · 13 ключевых законов",
    effective_from=None,
    effective_to=None,
    content=(
        "ЛОКАЛЬНЫЙ ОФЛАЙН-КАТАЛОГ РЕКВИЗИТОВ. В стартовом разделе собраны карточки "
        "13 часто используемых федеральных законов и одного закона Российской Федерации. "
        "Полные тексты, действующие редакции и поиск по статьям ещё не включены."
    ),
    is_demo=False,
    jurisdiction="RU",
    legal_level="federal_law",
    content_state="offline_metadata",
    source_checked_at=None,
)

PRIMARY_LAW_CARDS: tuple[DocumentRecord, ...] = (
    _offline_metadata_card(
        document_id="ru-federal-law-5-fz-source",
        title=(
            "Федеральный закон «О порядке опубликования и вступления в силу "
            "федеральных конституционных законов, федеральных законов, актов палат "
            "Федерального Собрания»"
        ),
        document_type="Федеральный закон",
        document_number="5-ФЗ",
        legal_level="federal_law",
        original_act_date=date(1994, 6, 14),
    ),
    _offline_metadata_card(
        document_id="ru-federal-law-59-fz",
        title="Федеральный закон «О порядке рассмотрения обращений граждан Российской Федерации»",
        document_type="Федеральный закон",
        document_number="59-ФЗ",
        legal_level="federal_law",
        original_act_date=date(2006, 5, 2),
    ),
    _offline_metadata_card(
        document_id="ru-federal-law-149-fz",
        title=(
            "Федеральный закон «Об информации, информационных технологиях и о защите информации»"
        ),
        document_type="Федеральный закон",
        document_number="149-ФЗ",
        legal_level="federal_law",
        original_act_date=date(2006, 7, 27),
    ),
    _offline_metadata_card(
        document_id="ru-federal-law-152-fz",
        title="Федеральный закон «О персональных данных»",
        document_type="Федеральный закон",
        document_number="152-ФЗ",
        legal_level="federal_law",
        original_act_date=date(2006, 7, 27),
    ),
    _offline_metadata_card(
        document_id="ru-federal-law-218-fz",
        title="Федеральный закон «О государственной регистрации недвижимости»",
        document_type="Федеральный закон",
        document_number="218-ФЗ",
        legal_level="federal_law",
        original_act_date=date(2015, 7, 13),
    ),
    _offline_metadata_card(
        document_id="ru-federal-law-229-fz",
        title="Федеральный закон «Об исполнительном производстве»",
        document_type="Федеральный закон",
        document_number="229-ФЗ",
        legal_level="federal_law",
        original_act_date=date(2007, 10, 2),
    ),
    _offline_metadata_card(
        document_id="ru-federal-law-127-fz",
        title="Федеральный закон «О несостоятельности (банкротстве)»",
        document_type="Федеральный закон",
        document_number="127-ФЗ",
        legal_level="federal_law",
        original_act_date=date(2002, 10, 26),
    ),
    _offline_metadata_card(
        document_id="ru-federal-law-402-fz",
        title="Федеральный закон «О бухгалтерском учёте»",
        document_type="Федеральный закон",
        document_number="402-ФЗ",
        legal_level="federal_law",
        original_act_date=date(2011, 12, 6),
    ),
    _offline_metadata_card(
        document_id="ru-federal-law-273-fz",
        title="Федеральный закон «Об образовании в Российской Федерации»",
        document_type="Федеральный закон",
        document_number="273-ФЗ",
        legal_level="federal_law",
        original_act_date=date(2012, 12, 29),
    ),
    _offline_metadata_card(
        document_id="ru-federal-law-323-fz",
        title=("Федеральный закон «Об основах охраны здоровья граждан в Российской Федерации»"),
        document_type="Федеральный закон",
        document_number="323-ФЗ",
        legal_level="federal_law",
        original_act_date=date(2011, 11, 21),
    ),
    _offline_metadata_card(
        document_id="ru-federal-law-400-fz",
        title="Федеральный закон «О страховых пенсиях»",
        document_type="Федеральный закон",
        document_number="400-ФЗ",
        legal_level="federal_law",
        original_act_date=date(2013, 12, 28),
    ),
    _offline_metadata_card(
        document_id="ru-federal-law-44-fz",
        title=(
            "Федеральный закон «О контрактной системе в сфере закупок товаров, работ, "
            "услуг для обеспечения государственных и муниципальных нужд»"
        ),
        document_type="Федеральный закон",
        document_number="44-ФЗ",
        legal_level="federal_law",
        original_act_date=date(2013, 4, 5),
    ),
    _offline_metadata_card(
        document_id="ru-law-2300-1",
        title="Закон Российской Федерации «О защите прав потребителей»",
        document_type="Закон Российской Федерации",
        document_number="2300-1",
        legal_level="law",
        original_act_date=date(1992, 2, 7),
    ),
)

DEMO_DOCUMENTS: tuple[DocumentRecord, ...] = (
    DocumentRecord(
        id="demo-source-checklist",
        title="Демонстрационный чек-лист проверки источника",
        document_type="Учебный материал",
        source_name="Внутренний демонстрационный набор «ПравоОрбита»",
        source_url=None,
        document_number=None,
        published_at=None,
        revision_label="Демо-редакция 1.0",
        effective_from=None,
        effective_to=None,
        content=(
            "ДЕМОНСТРАЦИОННЫЙ МАТЕРИАЛ. Это не нормативный правовой акт и не "
            "юридическая консультация.\n\n"
            "1. Уточните официальный источник, дату публикации и номер документа.\n"
            "2. Проверьте, какая редакция действовала на интересующую дату.\n"
            "3. Сохраните ссылку на конкретный фрагмент, а не только на название.\n\n"
            "Карточка нужна только для демонстрации поиска и чтения в прототипе."
        ),
        is_demo=True,
        jurisdiction=None,
        legal_level="guide",
        content_state="demo",
        source_checked_at=None,
    ),
    DocumentRecord(
        id="demo-version-timeline",
        title="Демонстрационный пример карточки редакции",
        document_type="Учебный пример",
        source_name="Внутренний демонстрационный набор «ПравоОрбита»",
        source_url=None,
        document_number=None,
        published_at=None,
        revision_label="Демо-редакция 1.0",
        effective_from=None,
        effective_to=None,
        content=(
            "ДЕМОНСТРАЦИОННЫЙ МАТЕРИАЛ. Этот текст вымышлен для интерфейса и не "
            "описывает действующее законодательство.\n\n"
            "Для каждого реального документа система должна хранить источник, номер, "
            "дату публикации, редакцию, дату начала и окончания действия.\n\n"
            "Будущая выдача должна сопоставлять вопрос с редакцией, действующей на "
            "указанную пользователем дату."
        ),
        is_demo=True,
        jurisdiction=None,
        legal_level="guide",
        content_state="demo",
        source_checked_at=None,
    ),
    DocumentRecord(
        id="demo-ai-safety-note",
        title="Демонстрационная заметка об ИИ-помощнике",
        document_type="Пояснение к прототипу",
        source_name="Внутренний демонстрационный набор «ПравоОрбита»",
        source_url=None,
        document_number=None,
        published_at=None,
        revision_label="Демо-редакция 1.0",
        effective_from=None,
        effective_to=None,
        content=(
            "ДЕМОНСТРАЦИОННЫЙ МАТЕРИАЛ. Ответы прототипа не являются юридическим "
            "заключением.\n\n"
            "Будущий помощник должен сначала запросить дату и существенные обстоятельства, "
            "затем найти документы, выбрать подходящие редакции и показать ссылки на "
            "конкретные фрагменты.\n\n"
            "Качество ответов потребует отдельной юридической проверки."
        ),
        is_demo=True,
        jurisdiction=None,
        legal_level="guide",
        content_state="demo",
        source_checked_at=None,
    ),
)

CATALOG_DOCUMENTS: tuple[DocumentRecord, ...] = (
    CONSTITUTION_CARD,
    *CORE_CODE_CARDS,
    FEDERAL_LAWS_SECTION,
    *PRIMARY_LAW_CARDS,
)
SEED_DOCUMENTS: tuple[DocumentRecord, ...] = (*CATALOG_DOCUMENTS, *DEMO_DOCUMENTS)

# Common abbreviated names help a user find a catalogue card without exposing any
# legal text in the package. They are used only by the in-memory search adapter.
SEARCH_ALIASES: dict[str, str] = {
    "ru-civil-code": "гк гк рф гражданский",
    "ru-tax-code": "нк нк рф налоговый",
    "ru-budget-code": "бк бк рф бюджетный",
    "ru-labour-code": "тк тк рф трудовой",
    "ru-family-code": "ск ск рф семейный",
    "ru-housing-code": "жк жк рф жилищный",
    "ru-land-code": "зк зк рф земельный",
    "ru-forest-code": "лк лк рф лесной",
    "ru-water-code": "вк вк рф водный",
    "ru-town-planning-code": "грк грк рф градостроительный",
    "ru-air-code": "вк рф воздушный",
    "ru-merchant-shipping-code": "ктм ктм рф торгового мореплавания",
    "ru-inland-water-transport-code": "кввт кввт рф внутреннего водного транспорта",
    "ru-criminal-code": "ук ук рф уголовный",
    "ru-criminal-procedure-code": "упк упк рф уголовно-процессуальный",
    "ru-criminal-executive-code": "уик уик рф уголовно-исполнительный",
    "ru-administrative-offences-code": "коап коап рф административных правонарушениях",
    "ru-administrative-procedure-code": "кас кас рф административного судопроизводства",
    "ru-civil-procedure-code": "гпк гпк рф гражданский процессуальный",
    "ru-arbitration-procedure-code": "апк апк рф арбитражный процессуальный",
}


class DemoDocumentRepository:
    """Deterministic starter catalogue with clearly separated educational cards."""

    def list_documents(self, query: str | None, limit: int) -> list[DocumentRecord]:
        documents = list(SEED_DOCUMENTS)
        if query:
            tokens = _tokens(query)
            documents = [document for document in documents if _matches(document, tokens)]
        return documents[:limit]

    def get_document(self, document_id: str) -> DocumentRecord | None:
        return next((document for document in SEED_DOCUMENTS if document.id == document_id), None)


def _tokens(value: str) -> tuple[str, ...]:
    return tuple(token for token in value.casefold().split() if token)


def _matches(document: DocumentRecord, tokens: tuple[str, ...]) -> bool:
    category_aliases: tuple[str, ...] = ()
    if document.legal_level == "code":
        category_aliases = ("кодекс", "кодексы")
    elif document.legal_level in {"federal_law", "law"}:
        category_aliases = ("федеральный закон", "федеральные законы", "законы")

    searchable_text = " ".join(
        part
        for part in (
            document.title,
            document.document_type,
            document.source_name,
            document.document_number or "",
            document.content,
            SEARCH_ALIASES.get(document.id, ""),
            *category_aliases,
        )
    ).casefold()
    return all(token in searchable_text for token in tokens)
