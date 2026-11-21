import test from 'node:test';
import assert from 'node:assert/strict';

const dates = await import('../src/domain/dates.js').catch(() => ({}));
const retrieval = await import('../src/domain/search.js').catch(() => ({}));
const tags = await import('../src/domain/tags.js').catch(() => ({}));
const content = await import('../src/domain/content.js');

test('date-only validation accepts real calendar days without converting stored strings', () => {
  assert.equal(typeof dates.isValidDateOnly, 'function', 'isValidDateOnly is available');
  assert.equal(dates.isValidDateOnly('2026-11-24'), true);
  assert.equal(dates.isValidDateOnly('2024-02-29'), true);
  assert.equal(dates.isValidDateOnly('2026-02-29'), false);
  assert.equal(dates.isValidDateOnly('2026-13-01'), false);
  assert.equal(dates.isValidDateOnly('2026-2-01'), false);
  assert.equal(dates.parseDateOnly('2026-11-24').join('-'), '2026-11-24');
});

test('local date keys use local calendar fields and month navigation handles year boundaries', () => {
  assert.equal(typeof dates.localDateKey, 'function', 'localDateKey is available');
  const localDate = new Date(2026, 10, 24, 23, 45, 0);
  assert.equal(dates.localDateKey(localDate), '2026-11-24');
  assert.deepEqual(dates.addCalendarMonths(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(dates.addCalendarMonths(2026, 1, -1), { year: 2025, month: 12 });
});

test('local search matches title, hook, body, CTA, notes, and tags case-insensitively', () => {
  assert.equal(typeof retrieval.searchAndFilterContentItems, 'function', 'searchAndFilterContentItems is available');
  const item = {
    ...content.createContentItem('Holiday Launch', { id: 'search-1', now: '2026-11-20T20:00:00.000Z' }),
    hook: 'A unique hook phrase',
    body: 'Unique body phrase',
    cta: 'Unique CTA phrase',
    notes: 'Unique note phrase',
    tags: ['UniqueTag']
  };
  for (const query of [' holiday ', 'UNIQUE HOOK', 'unique body', 'unique cta', 'unique note', 'uniquetag']) {
    assert.deepEqual(retrieval.searchAndFilterContentItems([item], query), [item], `Query ${query} finds the item.`);
  }
  assert.deepEqual(retrieval.searchAndFilterContentItems([item], ''), [item]);
  assert.deepEqual(retrieval.searchAndFilterContentItems([item], 'missing'), []);
});

test('filters combine categories with AND and multi-values within one category with OR', () => {
  assert.equal(typeof retrieval.searchAndFilterContentItems, 'function', 'searchAndFilterContentItems is available');
  const make = (id, status, channel, contentType, batchId, tags) => ({
    ...content.createContentItem(id, { id, now: '2026-11-20T20:00:00.000Z' }),
    status,
    channel,
    contentType,
    batchId,
    tags
  });
  const records = [
    make('match', 'ready', 'linkedin', 'social-post', 'batch-a', ['product']),
    make('wrong-status', 'draft', 'linkedin', 'social-post', 'batch-a', ['product']),
    make('wrong-channel', 'ready', 'instagram', 'social-post', 'batch-a', ['product']),
    make('wrong-type', 'ready', 'linkedin', 'article', 'batch-a', ['product']),
    make('wrong-batch', 'ready', 'linkedin', 'social-post', 'batch-b', ['product']),
    make('wrong-tag', 'ready', 'linkedin', 'social-post', 'batch-a', ['education'])
  ];
  assert.deepEqual(retrieval.searchAndFilterContentItems(records, '', {
    status: 'ready', channel: 'linkedin', contentType: 'social-post', batchId: 'batch-a', tag: 'Product'
  }).map(item => item.id), ['match']);
  assert.deepEqual(retrieval.searchAndFilterContentItems(records, 'match', { status: ['draft', 'ready'] }).map(item => item.id), ['match']);
});

test('each approved filter category works independently and search does not mutate records', () => {
  const item = {
    ...content.createContentItem('Independent Filter', { id: 'independent-filter', now: '2026-11-20T20:00:00.000Z' }),
    status: 'ready', contentType: 'article', channel: 'blog', batchId: 'batch-filter', tags: ['Product'], body: 'searchable body'
  };
  const before = structuredClone(item);
  for (const filters of [
    { status: 'ready' },
    { contentType: 'article' },
    { channel: 'blog' },
    { batchId: 'batch-filter' },
    { tag: 'product' }
  ]) assert.deepEqual(retrieval.searchAndFilterContentItems([item], '', filters), [item]);
  assert.deepEqual(retrieval.searchAndFilterContentItems([item], ' searchable ', { status: 'ready' }), [item]);
  assert.deepEqual(item, before);
});

test('date-only value remains a string and an unscheduled item uses null', () => {
  const item = content.createContentItem('Date-only', { id: 'date-only', now: '2026-11-20T20:00:00.000Z' });
  assert.equal(item.scheduledDate, null);
  const planned = { ...item, scheduledDate: '2026-11-24' };
  assert.equal(content.validateContentItem(planned), true);
  assert.equal(planned.scheduledDate, '2026-11-24');
  assert.throws(() => content.validateContentItem({ ...planned, scheduledDate: '2026-11-24T00:00:00Z' }), /YYYY-MM-DD/);
});

test('tag normalization trims text, preserves first readable form, and rejects blank tags', () => {
  assert.equal(typeof tags.normalizeTags, 'function', 'normalizeTags is available');
  assert.deepEqual(tags.normalizeTags([' Product ', 'Education', 'product', 'PRODUCT']), ['Product', 'Education']);
  assert.throws(() => tags.normalizeTags(['   ']), /empty|blank|tag/i);
  assert.deepEqual(tags.parseTagInput(' Product, education,product, , '), ['Product', 'education']);
});

test('available tag filter values are derived from current content and deduplicated', () => {
  assert.equal(typeof tags.collectAvailableTags, 'function', 'collectAvailableTags is available');
  assert.deepEqual(tags.collectAvailableTags([{ tags: ['Product'] }, { tags: ['product', 'Education'] }]), ['Education', 'Product']);
});
