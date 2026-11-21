export function contentPackage(item) {
 return [['Title', item.title], ['Hook', item.hook], ['Content', item.body], ['CTA', item.cta], ['Notes', item.notes]].filter(([, text]) => text?.trim()).map(([label, text]) => `${label}:\n${text}`).join('\n\n');
}
export function csvCell(value) {
 let text = String(value ?? '');
 if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
 return /[,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function metadataCsv(items, batches) {
 const names = new Map(batches.map(batch => [batch.id, batch.name]));
 const rows = [['Title','Content Type','Channel','Status','Scheduled Date','Batch','Tags','Updated At']];
 for (const item of items) rows.push([item.title, item.contentType === 'other' ? item.customContentType : item.contentType, item.channel === 'other' ? item.customChannel : item.channel, item.status, item.scheduledDate, names.get(item.batchId) ?? '', item.tags.join('; '), item.updatedAt]);
 return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
export async function storageProtection(storage, request = false) {
 if (!storage?.persisted || !storage?.persist) return 'Persistent storage is not supported here. Use backups to protect your work.';
 try {
  if (await storage.persisted()) return 'Local storage is persistent. Backups are still needed.';
  if (request && await storage.persist()) return 'Local storage is now persistent. Backups are still needed.';
  return request ? 'Persistence was not granted. ContentBatch still works; keep portable backups.' : 'Local storage is not persistent. You can request protection below.';
 } catch { return 'Storage protection could not be checked. ContentBatch still works; keep portable backups.'; }
}
