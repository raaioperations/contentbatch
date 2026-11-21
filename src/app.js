import { openDataTools } from './ui/dataTools.js';
import { contentPackage } from './domain/portability.js';
import { duplicateContentItem, transitionStatus } from './domain/content.js';
import { formatDateOnly, localDateKey, parseDateOnly } from './domain/dates.js';
import { searchAndFilterContentItems } from './domain/search.js';
import { collectAvailableTags, parseTagInput } from './domain/tags.js';
import { applyTemplateToContentItem } from './domain/templates.js';
import { addContentItem, deleteContentItem, listContentItems, saveContentItem } from './storage/contentRepository.js';
import {
  assignContentItemToBatch,
  createBatch,
  createContentItemInBatch,
  deleteBatch as removeBatch,
  getAllBatches,
  removeContentItemFromBatch,
  updateBatch
} from './storage/batchRepository.js';
import { createTemplate, deleteTemplate, getAllTemplates, updateTemplate } from './storage/templateRepository.js';
import { renderContentResults, renderContentView } from './ui/contentView.js';
import { element } from './ui/dom.js';
import { renderEditor } from './ui/editorView.js';
import { renderHome } from './ui/homeView.js';
import { renderBatchesView, renderBatchDetailView, renderExistingContentChoices } from './ui/batchesView.js';
import { monthAfter, renderPlanView } from './ui/planView.js';
import { renderTemplatesView } from './ui/templatesView.js';
import { bindNavigation, updateNavigation } from './ui/navigation.js';

const screen = document.querySelector('#screen');
const dialog = document.querySelector('#new-content-dialog');
const dialogForm = document.querySelector('#new-content-form');
const dialogInput = document.querySelector('#new-content-title-input');
const batchDialog = document.querySelector('#batch-dialog');
const batchForm = document.querySelector('#batch-form');
const batchNameInput = document.querySelector('#batch-name-input');
const batchDescriptionInput = document.querySelector('#batch-description-input');
const addContentDialog = document.querySelector('#add-content-dialog');
const templateDialog = document.querySelector('#template-dialog');
const templateForm = document.querySelector('#template-form');
const applyTemplateDialog = document.querySelector('#apply-template-dialog');
const applyTemplateForm = document.querySelector('#apply-template-form');
const toast = document.querySelector('#toast');

let contentItems = [];
let batches = [];
let templates = [];
let view = 'home';
let activeItemId = null;
let activeBatchId = null;
let editorReturnView = 'content';
let creationBatchId = null;
let templateDialogMode = 'create';
let editingTemplateId = null;
let applyTemplateId = null;
let templateReturnView = 'content';
let templateReturnBatchId = null;
let contentQuery = '';
let contentFilters = { status: '', contentType: '', channel: '', batchId: '', tag: '' };
const initialPlanParts = parseDateOnly(localDateKey());
let planYear = Number(initialPlanParts[0]);
let planMonth = Number(initialPlanParts[1]);
let selectedPlanDate = localDateKey();
let batchDialogMode = 'create';
let editRevision = 0;
let savedRevision = 0;
let saveTimer = null;
let writeInFlight = null;
let toastTimer = null;

function currentItem() {
  return contentItems.find(item => item.id === activeItemId) ?? null;
}

function currentBatch() {
  return batches.find(batch => batch.id === activeBatchId) ?? null;
}

