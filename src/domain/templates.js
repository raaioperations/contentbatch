import { CHANNELS, CONTENT_TYPES, createContentItem, validateContentItem } from './content.js';
import { normalizeTags } from './tags.js';

const TEMPLATE_TEXT_FIELDS = ['hook', 'body', 'cta', 'notes'];
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

function normalizeChoice(value, allowed, label) {
  if (value === undefined || value === '') return null;
  if (value === null || allowed.includes(value)) return value;
  throw new TypeError(`${label} is invalid.`);
}

export function validateTemplate(template) {
  if (!template || typeof template !== 'object' || Array.isArray(template)) throw new TypeError('Template must be an object.');
  if (typeof template.id !== 'string' || !template.id.trim()) throw new TypeError('Template id is required.');
  if (typeof template.name !== 'string' || !template.name.trim()) throw new TypeError('A template name is required.');
  if (template.contentType !== null && !CONTENT_TYPES.includes(template.contentType)) throw new TypeError('Template content type is invalid.');
  if (template.channel !== null && !CHANNELS.includes(template.channel)) throw new TypeError('Template channel is invalid.');
  if (template.contentType !== 'other' && template.customContentType !== null) throw new TypeError('Custom content type is only valid when type is Other.');
  if (template.channel !== 'other' && template.customChannel !== null) throw new TypeError('Custom channel is only valid when channel is Other.');
  for (const field of ['customContentType', 'customChannel', ...TEMPLATE_TEXT_FIELDS]) {
    if (template[field] !== null && typeof template[field] !== 'string') throw new TypeError(`${field} must be text.`);
  }
  normalizeTags(template.tags);
  for (const field of ['createdAt', 'updatedAt']) {
    if (typeof template[field] !== 'string' || !ISO_TIMESTAMP_PATTERN.test(template[field]) || !Number.isFinite(Date.parse(template[field]))) throw new TypeError(`${field} timestamp is invalid.`);
  }
  return true;
}

export function createTemplateRecord(input, { id = globalThis.crypto.randomUUID(), now = new Date().toISOString() } = {}) {
  const contentType = normalizeChoice(input.contentType, CONTENT_TYPES, 'Template content type');
  const channel = normalizeChoice(input.channel, CHANNELS, 'Template channel');
  const template = {
    id,
    name: typeof input.name === 'string' ? input.name.trim() : input.name,
    contentType,
    customContentType: contentType === 'other' ? String(input.customContentType ?? '').trim() || null : null,
    channel,
    customChannel: channel === 'other' ? String(input.customChannel ?? '').trim() || null : null,
    hook: String(input.hook ?? ''),
    body: String(input.body ?? ''),
    cta: String(input.cta ?? ''),
    notes: String(input.notes ?? ''),
    tags: normalizeTags(input.tags ?? []),
    createdAt: now,
    updatedAt: now
  };
  validateTemplate(template);
  return template;
}

export function updateTemplateRecord(template, changes, now = new Date().toISOString()) {
  validateTemplate(template);
  const candidate = createTemplateRecord({ ...template, ...changes }, { id: template.id, now });
  candidate.createdAt = template.createdAt;
  validateTemplate(candidate);
  return candidate;
}

export function applyTemplateToContentItem(template, title, { id = globalThis.crypto.randomUUID(), now = new Date().toISOString(), batchId = null } = {}) {
  validateTemplate(template);
  if (id === template.id) throw new TypeError('Template application must create a new content identity.');
  const item = createContentItem(title, { id, now });
  const copy = {
    ...item,
    contentType: template.contentType,
    customContentType: template.customContentType,
    channel: template.channel,
    customChannel: template.customChannel,
    hook: template.hook,
    body: template.body,
    cta: template.cta,
    notes: template.notes,
    tags: [...template.tags],
    batchId: batchId ?? null
  };
  validateContentItem(copy);
  return copy;
}
