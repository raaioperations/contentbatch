import { validateContentItem, CONTENT_TYPES, CHANNELS } from './content.js';
import { validateBatch } from './batches.js';
import { validateTemplate } from './templates.js';
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const fields = {
 contentItems: 'id title status contentType customContentType channel customChannel hook body cta notes scheduledDate batchId tags createdAt updatedAt completedAt'.split(' '),
 batches: 'id name description createdAt updatedAt'.split(' '),
 templates: 'id name contentType customContentType channel customChannel hook body cta notes tags createdAt updatedAt'.split(' ')
};
const validators = { contentItems: validateContentItem, batches: validateBatch, templates: validateTemplate };
export function validateBackup(input) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Backup must be an object.');
 if (input.application !== 'ContentBatch') throw Error('This is not a ContentBatch backup.');
 if (input.schemaVersion !== 1) throw Error('Unsupported backup schema version.');
 if (typeof input.exportedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(input.exportedAt) || !Number.isFinite(Date.parse(input.exportedAt))) throw Error('Invalid export timestamp.');
 const result = { application: 'ContentBatch', schemaVersion: 1, exportedAt: input.exportedAt };
 for (const store of Object.keys(fields)) {
  if (!Array.isArray(input[store])) throw Error(`${store} must be an array.`);
  const ids = new Set();
  result[store] = input[store].map(record => {
   if (!record || typeof record !== 'object' || Array.isArray(record)) throw Error(`Invalid ${store} record.`);
   const clean = Object.fromEntries(fields[store].map(key => [key, record[key]]));
   validators[store](clean);
   if (store === 'templates' && ['hook','body','cta','notes'].some(key => typeof clean[key] !== 'string')) throw Error('Template text fields must be strings.');
   if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean.id) || ids.has(clean.id)) throw Error(`Invalid or duplicate ${store} identity.`);
   ids.add(clean.id);
   if (clean.tags) clean.tags = [...clean.tags];
   for (const value of Object.values(clean)) if (typeof value === 'string' && value.length > 2000000) throw Error('A text field is too large.');
   return clean;
  });
 }
 const batchIds = new Set(result.batches.map(batch => batch.id));
 if (result.contentItems.some(item => item.batchId !== null && !batchIds.has(item.batchId))) throw Error('Content references a missing Batch.');
 const settings = input.settings;
 if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw Error('Settings must be an object.');
 result.settings = {};
 if (Object.keys(settings).length) {
  if (settings.id !== 'app' || settings.schemaVersion !== 1 || !(settings.defaultContentType === null || CONTENT_TYPES.includes(settings.defaultContentType)) || !(settings.defaultChannel === null || CHANNELS.includes(settings.defaultChannel))) throw Error('Invalid settings.');
  result.settings = { id: 'app', schemaVersion: 1, defaultContentType: settings.defaultContentType, defaultChannel: settings.defaultChannel };
 }
 return result;
}
export function parseBackup(text) {
 if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw Error('Backup exceeds the 25 MiB limit.');
 let value;
 try { value = JSON.parse(text); } catch { throw Error('Backup is not valid JSON.'); }
 return validateBackup(value);
}
export function buildBackup(data, now = new Date().toISOString()) {
 return validateBackup({ application: 'ContentBatch', schemaVersion: 1, exportedAt: now, ...data });
}