function replaceItem(nextItem) {
  contentItems = contentItems
    .map(item => item.id === nextItem.id ? nextItem : item)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function showToast(message, { error = false } = {}) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('toast-error', error);
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function setSaveState(state, message) {
  const status = screen.querySelector('#save-status');
  const retry = screen.querySelector('[data-action="retry-save"]');
  const block = screen.querySelector('.save-block');
  if (!status || !block) return;
  block.dataset.saveState = state;
  status.textContent = message;
  if (retry) retry.hidden = state !== 'failed';
}

function setPage(viewName) {
  view = viewName;
  const navView = viewName === 'editor'
    ? (editorReturnView === 'batch-detail' ? 'batches' : editorReturnView === 'plan' ? 'plan' : 'content')
    : viewName === 'batch-detail' ? 'batches'
      : viewName === 'templates' ? (templateReturnView === 'batch-detail' ? 'batches' : 'content') : viewName;
  updateNavigation(viewName, navView);
  if (viewName === 'home') screen.replaceChildren(renderHome(contentItems));
  else if (viewName === 'content') {
    const filteredItems = searchAndFilterContentItems(contentItems, contentQuery, contentFilters);
    screen.replaceChildren(renderContentView(contentItems, { query: contentQuery, filters: contentFilters, batches, tags: collectAvailableTags(contentItems), filteredItems }));
  }
  else if (viewName === 'batches') screen.replaceChildren(renderBatchesView(batches, contentItems));
  else if (viewName === 'batch-detail' && currentBatch()) {
    const batchItems = contentItems.filter(item => item.batchId === activeBatchId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    screen.replaceChildren(renderBatchDetailView(currentBatch(), batchItems));
  } else if (viewName === 'editor' && currentItem()) {
    const backLabel = editorReturnView === 'batch-detail' ? 'Back to Batch' : editorReturnView === 'plan' ? 'Back to Plan' : 'Back to content';
    screen.replaceChildren(renderEditor(currentItem(), batches, backLabel));
  }
  else if (viewName === 'plan') screen.replaceChildren(renderPlanView(contentItems, { year: planYear, month: planMonth, selectedDate: selectedPlanDate }));
  else if (viewName === 'templates') screen.replaceChildren(renderTemplatesView(templates, { batchName: templateReturnBatchId ? batches.find(batch => batch.id === templateReturnBatchId)?.name : null }));
  else {
    view = 'content';
    updateNavigation(view);
    screen.replaceChildren(renderContentView(contentItems));
  }
  bindScreenActions();
  if (view === 'editor') bindEditor();
}

async function refreshData() {
  [contentItems, batches, templates] = await Promise.all([listContentItems(), getAllBatches(), getAllTemplates()]);
}

function resetEditorState() {
  editRevision = 0;
  savedRevision = 0;
  window.clearTimeout(saveTimer);
  saveTimer = null;
  writeInFlight = null;
}

function updateStatusSummary(item) {
  const summary = screen.querySelector('[data-status-summary]');
  if (!summary) return;
  summary.dataset.statusSummary = item.status;
  const badge = document.createElement('span');
  badge.className = `status-badge status-${item.status}`;
  badge.textContent = ({ idea: 'Idea', draft: 'Draft', ready: 'Ready', completed: 'Completed' })[item.status];
  summary.replaceChildren(summary.querySelector('.detail-caption'), badge);
  const heading = screen.querySelector('.editor-heading h2');
  if (heading) heading.textContent = item.title || 'New content';
}

function scheduleSave() {
  if (savedRevision === 0 && !screen.querySelector('#save-status')) return;
  setSaveState('unsaved', 'Unsaved');
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    persistLatest().catch(() => {});
  }, 650);
}

async function persistLatest() {
  window.clearTimeout(saveTimer);
  saveTimer = null;
  if (!activeItemId || savedRevision >= editRevision) return true;
  if (writeInFlight) {
    await writeInFlight;
    return true;
  }

  const item = currentItem();
  if (!item) return true;
  const revision = editRevision;
  const snapshot = structuredClone(item);
  setSaveState('saving', 'Saving…');
  writeInFlight = saveContentItem(snapshot);

  try {
    const savedItem = await writeInFlight;
    savedRevision = Math.max(savedRevision, revision);
    const latest = currentItem();
    if (latest) replaceItem({ ...latest, updatedAt: savedItem.updatedAt });
    if (revision === editRevision) setSaveState('saved', 'Saved');
    else setSaveState('unsaved', 'Unsaved');
    return true;
  } catch (error) {
    setSaveState('failed', `Save failed: ${error.message || 'Please retry.'}`);
    showToast('Your text is still here. Retry the save before leaving this item.', { error: true });
    throw error;
  } finally {
    writeInFlight = null;
  }
}

async function flushSave() {
  if (!activeItemId) return true;
  window.clearTimeout(saveTimer);
  saveTimer = null;
  try {
    while (savedRevision < editRevision) await persistLatest();
    return true;
  } catch {
    return false;
  }
}

async function openEditor(id) {
  if (!(await flushSave())) return;
  editorReturnView = view === 'batch-detail' ? 'batch-detail' : view === 'plan' ? 'plan' : 'content';
  activeItemId = id;
  resetEditorState();
  setPage('editor');
  const title = screen.querySelector('#editor-title');
  title?.focus({ preventScroll: true });
}

