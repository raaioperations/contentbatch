import test from 'node:test';
import assert from 'node:assert/strict';

const domain = await import('../src/domain/batches.js').catch(() => ({}));

test('Batch creation trims its name and supplies identity and timestamps', () => {
  assert.equal(typeof domain.createBatchRecord, 'function', 'createBatchRecord is available');
  const now = '2026-11-20T20:00:00.000Z';
  const batch = domain.createBatchRecord('  Test Batch  ', 'Test description', { id: 'batch-1', now });

  assert.equal(batch.id, 'batch-1');
  assert.equal(batch.name, 'Test Batch');
  assert.equal(batch.description, 'Test description');
  assert.equal(batch.createdAt, now);
  assert.equal(batch.updatedAt, now);
});

test('Batch creation generates a UUID when the caller does not provide an id', () => {
  assert.equal(typeof domain.createBatchRecord, 'function', 'createBatchRecord is available');
  const batch = domain.createBatchRecord('Generated Batch', '', { now: '2026-11-20T20:00:00.000Z' });
  assert.match(batch.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('Batch creation rejects a blank name and normalizes an unused description', () => {
  assert.equal(typeof domain.createBatchRecord, 'function', 'createBatchRecord is available');
  assert.throws(() => domain.createBatchRecord('  '), /name/i);
  const batch = domain.createBatchRecord('Valid Batch', undefined, { id: 'batch-2', now: '2026-11-20T20:00:00.000Z' });
  assert.equal(batch.description, '');
});

test('Batch updates trim fields and update updatedAt without changing creation time', () => {
  assert.equal(typeof domain.updateBatchRecord, 'function', 'updateBatchRecord is available');
  const batch = domain.createBatchRecord('Old Name', 'Old description', { id: 'batch-3', now: '2026-11-20T20:00:00.000Z' });
  const updated = domain.updateBatchRecord(batch, { name: ' New Name ', description: ' New description ' }, '2026-11-20T21:00:00.000Z');

  assert.equal(updated.name, 'New Name');
  assert.equal(updated.description, 'New description');
  assert.equal(updated.createdAt, batch.createdAt);
  assert.equal(updated.updatedAt, '2026-11-20T21:00:00.000Z');
  assert.throws(() => domain.updateBatchRecord(batch, { name: '   ' }), /name/i);
});

test('Batch progress derives status counts and rounded ready progress', () => {
  assert.equal(typeof domain.calculateBatchProgress, 'function', 'calculateBatchProgress is available');
  const statuses = ['idea', 'idea', 'draft', 'draft', 'ready', 'ready', 'completed'];
  const items = statuses.map((status, index) => ({ id: `item-${index}`, status }));
  assert.deepEqual(domain.calculateBatchProgress(items), {
    total: 7,
    ideaCount: 2,
    draftCount: 2,
    readyCount: 2,
    completedCount: 1,
    readyOrCompletedCount: 3,
    readyOrCompletedPercent: 43
  });
  assert.deepEqual(domain.calculateBatchProgress([]), {
    total: 0,
    ideaCount: 0,
    draftCount: 0,
    readyCount: 0,
    completedCount: 0,
    readyOrCompletedCount: 0,
    readyOrCompletedPercent: 0
  });
});
