import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from '../src/data/texts-manifest.json' with { type: 'json' };
import {
  INDEX_VERSION,
  SHARD_COUNT,
  packReference,
  shardFor,
  stems,
} from '../worker/article-search.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'public', 'ai-index', INDEX_VERSION);
const shards = Array.from({ length: SHARD_COUNT }, () => Object.create(null));
const lengths = Object.create(null);
const labels = Object.create(null);
for (const [documentIndex, document] of manifest.documents.entries()) {
  for (let pageNumber = 0; pageNumber < document.page_count; pageNumber += 1) {
    const path = join(
      root,
      'public',
      'legal-texts',
      manifest.version,
      document.id,
      `${pageNumber}.json`,
    );
    const page = JSON.parse(await readFile(path, 'utf8'));
    for (const [fragmentIndex, fragment] of page.fragments.entries()) {
      if (fragment.kind !== 'article' || !fragment.body) continue;
      const reference = packReference(documentIndex, pageNumber, fragmentIndex);
      lengths[reference] = fragment.body.length;
      const articleNumber = /^Статья\s+(\d+(?:\.\d+)*)/iu.exec(
        fragment.label ?? fragment.heading,
      )?.[1];
      if (articleNumber) (labels[articleNumber] ??= []).push(reference);
      for (const stem of stems(`${fragment.label ?? ''} ${fragment.heading} ${fragment.body}`)) {
        const postings = shards[shardFor(stem)];
        (postings[stem] ??= []).push(reference);
      }
    }
  }
}
await mkdir(output, { recursive: true });
for (let shard = 0; shard < SHARD_COUNT; shard += 1) {
  const name = `${String(shard).padStart(2, '0')}.json`;
  await writeFile(
    join(output, name),
    JSON.stringify({ version: INDEX_VERSION, postings: shards[shard] }),
  );
}
await writeFile(join(output, 'lengths.json'), JSON.stringify(lengths));
await writeFile(join(output, 'labels.json'), JSON.stringify(labels));
console.log(`Индекс статей собран: ${SHARD_COUNT + 2} небольших файлов.`);