async function openBatch(id) {
  if (!(await flushSave())) return;
  activeBatchId = id;
  activeItemId = null;
  setPage(currentBatch() ? 'batch-detail' : 'batches');
}

async function returnFromEditor() {
  if (!(await flushSave())) return;
  activeItemId = null;
  const returnToBatch = editorReturnView === 'batch-detail' && currentBatch();
  const returnToPlan = !returnToBatch && editorReturnView === 'plan';
  setPage(returnToBatch ? 'batch-detail' : returnToPlan ? 'plan' : 'content');
  screen.querySelector(returnToBatch ? '#batch-content-title' : '#page-title')?.focus({ preventScroll: true });
}

async function navigate(nextView) {
  if (!['home', 'content', 'batches', 'plan'].includes(nextView)) return;
  if (!(await flushSave())) return;
  activeItemId = null;
  activeBatchId = null;
  setPage(nextView);
  document.querySelector('#main-content').focus({ preventScroll: true });
}

function activeContentResults() {
  return searchAndFilterContentItems(contentItems, contentQuery, contentFilters);
}

function refreshContentResults() {
  const results = screen.querySelector('#content-results');
  if (!results) return;
  const filteredItems = activeContentResults();
  const active = Object.values(contentFilters).filter(Boolean).length;
  results.setAttribute('aria-label', `${filteredItems.length} content ${filteredItems.length === 1 ? 'item' : 'items'}`);
  results.replaceChildren(renderContentResults(filteredItems, { isFiltered: Boolean(contentQuery.trim()) || active > 0, total: contentItems.length }));
  const state = screen.querySelector('#active-filter-status');
  if (state) state.textContent = active ? `${active} ${active === 1 ? 'filter' : 'filters'} active${contentQuery.trim() ? ' · search active' : ''}` : contentQuery.trim() ? 'Search active' : 'No active search or filters';
  const clear = screen.querySelector('[data-action="clear-content-filters"]');
  if (clear) clear.hidden = active === 0 && !contentQuery.trim();
  const summary = screen.querySelector('.filters-disclosure summary');
  if (summary) summary.textContent = active ? `Filters · ${active} active` : 'Filters';
  for (const row of results.querySelectorAll('[data-open-id]')) row.addEventListener('click', () => openEditor(row.dataset.openId));
}

async function openTemplates() {
  if (!(await flushSave())) return;
  templateReturnView = view === 'batch-detail' ? 'batch-detail' : 'content';
  templateReturnBatchId = templateReturnView === 'batch-detail' ? activeBatchId : null;
  templates = await getAllTemplates();
  activeItemId = null;
  setPage('templates');
  screen.querySelector('[data-action="new-template"]')?.focus({ preventScroll: true });
}

function syncTemplateCustomFields() {
  const type = templateForm.elements.contentType.value;
  const channel = templateForm.elements.channel.value;
  templateForm.querySelector('[data-template-custom="customContentType"]').hidden = type !== 'other';
  templateForm.querySelector('[data-template-custom="customChannel"]').hidden = channel !== 'other';
}

function showTemplateDialog(template = null) {
  templateDialogMode = template ? 'edit' : 'create';
  editingTemplateId = template?.id ?? null;
  templateForm.reset();
  templateDialog.querySelector('#template-dialog-title').textContent = template ? 'Edit Template' : 'New Template';
  templateDialog.querySelector('#template-form-submit').textContent = template ? 'Save Template' : 'Create Template';
  for (const field of ['name', 'contentType', 'channel', 'customContentType', 'customChannel', 'hook', 'body', 'cta', 'notes']) {
    if (templateForm.elements[field]) templateForm.elements[field].value = template?.[field] ?? '';
  }
  templateForm.elements.tags.value = template?.tags.join(', ') ?? '';
  templateForm.querySelector('#template-form-error').hidden = true;
  templateForm.querySelector('#template-form-error').textContent = '';
  syncTemplateCustomFields();
  templateDialog.showModal();
  templateForm.elements.name.focus();
}

