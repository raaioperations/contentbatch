import { createContentItem, validateContentItem } from '../domain/content.js';
import { normalizeTags } from '../domain/tags.js';
import { runStoreRequest, runTransaction } from './db.js';

export async function listContentItems() {
  const records = await runStoreRequest('contentItems', 'readonly', store => store.getAll());
  return records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getContentItem(id) {
  return runStoreRequest('contentItems', 'readonly', store => store.get(id));
}

export async function addContentItem(title, options) {
  const item = createContentItem(title, options);
  await runStoreRequest('contentItems', 'readwrite', store => store.add(item));
  return item;
}

export async function saveContentItem(item, now = new Date().toISOString()) {
  const saved = {
    ...item,
    title: typeof item.title === 'string' ? item.title.trim() : item.title,
    tags: normalizeTags(item.tags ?? []),
    updatedAt: now
  };
  validateContentItem(saved);
  await runTransaction(['contentItems', 'batches'], 'readwrite', (transaction, { abort }) => {
    const contentStore = transaction.objectStore('contentItems');
    if (saved.batchId === null) {
      contentStore.put(saved);
    } else {
      const batchRequest = transaction.objectStore('batches').get(saved.batchId);
      batchRequest.onsuccess = () => {
        if (!batchRequest.result) {
          abort(new Error('This Batch no longer exists. Choose another Batch before saving.'));
          return;
        }
        contentStore.put(saved);
      };
    }
  });
  return saved;
}

export async function deleteContentItem(id) {
  await runStoreRequest('contentItems', 'readwrite', store => store.delete(id));
}
