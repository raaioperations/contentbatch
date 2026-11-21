const DATABASE_NAME = 'contentbatch';
const DATABASE_VERSION = 1;

let databasePromise;

export function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('This browser does not support local database storage.'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('contentItems')) {
        const items = database.createObjectStore('contentItems', { keyPath: 'id' });
        items.createIndex('status', 'status', { unique: false });
        items.createIndex('scheduledDate', 'scheduledDate', { unique: false });
        items.createIndex('batchId', 'batchId', { unique: false });
        items.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!database.objectStoreNames.contains('batches')) {
        const batches = database.createObjectStore('batches', { keyPath: 'id' });
        batches.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!database.objectStoreNames.contains('templates')) {
        const templates = database.createObjectStore('templates', { keyPath: 'id' });
        templates.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open local database.'));
    request.onblocked = () => reject(new Error('Close another ContentBatch tab to finish opening local storage.'));
  }).catch(error => {
    databasePromise = undefined;
    throw error;
  });

  return databasePromise;
}

export async function runStoreRequest(storeName, mode, makeRequest) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let request;
    let result;
    let settled = false;
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error ?? new Error('Local storage operation failed.'));
    };

    let transaction;
    try {
      transaction = database.transaction(storeName, mode);
      request = makeRequest(transaction.objectStore(storeName));
    } catch (error) {
      fail(error);
      return;
    }

    request.onsuccess = () => { result = request.result; };
    request.onerror = () => fail(request.error);
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    transaction.onerror = () => fail(transaction.error);
    transaction.onabort = () => fail(transaction.error ?? new Error('Local storage transaction was cancelled.'));
  });
}

export async function runTransaction(storeNames, mode, queueRequests) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction;
    let result;
    let abortError = null;
    let settled = false;
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error ?? new Error('Local storage operation failed.'));
    };

    try {
      transaction = database.transaction(storeNames, mode);
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      transaction.onerror = () => { abortError ??= transaction.error; };
      transaction.onabort = () => fail(abortError ?? transaction.error ?? new Error('Local storage transaction was cancelled.'));
      const abort = error => {
        abortError = error;
        try {
          transaction.abort();
        } catch {
          fail(error);
        }
      };
      result = queueRequests(transaction, { abort });
    } catch (error) {
      if (transaction) {
        abortError = error;
        try { transaction.abort(); } catch { fail(error); }
      } else {
        fail(error);
      }
    }
  });
}