function showApplyTemplateDialog(templateId) {
  const template = templates.find(record => record.id === templateId);
  if (!template) return;
  applyTemplateId = templateId;
  applyTemplateForm.reset();
  applyTemplateForm.querySelector('#apply-template-error').hidden = true;
  const batchId = templateReturnView === 'batch-detail' ? templateReturnBatchId : null;
  const batch = batches.find(record => record.id === batchId);
  applyTemplateForm.querySelector('#apply-template-context').textContent = batch ? `This independent idea will be added to ${batch.name}.` : 'This creates a new independent idea. The Template stays unchanged.';
  applyTemplateDialog.showModal();
  applyTemplateForm.elements.title.focus();
}

async function changePlannedDate(itemId, date) {
  const item = contentItems.find(record => record.id === itemId);
  if (!item) return;
  try {
    const saved = await saveContentItem({ ...item, scheduledDate: date || null });
    replaceItem(saved);
    if (date) {
      const parts = parseDateOnly(date);
      if (parts) { planYear = Number(parts[0]); planMonth = Number(parts[1]); selectedPlanDate = date; }
    }
    setPage('plan');
    showToast(date ? 'Intended date updated.' : 'Date removed. This item is in Unscheduled.');
  } catch (error) {
    showToast(`Could not update the intended date: ${error.message}`, { error: true });
    setPage('plan');
  }
}

function showBatchDialog(batch = null) {
  batchDialogMode = batch ? 'edit' : 'create';
  batchNameInput.value = batch?.name ?? '';
  batchDescriptionInput.value = batch?.description ?? '';
  batchDialog.querySelector('#batch-dialog-title').textContent = batch ? 'Edit Batch' : 'New Batch';
  batchDialog.querySelector('#batch-form-submit').textContent = batch ? 'Save changes' : 'Create Batch';
  const error = batchForm.querySelector('#batch-form-error');
  error.hidden = true;
  error.textContent = '';
  batchDialog.showModal();
  batchNameInput.focus();
}

function showExistingContentDialog() {
  const batch = currentBatch();
  if (!batch) return;
  const choices = addContentDialog.querySelector('#existing-content-choices');
  choices.replaceChildren(renderExistingContentChoices(contentItems, batches, batch.id));
  for (const action of choices.querySelectorAll('[data-assign-to-batch]')) {
    action.addEventListener('click', async () => {
      const item = contentItems.find(record => record.id === action.dataset.assignToBatch);
      const target = currentBatch();
      if (!item || !target) return;
      if (item.batchId) {
        const oldBatch = batches.find(record => record.id === item.batchId);
        const oldName = oldBatch?.name ?? 'another Batch';
        const confirmed = window.confirm(`Move “${item.title}” from ${oldName} to ${target.name}? It will belong only to ${target.name}.`);
        if (!confirmed) return;
      }
      try {
        const savedItem = await assignContentItemToBatch(item.id, target.id);
        replaceItem(savedItem);
        addContentDialog.close();
        setPage('batch-detail');
        showToast(item.batchId ? 'Content moved to this Batch.' : 'Content added to this Batch.');
        screen.querySelector('[data-action="add-existing-content"]')?.focus({ preventScroll: true });
      } catch (error) {
        showToast(`Could not add this content: ${error.message}`, { error: true });
      }
    });
  }
  addContentDialog.showModal();
  addContentDialog.querySelector('[data-action="close-existing-content"]')?.focus();
}

