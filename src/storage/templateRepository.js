import { createTemplateRecord, updateTemplateRecord, validateTemplate } from '../domain/templates.js';
import { runStoreRequest } from './db.js';

export async function createTemplate(input) {
  const template = createTemplateRecord(input);
  await runStoreRequest('templates', 'readwrite', store => store.add(template));
  return template;
}

export function getTemplate(id) {
  return runStoreRequest('templates', 'readonly', store => store.get(id));
}

export async function getAllTemplates() {
  const templates = await runStoreRequest('templates', 'readonly', store => store.getAll());
  return templates.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveTemplate(template) {
  validateTemplate(template);
  const saved = { ...template, updatedAt: new Date().toISOString() };
  validateTemplate(saved);
  await runStoreRequest('templates', 'readwrite', store => store.put(saved));
  return saved;
}

export async function updateTemplate(id, changes) {
  const template = await getTemplate(id);
  if (!template) throw new Error('This Template no longer exists.');
  const updated = updateTemplateRecord(template, changes);
  await runStoreRequest('templates', 'readwrite', store => store.put(updated));
  return updated;
}

export function deleteTemplate(id) {
  return runStoreRequest('templates', 'readwrite', store => store.delete(id));
}
