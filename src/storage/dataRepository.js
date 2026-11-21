import { runTransaction } from './db.js';
import { buildBackup, validateBackup } from '../domain/backup.js';
const stores = ['contentItems', 'batches', 'templates', 'settings'];
export async function exportBackup() {
 const data = {};
 await runTransaction(stores, 'readonly', transaction => {
  for (const name of stores) {
   const request = transaction.objectStore(name).getAll();
   request.onsuccess = () => { data[name] = name === 'settings' ? request.result.find(record => record.id === 'app') ?? {} : request.result; };
  }
 });
 return buildBackup(data);
}
export async function restoreBackup(input) {
 const backup = validateBackup(input);
 await runTransaction(stores, 'readwrite', transaction => {
  for (const name of stores) {
   const store = transaction.objectStore(name);
   store.clear();
   const records = name === 'settings' ? (backup.settings.id ? [backup.settings] : []) : backup[name];
   for (const record of records) store.add(record);
  }
 });
}