function bindScreenActions() {
  for (const action of screen.querySelectorAll('[data-copy-content]')) action.addEventListener('click', async () => {
    const item = currentItem();
    try {
      if (!navigator.clipboard?.writeText) throw Error('Clipboard is unavailable in this browser.');
      await navigator.clipboard.writeText(action.dataset.copyContent === 'body' ? item.body : contentPackage(item));
      showToast('Content copied.');
    } catch (error) { showToast(`Copy failed: ${error.message}`, { error: true }); }
  });
  const captureForm = screen.querySelector('#quick-capture-form');
  captureForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = captureForm.elements.title;
    const title = input.value.trim();
    if (!title) {
      input.focus();
      return;
    }
    try {
      const item = await addContentItem(title);
      contentItems.unshift(item);
      setPage('home');
      showToast('Idea captured. Add more detail whenever you’re ready.');
      screen.querySelector('#quick-capture-title')?.focus({ preventScroll: true });
    } catch (error) {
      showToast(`Could not save this idea: ${error.message}`, { error: true });
    }
  });

  for (const row of screen.querySelectorAll('[data-open-id]')) {
    row.addEventListener('click', () => openEditor(row.dataset.openId));
  }
  for (const row of screen.querySelectorAll('[data-plan-open-id]')) {
    row.addEventListener('click', () => openEditor(row.dataset.planOpenId));
  }
  for (const action of screen.querySelectorAll('[data-open-batch-id]')) {
    action.addEventListener('click', () => openBatch(action.dataset.openBatchId));
  }
  for (const action of screen.querySelectorAll('[data-action="view-content"]')) {
    action.addEventListener('click', () => navigate('content'));
  }
  for (const action of screen.querySelectorAll('[data-action="new-content"]')) {
    action.addEventListener('click', () => {
      creationBatchId = view === 'batch-detail' ? activeBatchId : null;
      dialog.querySelector('#new-content-title').textContent = creationBatchId ? `New content in ${currentBatch()?.name ?? 'Batch'}` : 'New content';
      dialog.showModal();
      dialogInput.focus();
    });
  }
  screen.querySelector('[data-action="new-batch"]')?.addEventListener('click', () => showBatchDialog());
  screen.querySelector('[data-action="open-templates"]')?.addEventListener('click', openTemplates);
  screen.querySelector('[data-action="back-from-templates"]')?.addEventListener('click', () => {
    if (templateReturnView === 'batch-detail' && batches.some(batch => batch.id === templateReturnBatchId)) {
      activeBatchId = templateReturnBatchId;
      setPage('batch-detail');
    } else {
      activeBatchId = null;
      setPage('content');
    }
  });
  screen.querySelector('[data-action="new-template"]')?.addEventListener('click', () => showTemplateDialog());
  for (const action of screen.querySelectorAll('[data-edit-template]')) {
    action.addEventListener('click', () => showTemplateDialog(templates.find(template => template.id === action.dataset.editTemplate)));
  }
  for (const action of screen.querySelectorAll('[data-apply-template]')) {
    action.addEventListener('click', () => showApplyTemplateDialog(action.dataset.applyTemplate));
  }
  for (const action of screen.querySelectorAll('[data-delete-template]')) {
    action.addEventListener('click', async () => {
      const template = templates.find(record => record.id === action.dataset.deleteTemplate);
      if (!template || !window.confirm(`Delete Template “${template.name}”? Existing content created from it will remain unchanged.`)) return;
      try {
        await deleteTemplate(template.id);
        templates = await getAllTemplates();
        setPage('templates');
        showToast('Template deleted. Existing content remains unchanged.');
      } catch (error) {
        showToast(`Could not delete this Template: ${error.message}`, { error: true });
      }
    });
  }
  screen.querySelector('#content-search')?.addEventListener('input', event => {
    contentQuery = event.target.value;
    refreshContentResults();
  });
  for (const select of screen.querySelectorAll('[data-content-filter]')) {
    select.addEventListener('change', () => {
      contentFilters[select.dataset.contentFilter] = select.value;
      const focusId = select.id;
      setPage('content');
      screen.querySelector(`#${focusId}`)?.focus({ preventScroll: true });
    });
  }
  screen.querySelector('[data-action="clear-content-filters"]')?.addEventListener('click', () => {
    contentQuery = '';
    contentFilters = { status: '', contentType: '', channel: '', batchId: '', tag: '' };
    setPage('content');
    screen.querySelector('#content-search')?.focus({ preventScroll: true });
  });
  for (const action of screen.querySelectorAll('[data-month-delta]')) {
    action.addEventListener('click', () => {
      ({ year: planYear, month: planMonth } = monthAfter(planYear, planMonth, Number(action.dataset.monthDelta)));
      selectedPlanDate = formatDateOnly(planYear, planMonth, 1);
      setPage('plan');
    });
  }
  for (const action of screen.querySelectorAll('[data-select-date]')) {
    action.addEventListener('click', () => {
      selectedPlanDate = action.dataset.selectDate;
      setPage('plan');
    });
  }
  screen.querySelector('[data-action="plan-today"]')?.addEventListener('click', () => {
    selectedPlanDate = localDateKey();
    const today = parseDateOnly(selectedPlanDate);
    planYear = Number(today[0]);
    planMonth = Number(today[1]);
    setPage('plan');
  });
  for (const input of screen.querySelectorAll('[data-plan-date]')) {
    input.addEventListener('change', () => changePlannedDate(input.dataset.planDate, input.value));
  }
  for (const action of screen.querySelectorAll('[data-clear-plan-date]')) {
    action.addEventListener('click', () => changePlannedDate(action.dataset.clearPlanDate, null));
  }
  screen.querySelector('[data-action="back-to-batches"]')?.addEventListener('click', () => navigate('batches'));
  screen.querySelector('[data-action="back-to-return"]')?.addEventListener('click', returnFromEditor);
  screen.querySelector('[data-action="edit-batch"]')?.addEventListener('click', () => showBatchDialog(currentBatch()));
  screen.querySelector('[data-action="add-existing-content"]')?.addEventListener('click', showExistingContentDialog);
  screen.querySelector('[data-action="duplicate-item"]')?.addEventListener('click', duplicateActiveItem);
  screen.querySelector('[data-action="delete-item"]')?.addEventListener('click', deleteActiveItem);
  screen.querySelector('[data-action="delete-batch"]')?.addEventListener('click', deleteActiveBatch);
  for (const action of screen.querySelectorAll('[data-remove-batch-item]')) {
    action.addEventListener('click', async () => {
      try {
        const item = await removeContentItemFromBatch(action.dataset.removeBatchItem);
        replaceItem(item);
        setPage('batch-detail');
        showToast('Content removed from this Batch. The content remains in your library.');
        screen.querySelector('[data-action="add-existing-content"]')?.focus({ preventScroll: true });
      } catch (error) {
        showToast(`Could not remove content from this Batch: ${error.message}`, { error: true });
      }
    });
  }
  for (const select of screen.querySelectorAll('[data-batch-status]')) {
    select.addEventListener('change', async () => {
      const item = contentItems.find(record => record.id === select.dataset.batchStatus);
      if (!item || item.status === select.value) return;
      const updated = transitionStatus(item, select.value, new Date().toISOString());
      try {
        const saved = await saveContentItem(updated);
        replaceItem(saved);
        setPage('batch-detail');
        showToast(`Status changed to ${select.options[select.selectedIndex].text}.`);
        screen.querySelector(`[data-batch-status="${item.id}"]`)?.focus({ preventScroll: true });
      } catch (error) {
        select.value = item.status;
        showToast(`Could not update status: ${error.message}`, { error: true });
      }
    });
  }
  screen.querySelector('[data-action="retry-save"]')?.addEventListener('click', async () => {
    setSaveState('saving', 'Saving…');
    if (await flushSave()) showToast('Your content is saved.');
  });
}

