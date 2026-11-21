import { createContentItem, validateContentItem } from '../domain/content.js';
import { createBatchRecord, updateBatchRecord } from '../domain/batches.js';
import { runStoreRequest, runTransaction } from './db.js';

export async function createBatch(name, description = '', now = new Date().toISOString()) {
  const batch = createBatchRecord(name, description, { now });
  await runStoreRequest('batches', 'readwrite', store => store.add(batch));
  return batch;
}

export function getBatch(id) {
  return runStoreRequest('batches', 'readonly', store => store.get(id));
}

export async function getAllBatches() {
  const batches = await runStoreRequest('batches', 'readonly', store => store.getAll());
  return batches.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function updateBatch(id, changes, now = new Date().toISOString()) {
  return runTransaction(['batches'], 'readwrite', (transaction, { abort }) => {
    const store = transaction.objectStore('batches');
    const request = store.get(id);
    const result = { batch: null };
    request.onsuccess = () => {
      try {
        if (!request.result) {
          abort(new Error('Batch not found.'));
          return;
        }
        result.batch = updateBatchRecord(request.result, changes, now);
        store.put(result.batch);
      } catch (error) {
        abort(error);
      }
    };
    return result;
  }).then(result => result.batch);
}

export async function getBatchContentItems(batchId) {
  const items = await runStoreRequest('contentItems', 'readonly', store => store.index('batchId').getAll(batchId));
  return items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createContentItemInBatch(title, batchId, now = new Date().toISOString()) {
  const item = { ...createContentItem(title, { now }), batchId };
  validateContentItem(item);
  await runTransaction(['batches', 'contentItems'], 'readwrite', (transaction, { abort }) => {
    const result = { item };
    const request = transaction.objectStore('batches').get(batchId);
    request.onsuccess = () => {
      if (!request.result) {
        abort(new Error('Choose an existing Batch before creating content here.'));
        return;
      }
      transaction.objectStore('contentItems').add(item);
    };
    return result;
  });
  return item;
}

export async function assignContentItemToBatch(itemId, batchId, now = new Date().toISOString()) {
  const updated = await runTransaction(['batches', 'contentItems'], 'readwrite', (transaction, { abort }) => {
    const batchRequest = transaction.objectStore('batches').get(batchId);
    const itemStore = transaction.objectStore('contentItems');
    const itemRequest = itemStore.get(itemId);
    const result = { item: null };
    let batch;
    let item;
    let batchLoaded = false;
    let itemLoaded = false;

    const saveWhenLoaded = () => {
      if (!batchLoaded || !itemLoaded) return;
      if (!batch) {
        abort(new Error('Batch no longer exists. Refresh the Batch list and try again.'));
        return;
      }
      if (!item) {
        abort(new Error('Content item no longer exists. Refresh the content list and try again.'));
        return;
      }
      try {
        result.item = { ...item, batchId: batch.id, updatedAt: now };
        validateContentItem(result.item);
        itemStore.put(result.item);
      } catch (error) {
        abort(error);
      }
    };

    batchRequest.onsuccess = () => { batch = batchRequest.result; batchLoaded = true; saveWhenLoaded(); };
    itemRequest.onsuccess = () => { item = itemRequest.result; itemLoaded = true; saveWhenLoaded(); };
    return result;
  });
  return updated.item;
}

export async function removeContentItemFromBatch(itemId, now = new Date().toISOString()) {
  const result = await runTransaction(['contentItems'], 'readwrite', (transaction, { abort }) => {
    const store = transaction.objectStore('contentItems');
    const request = store.get(itemId);
    const outcome = { item: null };
    request.onsuccess = () => {
      if (!request.result) return;
      try {
        outcome.item = { ...request.result, batchId: null, updatedAt: now };
        validateContentItem(outcome.item);
        store.put(outcome.item);
      } catch (error) {
        abort(error);
      }
    };
    return outcome;
  });
  if (!result.item) throw new Error('Content item no longer exists.');
  return result.item;
}

export async function deleteBatch(id, now = new Date().toISOString()) {
  const result = await runTransaction(['batches', 'contentItems'], 'readwrite', (transaction, { abort }) => {
    const batchStore = transaction.objectStore('batches');
    const itemStore = transaction.objectStore('contentItems');
    const outcome = { deleted: false, unassignedCount: 0 };
    const batchRequest = batchStore.get(id);
    batchRequest.onsuccess = () => {
      if (!batchRequest.result) return;
      const itemsRequest = itemStore.index('batchId').getAll(id);
      itemsRequest.onsuccess = () => {
        try {
          for (const item of itemsRequest.result) {
            const unassigned = { ...item, batchId: null, updatedAt: now };
            validateContentItem(unassigned);
            itemStore.put(unassigned);
          }
          batchStore.delete(id);
          outcome.deleted = true;
          outcome.unassignedCount = itemsRequest.result.length;
        } catch (error) {
          abort(error);
        }
      };
    };
    return outcome;
  });
  return result;
}
