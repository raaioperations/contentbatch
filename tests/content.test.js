import test from 'node:test';
import assert from 'node:assert/strict';

const domain = await import('../src/domain/content.js').catch(() => ({}));

test('title-only quick capture creates a valid Idea with identity and timestamps', () => {
  assert.equal(typeof domain.createContentItem, 'function', 'createContentItem is available');
  const now = '2026-11-20T20:00:00.000Z';
  const item = domain.createContentItem('A content idea', { id: 'item-1', now });

  assert.equal(item.id, 'item-1');
  assert.equal(item.title, 'A content idea');
  assert.equal(item.status, 'idea');
  assert.equal(item.createdAt, now);
  assert.equal(item.updatedAt, now);
  assert.equal(item.completedAt, null);
  assert.equal(item.contentType, null);
  assert.equal(item.channel, null);
  assert.deepEqual(item.tags, []);
});

test('status changes are reversible and maintain completedAt', () => {
  assert.equal(typeof domain.transitionStatus, 'function', 'transitionStatus is available');
  const idea = domain.createContentItem('Status lifecycle', { id: 'item-2', now: '2026-11-20T20:00:00.000Z' });
  const draft = domain.transitionStatus(idea, 'draft', '2026-11-20T20:01:00.000Z');
  const ready = domain.transitionStatus(draft, 'ready', '2026-11-20T20:02:00.000Z');
  const completed = domain.transitionStatus(ready, 'completed', '2026-11-20T20:03:00.000Z');
  const reopened = domain.transitionStatus(completed, 'draft', '2026-11-20T20:04:00.000Z');

  assert.equal(draft.status, 'draft');
  assert.equal(ready.status, 'ready');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.completedAt, '2026-11-20T20:03:00.000Z');
  assert.equal(reopened.status, 'draft');
  assert.equal(reopened.completedAt, null);
  assert.equal(reopened.updatedAt, '2026-11-20T20:04:00.000Z');
});

test('duplicate is independent, starts as Idea, and retains editable content', () => {
  assert.equal(typeof domain.duplicateContentItem, 'function', 'duplicateContentItem is available');
  const source = {
    ...domain.createContentItem('Original title', { id: 'source-id', now: '2026-11-20T20:00:00.000Z' }),
    status: 'completed',
    completedAt: '2026-11-20T20:03:00.000Z',
    hook: 'Original hook',
    body: 'Original body',
    cta: 'Original call to action',
    notes: 'Original notes'
  };
  const copy = domain.duplicateContentItem(source, { id: 'copy-id', now: '2026-11-20T20:05:00.000Z' });

  assert.notEqual(copy.id, source.id);
  assert.equal(copy.id, 'copy-id');
  assert.equal(copy.status, 'idea');
  assert.equal(copy.completedAt, null);
  assert.equal(copy.createdAt, '2026-11-20T20:05:00.000Z');
  assert.equal(copy.updatedAt, copy.createdAt);
  assert.equal(copy.title, source.title);
  assert.equal(copy.hook, source.hook);
  assert.equal(copy.body, source.body);
  assert.equal(copy.cta, source.cta);
  assert.equal(copy.notes, source.notes);
  assert.notEqual(copy.tags, source.tags);
});

test('invalid required fields and statuses are rejected', () => {
  assert.equal(typeof domain.validateContentItem, 'function', 'validateContentItem is available');
  assert.throws(() => domain.createContentItem('   '), /title/i);
  const valid = domain.createContentItem('Valid title', { id: 'valid-id', now: '2026-11-20T20:00:00.000Z' });
  assert.throws(() => domain.transitionStatus(valid, 'planned'), /status/i);
  assert.equal(domain.validateContentItem(valid), true);
  assert.throws(() => domain.validateContentItem({ ...valid, status: 'planned' }), /status/i);
});