function bindEditor() {
  const form = screen.querySelector('.editor-layout');
  form.addEventListener('input', event => {
    if (event.target.matches('input[data-field], textarea[data-field]')) changeField(event.target.dataset.field, event.target.value);
  });
  form.addEventListener('change', event => {
    if (event.target.matches('select[data-field]')) changeField(event.target.dataset.field, event.target.value);
  });
  form.addEventListener('focusout', event => {
    if (!form.contains(event.relatedTarget)) flushSave();
  });
}

function changeField(field, value) {
  const item = currentItem();
  if (!item) return;
  let updated;
  if (field === 'status') {
    updated = transitionStatus(item, value, new Date().toISOString());
    updateStatusSummary(updated);
  } else if (field === 'contentType') {
    updated = { ...item, contentType: value || null, customContentType: value === 'other' ? item.customContentType : null };
    const custom = screen.querySelector('[data-custom-field="customContentType"]');
    if (custom) custom.hidden = value !== 'other';
    if (value === 'other') screen.querySelector('[data-field="customContentType"]')?.focus();
  } else if (field === 'channel') {
    updated = { ...item, channel: value || null, customChannel: value === 'other' ? item.customChannel : null };
    const custom = screen.querySelector('[data-custom-field="customChannel"]');
    if (custom) custom.hidden = value !== 'other';
    if (value === 'other') screen.querySelector('[data-field="customChannel"]')?.focus();
  } else if (field === 'batchId') {
    updated = { ...item, batchId: value || null };
  } else if (field === 'tags') {
    updated = { ...item, tags: parseTagInput(value) };
  } else if (field === 'scheduledDate') {
    updated = { ...item, scheduledDate: value || null };
  } else {
    updated = { ...item, [field]: value };
  }
  replaceItem(updated);
  const title = screen.querySelector('#editor-title');
  if (title && field === 'title') {
    const heading = screen.querySelector('.editor-heading h2');
    if (heading) heading.textContent = value || 'New content';
  }
  editRevision += 1;
  scheduleSave();
}

