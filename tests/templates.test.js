import test from 'node:test';
import assert from 'node:assert/strict';

const templates = await import('../src/domain/templates.js').catch(() => ({}));

const now = '2026-11-20T20:00:00.000Z';

test('Template creation validates its name and creates a UUID timestamped reusable record', () => {
  assert.equal(typeof templates.createTemplateRecord, 'function', 'createTemplateRecord is available');
  const template = templates.createTemplateRecord({ name: ' Educational Post ', hook: 'A useful opening' }, { id: 'template-1', now });
  assert.deepEqual(template, {
    id: 'template-1', name: 'Educational Post', contentType: null, customContentType: null,
    channel: null, customChannel: null, hook: 'A useful opening', body: '', cta: '', notes: '',
    tags: [], createdAt: now, updatedAt: now
  });
  assert.throws(() => templates.createTemplateRecord({ name: '   ' }), /name/i);
  const generated = templates.createTemplateRecord({ name: 'Generated' }, { now });
  assert.match(generated.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('Template update changes reusable fields and updatedAt without introducing ContentItem fields', () => {
  assert.equal(typeof templates.updateTemplateRecord, 'function', 'updateTemplateRecord is available');
  const template = templates.createTemplateRecord({ name: 'Old', tags: ['Product'] }, { id: 'template-2', now });
  const updated = templates.updateTemplateRecord(template, { name: 'New', body: 'Updated body' }, '2026-11-20T21:00:00.000Z');
  assert.equal(updated.name, 'New');
  assert.equal(updated.body, 'Updated body');
  assert.equal(updated.createdAt, now);
  assert.equal(updated.updatedAt, '2026-11-20T21:00:00.000Z');
  for (const forbidden of ['status', 'scheduledDate', 'completedAt', 'batchId']) assert.equal(Object.hasOwn(updated, forbidden), false);
});

test('applying a Template creates an independent Idea with only approved reusable fields', () => {
  assert.equal(typeof templates.applyTemplateToContentItem, 'function', 'applyTemplateToContentItem is available');
  const template = templates.createTemplateRecord({
    name: 'Educational Post', contentType: 'other', customContentType: 'Carousel',
    channel: 'other', customChannel: 'Community', hook: 'Hook', body: '1.\n2.', cta: 'Reply', notes: 'Private', tags: ['Education']
  }, { id: 'template-3', now });
  const item = templates.applyTemplateToContentItem(template, 'My new title', { id: 'content-3', now, batchId: 'batch-3' });
  assert.notEqual(item.id, template.id);
  assert.equal(item.status, 'idea');
  assert.equal(item.title, 'My new title');
  assert.equal(item.scheduledDate, null);
  assert.equal(item.completedAt, null);
  assert.equal(item.batchId, 'batch-3');
  assert.equal(item.createdAt, now);
  assert.equal(item.updatedAt, now);
  for (const field of ['contentType', 'customContentType', 'channel', 'customChannel', 'hook', 'body', 'cta', 'notes']) assert.equal(item[field], template[field]);
  assert.deepEqual(item.tags, ['Education']);
  assert.notEqual(item.tags, template.tags);
});

test('Template and applied ContentItem remain independent after edits in either direction', () => {
  const template = templates.createTemplateRecord({ name: 'Independent', body: 'Template body', tags: ['Original'] }, { id: 'template-4', now });
  const item = templates.applyTemplateToContentItem(template, 'Independent content', { id: 'content-4', now });
  const editedTemplate = templates.updateTemplateRecord(template, { body: 'Changed template', tags: ['Changed'] }, '2026-11-20T21:00:00.000Z');
  const editedItem = { ...item, body: 'Changed content', tags: ['Content tag'] };
  assert.equal(item.body, 'Template body');
  assert.deepEqual(item.tags, ['Original']);
  assert.equal(editedTemplate.body, 'Changed template');
  assert.deepEqual(editedTemplate.tags, ['Changed']);
  assert.equal(editedItem.body, 'Changed content');
  assert.deepEqual(editedItem.tags, ['Content tag']);
});
