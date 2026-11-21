import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentItem } from '../src/domain/content.js';
import { buildBackup, parseBackup } from '../src/domain/backup.js';
import { csvCell, metadataCsv, contentPackage, storageProtection } from '../src/domain/portability.js';
const data = () => ({ contentItems: [createContentItem('Portable')], batches: [], templates: [], settings: {} });
test('backup preserves entities, dates, identifiers and metadata', () => { const original = data(); original.contentItems[0].scheduledDate = '2026-11-24'; const backup = buildBackup(original); assert.deepEqual(parseBackup(JSON.stringify(backup)), backup); assert.equal(backup.schemaVersion, 1); });
for (const [name, mutate] of [
 ['application', b => b.application = 'Wrong'], ['schema', b => b.schemaVersion = 2], ['content', b => b.contentItems[0].status = 'planned'], ['batch', b => b.batches = [{}]], ['template', b => b.templates = [{}]], ['relationship', b => b.contentItems[0].batchId = crypto.randomUUID()], ['settings', b => b.settings = []]
]) test(`invalid backup ${name} rejected`, () => { const backup = buildBackup(data()); mutate(backup); assert.throws(() => parseBackup(JSON.stringify(backup))); });
test('malformed JSON rejected', () => assert.throws(() => parseBackup('{'), /JSON/));
test('CSV escapes commas, quotes, newlines, Unicode and formula prefixes', () => { assert.equal(csvCell('a,b'), '"a,b"'); assert.equal(csvCell('a"b'), '"a""b"'); assert.equal(csvCell('a\nb'), '"a\nb"'); assert.equal(csvCell('日本語'), '日本語'); assert.equal(csvCell('=cmd'), "'=cmd"); const item = data().contentItems[0]; item.tags = ['product','education']; assert.match(metadataCsv([item], []), /product; education/); });
test('package skips empty fields and excludes identity', () => { const item = data().contentItems[0]; assert.equal(contentPackage(item), 'Title:\nPortable'); });
for (const [name, storage, expected] of [
 ['unsupported', {}, /not supported/], ['persistent', {persisted: async () => true, persist: async () => false}, /is persistent/], ['grant', {persisted: async () => false, persist: async () => true}, /now persistent/], ['denial', {persisted: async () => false, persist: async () => false}, /not granted/], ['failure', {persisted: async () => {throw Error();}, persist: async () => false}, /could not/]
]) test(`storage protection ${name}`, async () => assert.match(await storageProtection(storage, true), expected));
test('unknown imported keys cannot pollute prototypes', () => { const backup = buildBackup(data()); backup.contentItems[0].__protoPayload = { polluted: true }; const clean = parseBackup(JSON.stringify(backup)); assert.equal(Object.hasOwn(clean.contentItems[0], '__protoPayload'), false); assert.equal({}.polluted, undefined); });
