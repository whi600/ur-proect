/**
 * Web export shim. The SQLite package is bundled only for Android/iOS, while
 * the PWA obtains its catalogue through the regular web data layer.
 */
export const OFFLINE_CATALOG_DATABASE_NAME = 'ru-core-catalog-v1.db';
export const SOURCE_SNAPSHOT_DATABASE_NAME = 'ru-core-snapshot-2026-09-25.db';
export const offlineCatalogProviderConfig = { databaseName: OFFLINE_CATALOG_DATABASE_NAME };
export const sourceSnapshotProviderConfig = { databaseName: SOURCE_SNAPSHOT_DATABASE_NAME };

export type OfflineCatalogPackageMeta = Record<string, unknown>;
export type OfflineCatalogDocument = Record<string, any>;
export type OfflineCatalogFragment = Record<string, any>;
export type OfflineCatalogSearchHit = OfflineCatalogDocument & Record<string, any>;

function unavailable(): never {
  throw new Error('Локальная SQLite-библиотека не входит в веб-версию.');
}

export function makeOfflineCatalogFtsQuery(_query: string): string | null {
  return unavailable();
}

export async function openImportedOfflineCatalog(): Promise<never> {
  return unavailable();
}

export async function openImportedSourceSnapshot(): Promise<never> {
  return unavailable();
}

export async function getOfflineCatalogPackageMeta(
  ..._args: unknown[]
): Promise<OfflineCatalogPackageMeta> {
  return unavailable();
}

export async function listOfflineCatalogDocuments(
  ..._args: unknown[]
): Promise<OfflineCatalogDocument[]> {
  return unavailable();
}

export async function getOfflineCatalogDocument(..._args: unknown[]): Promise<{
  document: OfflineCatalogDocument;
  fragments: OfflineCatalogFragment[];
} | null> {
  return unavailable();
}

export async function searchOfflineCatalogDocuments(
  ..._args: unknown[]
): Promise<OfflineCatalogSearchHit[]> {
  return unavailable();
}
