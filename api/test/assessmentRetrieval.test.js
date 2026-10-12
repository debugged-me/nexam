import test from 'node:test';
import assert from 'node:assert/strict';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { Document } from '@langchain/core/documents';

test('installed vector search applies the source filter before top-k selection', async () => {
  const embeddings = {
    embedDocuments: async () => [[1, 0], [0.99, 0.01], [0.8, 0.2]],
    embedQuery: async () => [1, 0],
  };
  const docs = ['midterm', 'final', 'prelim'].map((id) => new Document({ pageContent: `${id} lesson`, metadata: { id } }));
  const store = await HNSWLib.fromDocuments(docs, embeddings, { space: 'cosine' });
  const all = await store.similaritySearchVectorWithScore([1, 0], 1);
  assert.equal(all[0][0].metadata.id, 'midterm');
  const selected = await store.similaritySearchVectorWithScore([1, 0], 1, (doc) => doc.metadata.id === 'prelim');
  assert.equal(selected.length, 1);
  assert.equal(selected[0][0].metadata.id, 'prelim', 'a closer result from another period must not displace the selected source');
});