async function deleteActiveBatch() {
  const batch = currentBatch();
  if (!batch) return;
  const count = contentItems.filter(item => item.batchId === batch.id).length;
  const confirmed = window.confirm(`Delete “${batch.name}”? ${count} ${count === 1 ? 'content item stays' : 'content items stay'} in Content and will become unassigned.`);
  if (!confirmed) return;
  try {
    await removeBatch(batch.id);
    await refreshData();
    activeBatchId = null;
    setPage('batches');
    showToast('Batch deleted. Its content remains in your library.');
    screen.querySelector('[data-action="new-batch"]')?.focus({ preventScroll: true });
  } catch (error) {
    showToast(`Could not delete this Batch: ${error.message}`, { error: true });
  }
}

async function duplicateActiveItem() {
  if (!(await flushSave())) return;
  const item = currentItem();
  if (!item) return;
  try {
    const duplicate = duplicateContentItem(item);
    const savedDuplicate = await saveContentItem(duplicate);
    contentItems.unshift(savedDuplicate);
    activeItemId = savedDuplicate.id;
    resetEditorState();
    setPage('editor');
    screen.querySelector('#editor-title')?.focus({ preventScroll: true });
    showToast('Independent copy created as a new idea.');
  } catch (error) {
    showToast(`Could not duplicate this content: ${error.message}`, { error: true });
  }
}

async function deleteActiveItem() {
  if (!(await flushSave())) return;
  const item = currentItem();
  if (!item) return;
  const confirmed = window.confirm(`Delete “${item.title}”? This permanently removes the content from this browser.`);
  if (!confirmed) return;
  try {
    await deleteContentItem(item.id);
    contentItems = contentItems.filter(record => record.id !== item.id);
    activeItemId = null;
    resetEditorState();
    const returnToBatch = editorReturnView === 'batch-detail' && currentBatch();
    const returnToPlan = editorReturnView === 'plan' && !returnToBatch;
    setPage(returnToBatch ? 'batch-detail' : returnToPlan ? 'plan' : 'content');
    showToast('Content deleted.');
    if (returnToBatch) screen.querySelector('#batch-content-title')?.focus({ preventScroll: true });
    else document.querySelector('#main-content').focus({ preventScroll: true });
  } catch (error) {
    showToast(`Could not delete this content: ${error.message}`, { error: true });
  }
}

dialogForm.addEventListener('submit', async event => {
  event.preventDefault();
  const title = dialogInput.value.trim();
  if (!title) {
    dialogInput.focus();
    return;
  }
  try {
    const item = creationBatchId
      ? await createContentItemInBatch(title, creationBatchId)
      : await addContentItem(title);
    contentItems.unshift(item);
    dialog.close();
    dialogForm.reset();
    activeItemId = item.id;
    editorReturnView = creationBatchId ? 'batch-detail' : 'content';
    creationBatchId = null;
    resetEditorState();
    setPage('editor');
    screen.querySelector('#editor-title')?.focus({ preventScroll: true });
    showToast(item.batchId ? 'Idea created in this Batch. Keep shaping it here.' : 'Idea created. Keep shaping it here.');
  } catch (error) {
    showToast(`Could not create this idea: ${error.message}`, { error: true });
  }
});

dialog.querySelector('[data-action="cancel-new-content"]').addEventListener('click', () => {
  dialog.close();
  creationBatchId = null;
  dialog.querySelector('#new-content-title').textContent = 'New content';
});

batchForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = batchNameInput.value.trim();
  const description = batchDescriptionInput.value.trim();
  const error = batchForm.querySelector('#batch-form-error');
  if (!name) {
    error.textContent = 'Enter a name for this Batch.';
    error.hidden = false;
    batchNameInput.focus();
    return;
  }
  try {
    if (batchDialogMode === 'edit') {
      await updateBatch(activeBatchId, { name, description });
      batches = await getAllBatches();
      setPage('batch-detail');
      showToast('Batch details updated.');
    } else {
      const batch = await createBatch(name, description);
      batches = await getAllBatches();
      activeBatchId = batch.id;
      setPage('batch-detail');
      showToast('Batch created. Add ideas or create content for this session.');
    }
    batchDialog.close();
    batchForm.reset();
    screen.querySelector('#batch-workspace-title')?.focus({ preventScroll: true });
  } catch (saveError) {
    error.textContent = saveError.message || 'Could not save this Batch. Try again.';
    error.hidden = false;
    batchNameInput.focus();
  }
});

