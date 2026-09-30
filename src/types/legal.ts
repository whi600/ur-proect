export type DataOrigin = 'api' | 'offline-catalog' | 'local-demo';
export type DocumentContentState =
  'demo' | 'offline_metadata' | 'source_metadata' | 'planned' | 'source_snapshot' | 'verified_text';

export interface DocumentSummary {
  id: string;
  title: string;
  document_type: string;
  source_name: string;
  source_url: string | null;
  document_number: string | null;
  published_at: string | null;
  revision_label: string;
  effective_from: string | null;
  effective_to: string | null;
  is_demo: boolean;
  jurisdiction: string | null;
  legal_level: string | null;
  content_state: DocumentContentState;
  source_checked_at: string | null;
}

export interface DocumentDetail extends DocumentSummary {
  content: string;
  /**
   * A page of locally bundled source fragments. This is intentionally optional:
   * metadata-only cards and API responses do not have to ship a full text.
   */
  fragments?: DocumentFragment[];
  fragments_total?: number;
}

export interface DocumentFragment {
  id: number;
  ordinal: number;
  kind: 'metadata' | 'preamble' | 'section' | 'chapter' | 'article' | 'paragraph' | 'appendix';
  label: string | null;
  heading: string;
  body: string;
  legal_status: string | null;
  revision_label: string | null;
  valid_from: string | null;
  valid_to: string | null;
}

export interface SearchResponse {
  query: string;
  results: DocumentSummary[];
}

export interface HealthResponse {
  status: 'ok';
  data_mode: 'demo' | 'postgres';
  database: 'not_used' | 'connected';
  version: string;
}

export interface AssistantCitation {
  document_id: string;
  title: string;
  page_number?: number;
  fragment_id?: number;
  fragment_label: string;
  excerpt: string;
  internal_url?: string;
  source_url: string | null;
  is_demo: boolean;
}

export interface AssistantAnswer {
  mode: 'demo' | 'live';
  answer: string;
  sources: AssistantCitation[];
  disclaimer: string;
}

export interface LoadResult<T> {
  data: T;
  origin: DataOrigin;
  notice?: string;
}
