import { CONTENT_STATUSES } from './content.js';

function validTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function validateBatch(batch) {
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) throw new TypeError('Batch must be an object.');
  if (typeof batch.id !== 'string' || !batch.id.trim()) throw new TypeError('Batch id is required.');
  if (typeof batch.name !== 'string' || !batch.name.trim()) throw new TypeError('A Batch name is required.');
  if (typeof batch.description !== 'string') throw new TypeError('Batch description must be text.');
  if (!validTimestamp(batch.createdAt)) throw new TypeError('Batch creation timestamp is invalid.');
  if (!validTimestamp(batch.updatedAt)) throw new TypeError('Batch update timestamp is invalid.');
  return true;
}

export function createBatchRecord(name, description = '', { id = globalThis.crypto.randomUUID(), now = new Date().toISOString() } = {}) {
  const batch = {
    id,
    name: typeof name === 'string' ? name.trim() : name,
    description: typeof description === 'string' ? description.trim() : description,
    createdAt: now,
    updatedAt: now
  };
  validateBatch(batch);
  return batch;
}

export function updateBatchRecord(batch, changes, now = new Date().toISOString()) {
  validateBatch(batch);
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new TypeError('Batch changes must be an object.');
  const updated = {
    id: batch.id,
    name: Object.hasOwn(changes, 'name') ? (typeof changes.name === 'string' ? changes.name.trim() : changes.name) : batch.name,
    description: Object.hasOwn(changes, 'description')
      ? (typeof changes.description === 'string' ? changes.description.trim() : changes.description)
      : batch.description,
    createdAt: batch.createdAt,
    updatedAt: now
  };
  validateBatch(updated);
  return updated;
}

export function calculateBatchProgress(items) {
  if (!Array.isArray(items)) throw new TypeError('Batch content must be an array.');
  const counts = { ideaCount: 0, draftCount: 0, readyCount: 0, completedCount: 0 };
  for (const item of items) {
    if (!CONTENT_STATUSES.includes(item?.status)) throw new TypeError('Content status is invalid.');
    counts[`${item.status}Count`] += 1;
  }
  const total = items.length;
  const readyOrCompletedCount = counts.readyCount + counts.completedCount;
  return {
    total,
    ...counts,
    readyOrCompletedCount,
    readyOrCompletedPercent: total === 0 ? 0 : Math.round(readyOrCompletedCount / total * 100)
  };
}
