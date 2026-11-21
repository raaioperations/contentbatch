export const CONTENT_STATUSES = Object.freeze(['idea', 'draft', 'ready', 'completed']);

export const CONTENT_TYPES = Object.freeze([
  'social-post',
  'short-video',
  'long-video',
  'article',
  'email',
  'other'
]);

export const CHANNELS = Object.freeze([
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'x',
  'email',
  'blog',
  'other'
]);

import { isValidDateOnly } from './dates.js';

const TEXT_FIELDS = ['hook', 'body', 'cta', 'notes'];

function isIsoTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function validateContentItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('Content item must be an object.');
  if (typeof item.id !== 'string' || !item.id.trim()) throw new TypeError('Content item id is required.');
  if (typeof item.title !== 'string' || !item.title.trim()) throw new TypeError('A title is required.');
  if (!CONTENT_STATUSES.includes(item.status)) throw new TypeError('Content status is invalid.');
  if (item.contentType !== null && !CONTENT_TYPES.includes(item.contentType)) throw new TypeError('Content type is invalid.');
  if (item.channel !== null && !CHANNELS.includes(item.channel)) throw new TypeError('Channel is invalid.');
  if (item.contentType !== 'other' && item.customContentType !== null) throw new TypeError('Custom content type is only valid when type is Other.');
  if (item.channel !== 'other' && item.customChannel !== null) throw new TypeError('Custom channel is only valid when channel is Other.');
  if (item.customContentType !== null && typeof item.customContentType !== 'string') throw new TypeError('Custom content type must be text.');
  if (item.customChannel !== null && typeof item.customChannel !== 'string') throw new TypeError('Custom channel must be text.');
  for (const field of TEXT_FIELDS) {
    if (typeof item[field] !== 'string') throw new TypeError(`${field} must be text.`);
  }
  if (item.scheduledDate !== null && !isValidDateOnly(item.scheduledDate)) throw new TypeError('Scheduled date must use YYYY-MM-DD.');
  if (item.batchId !== null && (typeof item.batchId !== 'string' || !item.batchId.trim())) throw new TypeError('Batch id must be text or null.');
  if (!Array.isArray(item.tags) || item.tags.some(tag => typeof tag !== 'string' || !tag.trim())) throw new TypeError('Tags must be non-empty text values.');
  if (!isIsoTimestamp(item.createdAt)) throw new TypeError('Created timestamp is invalid.');
  if (!isIsoTimestamp(item.updatedAt)) throw new TypeError('Updated timestamp is invalid.');
  if (item.completedAt !== null && !isIsoTimestamp(item.completedAt)) throw new TypeError('Completed timestamp is invalid.');
  if (item.status === 'completed' && item.completedAt === null) throw new TypeError('Completed content requires a completed timestamp.');
  if (item.status !== 'completed' && item.completedAt !== null) throw new TypeError('Only completed content can have a completed timestamp.');
  return true;
}

export function createContentItem(title, { id = globalThis.crypto.randomUUID(), now = new Date().toISOString() } = {}) {
  const item = {
    id,
    title: typeof title === 'string' ? title.trim() : title,
    status: 'idea',
    contentType: null,
    customContentType: null,
    channel: null,
    customChannel: null,
    hook: '',
    body: '',
    cta: '',
    notes: '',
    scheduledDate: null,
    batchId: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null
  };
  validateContentItem(item);
  return item;
}

export function transitionStatus(item, nextStatus, now = new Date().toISOString()) {
  validateContentItem(item);
  if (!CONTENT_STATUSES.includes(nextStatus)) throw new TypeError('Content status is invalid.');
  if (item.status === nextStatus) return { ...item, tags: [...item.tags] };
  const updated = {
    ...item,
    status: nextStatus,
    updatedAt: now,
    completedAt: nextStatus === 'completed' ? now : null,
    tags: [...item.tags]
  };
  validateContentItem(updated);
  return updated;
}

export function duplicateContentItem(item, { id = globalThis.crypto.randomUUID(), now = new Date().toISOString() } = {}) {
  validateContentItem(item);
  if (id === item.id) throw new TypeError('Duplicate content must have a new id.');
  const duplicate = {
    ...item,
    id,
    status: 'idea',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    tags: [...item.tags]
  };
  validateContentItem(duplicate);
  return duplicate;
}