batchDialog.querySelector('[data-action="cancel-batch"]').addEventListener('click', () => batchDialog.close());
addContentDialog.querySelector('[data-action="close-existing-content"]').addEventListener('click', () => addContentDialog.close());
templateForm.elements.contentType.addEventListener('change', syncTemplateCustomFields);
templateForm.elements.channel.addEventListener('change', syncTemplateCustomFields);
templateForm.querySelector('[data-action="cancel-template"]').addEventListener('click', () => templateDialog.close());
templateDialog.addEventListener('close', () => { editingTemplateId = null; });

templateForm.addEventListener('submit', async event => {
  event.preventDefault();
  const error = templateForm.querySelector('#template-form-error');
  const formData = new FormData(templateForm);
  const input = Object.fromEntries(formData.entries());
  input.tags = parseTagInput(input.tags);
  if (!String(input.name ?? '').trim()) {
    error.textContent = 'Enter a name for this Template.';
    error.hidden = false;
    templateForm.elements.name.focus();
    return;
  }
  try {
    if (templateDialogMode === 'edit' && editingTemplateId) await updateTemplate(editingTemplateId, input);
    else await createTemplate(input);
    templates = await getAllTemplates();
    templateDialog.close();
    setPage('templates');
    showToast(templateDialogMode === 'edit' ? 'Template updated.' : 'Template created.');
  } catch (saveError) {
    error.textContent = saveError.message || 'Could not save this Template.';
    error.hidden = false;
  }
});

applyTemplateForm.querySelector('[data-action="cancel-apply-template"]').addEventListener('click', () => applyTemplateDialog.close());
applyTemplateForm.addEventListener('submit', async event => {
  event.preventDefault();
  const title = applyTemplateForm.elements.title.value.trim();
  const error = applyTemplateForm.querySelector('#apply-template-error');
  const template = templates.find(record => record.id === applyTemplateId);
  if (!title) {
    error.textContent = 'Enter a title for the new content.';
    error.hidden = false;
    applyTemplateForm.elements.title.focus();
    return;
  }
  if (!template) {
    error.textContent = 'This Template is no longer available.';
    error.hidden = false;
    return;
  }
  try {
    const batchId = templateReturnView === 'batch-detail' && batches.some(batch => batch.id === templateReturnBatchId) ? templateReturnBatchId : null;
    const item = applyTemplateToContentItem(template, title, { batchId });
    const saved = await saveContentItem(item);
    contentItems.unshift(saved);
    activeBatchId = batchId;
    activeItemId = saved.id;
    editorReturnView = batchId ? 'batch-detail' : 'content';
    resetEditorState();
    applyTemplateDialog.close();
    setPage('editor');
    screen.querySelector('#editor-title')?.focus({ preventScroll: true });
    showToast(batchId ? 'Independent idea created from Template in this Batch.' : 'Independent idea created from Template.');
  } catch (applyError) {
    error.textContent = applyError.message || 'Could not create content from this Template.';
    error.hidden = false;
  }
});
document.querySelector('#data-tools-button').addEventListener('click', () => openDataTools({ flush: flushSave, reload: async () => { await refreshData(); activeItemId = null; resetEditorState(); setPage('home'); }, notify: showToast }));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => showToast('Offline setup failed. Reload online to retry.', { error: true }));
bindNavigation(navigate);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});
window.addEventListener('pagehide', () => { flushSave(); });

async function start() {
  try {
    await refreshData();
    setPage('home');
  } catch (error) {
    updateNavigation('home');
    const notice = element('div', { className: 'storage-error', attrs: { role: 'alert' } });
    notice.append(element('p', { className: 'eyebrow', text: 'LOCAL STORAGE UNAVAILABLE' }));
    notice.append(element('h2', { text: 'ContentBatch couldn’t open this browser’s storage.' }));
    notice.append(element('p', { text: error.message || 'Try opening this app in a browser with IndexedDB enabled.' }));
    screen.replaceChildren(notice);
  }
}

start();
