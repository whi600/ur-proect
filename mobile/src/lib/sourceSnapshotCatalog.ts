import type { DocumentDetail, DocumentFragment, DocumentSummary } from '../types/legal';

/**
 * Web builds deliberately do not bundle the native SQLite text package.
 * It is read by the native implementation in sourceSnapshotCatalog.native.ts.
 */
export const isNativeSourceSnapshotSupported = false;

export type SourceSnapshotFragmentPage = {
  fragments: DocumentFragment[];
  total: number;
};

function unavailable(): never {
  throw new Error('Полнотекстовая библиотека доступна в нативном приложении.');
}

export async function listSourceSnapshotDocuments(): Promise<DocumentSummary[]> {
  return unavailable();
}

export async function searchSourceSnapshotDocuments(_query: string): Promise<DocumentSummary[]> {
  return unavailable();
}

export async function loadSourceSnapshotDocument(_id: string): Promise<DocumentDetail | undefined> {
  return unavailable();
}

export async function loadSourceSnapshotFragmentPage(
  _id: string,
  _offset: number,
): Promise<SourceSnapshotFragmentPage> {
  return unavailable();
}
