import { button, element } from './dom.js';
import { exportBackup, restoreBackup } from '../storage/dataRepository.js';
import { parseBackup, MAX_BACKUP_BYTES } from '../domain/backup.js';
import { metadataCsv, storageProtection } from '../domain/portability.js';
function download(text, filename, type) {
 const url = URL.createObjectURL(new Blob([text], { type }));
 const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
 setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function openDataTools({ flush, reload, notify }) {
 const trigger = document.activeElement;
 const dialog = element('dialog', { className: 'capture-dialog', attrs: { 'aria-labelledby': 'data-tools-title' } });
 dialog.append(element('h2', { text: 'Data / Backup', attrs: { id: 'data-tools-title' } }));
 dialog.append(element('p', { text: 'ContentBatch stores your content in this browser on this device. Clearing site/browser data may remove it. Export a backup to preserve a portable copy.' }));
 const status = element('p', { attrs: { role: 'status', 'aria-live': 'polite' } });
 const actions = element('div', { className: 'data-actions' });
 const backup = button('Export JSON Backup');
 backup.id = 'export-backup';
 backup.onclick = async () => { try { if (!await flush()) return; const data = await exportBackup(); download(JSON.stringify(data, null, 2), `ContentBatch-Backup-${data.exportedAt.slice(0,10)}.json`, 'application/json'); status.textContent = 'Backup exported.'; } catch (error) { status.textContent = `Export failed: ${error.message}`; } };
 const csv = button('Export CSV'); csv.id = 'export-csv';
 csv.onclick = async () => { try { if (!await flush()) return; const data = await exportBackup(); download(metadataCsv(data.contentItems, data.batches), 'ContentBatch-Metadata.csv', 'text/csv;charset=utf-8'); status.textContent = 'CSV exported.'; } catch (error) { status.textContent = `Export failed: ${error.message}`; } };
 const label = element('label', { text: 'Restore JSON Backup (maximum 25 MiB)', attrs: { for: 'restore-backup' } });
 const file = element('input', { className: 'text-input', attrs: { id: 'restore-backup', type: 'file', accept: '.json,application/json' } });
 file.onchange = async () => {
  try {
   if (!file.files[0]) return;
   if (file.files[0].size > MAX_BACKUP_BYTES) throw Error('Backup exceeds the 25 MiB limit.');
   const data = parseBackup(await file.files[0].text());
   if (!await flush()) return;
   if (!window.confirm(`Replace ALL current ContentBatch data with this backup? ${data.contentItems.length} content items, ${data.batches.length} Batches, ${data.templates.length} Templates. This cannot be undone.`)) return;
   await restoreBackup(data); await reload(); dialog.close(); notify('Backup restored successfully.');
  } catch (error) { status.textContent = `Restore failed. Existing data was not replaced: ${error.message}`; }
  finally { file.value = ''; }
 };
 const protect = button('Protect Local Data'); protect.id = 'protect-local-data';
 protect.onclick = async () => { status.textContent = await storageProtection(navigator.storage, true); };
 const close = button('Close'); close.onclick = () => dialog.close();
 actions.append(backup, csv, label, file, protect, close); dialog.append(actions, status);
 document.body.append(dialog); dialog.addEventListener('close', () => { dialog.remove(); if (trigger?.isConnected) trigger.focus(); }, { once: true }); dialog.showModal(); backup.focus();
 storageProtection(navigator.storage).then(message => { if (dialog.open) status.textContent = message; });
}
