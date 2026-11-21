import { CHANNELS, CONTENT_STATUSES, CONTENT_TYPES } from '../domain/content.js';
import { button, element, statusBadge } from './dom.js';

const STATUS_LABELS = { idea: 'Idea', draft: 'Draft', ready: 'Ready', completed: 'Completed' };
const TYPE_LABELS = {
  'social-post': 'Social post',
  'short-video': 'Short video',
  'long-video': 'Long video',
  article: 'Article/Blog',
  email: 'Email',
  other: 'Other'
};
const CHANNEL_LABELS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X',
  email: 'Email',
  blog: 'Blog/Web',
  other: 'Other'
};

function fieldLabel(label, id, detail = '') {
  const row = element('div', { className: 'field-label-row' });
  row.append(element('label', { className: 'field-label', text: label, attrs: { for: id } }));
  if (detail) row.append(element('span', { className: 'field-detail', text: detail }));
  return row;
}

function makeOptions(select, choices, labels, selected) {
  for (const value of choices) {
    const option = element('option', { text: labels[value] ?? value, attrs: { value } });
    if (value === selected) option.selected = true;
    select.append(option);
  }
}

function selectField({ id, label, field, choices, labels, value, placeholder }) {
  const wrapper = element('div', { className: 'form-field' });
  wrapper.append(fieldLabel(label, id));
  const select = element('select', { className: 'text-input select-input', attrs: { id, name: field, 'data-field': field } });
  const blank = element('option', { text: placeholder, attrs: { value: '' } });
  if (value === null) blank.selected = true;
  select.append(blank);
  makeOptions(select, choices, labels, value);
  wrapper.append(select);
  return wrapper;
}

function textField({ id, label, field, value, placeholder = '', multiline = false, hint = '', rows = 5 }) {
  const wrapper = element('div', { className: `form-field${multiline ? ' form-field-wide' : ''}` });
  wrapper.append(fieldLabel(label, id, hint));
  const control = element(multiline ? 'textarea' : 'input', {
    className: multiline ? 'text-input text-area' : 'text-input',
    text: multiline ? value : '',
    attrs: { id, name: field, ...(multiline ? { rows } : { type: 'text' }), maxlength: multiline ? '20000' : '240', placeholder, 'data-field': field }
  });
  if (!multiline) control.value = value;
  wrapper.append(control);
  return wrapper;
}

function customField({ id, label, field, value, visible }) {
  const wrapper = element('div', { className: 'form-field custom-field', attrs: { 'data-custom-field': field, hidden: !visible } });
  wrapper.append(fieldLabel(label, id));
  const input = element('input', {
    className: 'text-input',
    attrs: { id, type: 'text', maxlength: '80', placeholder: `Name your ${field === 'customContentType' ? 'content type' : 'channel'}`, 'data-field': field }
  });
  input.value = value ?? '';
  wrapper.append(input);
  return wrapper;
}

export function renderEditor(item, batches = [], backLabel = 'Back to content') {
  const page = element('div', { className: 'editor-layout', attrs: { 'data-editor-id': item.id } });
  const toolbar = element('div', { className: 'editor-toolbar' });
  toolbar.append(button(backLabel, { className: 'back-button', action: 'back-to-return', iconNode: element('span', { text: '←', attrs: { 'aria-hidden': 'true' } }) }));
  const toolbarActions = element('div', { className: 'editor-actions' });
  toolbarActions.append(button('Copy Body', { className: 'button button-secondary button-small', attrs: { 'data-copy-content': 'body' } }));
  toolbarActions.append(button('Copy Content Package', { className: 'button button-secondary button-small', attrs: { 'data-copy-content': 'package' } }));
  toolbarActions.append(button('Duplicate', { className: 'button button-secondary button-small', action: 'duplicate-item' }));
  toolbarActions.append(button('Delete', { className: 'button button-quiet-danger button-small', action: 'delete-item' }));
  toolbar.append(toolbarActions);
  page.append(toolbar);

  const editorHeading = element('div', { className: 'editor-heading' });
  const headingCopy = element('div');
  headingCopy.append(element('p', { className: 'eyebrow', text: 'CONTENT EDITOR' }));
  headingCopy.append(element('h2', { text: item.title || 'New content' }));
  headingCopy.append(element('p', { className: 'editor-heading-note', text: 'Shape the idea at your own pace. Changes save automatically.' }));
  editorHeading.append(headingCopy);
  const saveBlock = element('div', { className: 'save-block' });
  saveBlock.append(element('span', { className: 'save-indicator-dot', attrs: { 'aria-hidden': 'true' } }));
  saveBlock.append(element('span', { className: 'save-status', text: 'Saved', attrs: { id: 'save-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' } }));
  const retry = button('Retry', { className: 'retry-save-button', action: 'retry-save' });
  retry.hidden = true;
  saveBlock.append(retry);
  editorHeading.append(saveBlock);
  page.append(editorHeading);

  const editorGrid = element('div', { className: 'editor-grid' });
  const form = element('form', { className: 'editor-form', attrs: { id: 'editor-form', novalidate: true, autocomplete: 'off' } });
  const draftCard = element('section', { className: 'editor-card', attrs: { 'aria-labelledby': 'draft-section-title' } });
  const draftTop = element('div', { className: 'editor-card-heading' });
  draftTop.append(element('div', { className: 'editor-section-number', text: '01' }));
  const draftTitle = element('div');
  draftTitle.append(element('h3', { text: 'The draft', attrs: { id: 'draft-section-title' } }));
  draftTitle.append(element('p', { text: 'Give your idea a little more shape.' }));
  draftTop.append(draftTitle);
  draftCard.append(draftTop);

  const titleField = element('div', { className: 'form-field title-field' });
  titleField.append(fieldLabel('Internal title', 'editor-title', 'required'));
  const titleInput = element('input', { className: 'text-input title-input', attrs: { id: 'editor-title', name: 'title', type: 'text', maxlength: '240', required: true, 'data-field': 'title' } });
  titleInput.value = item.title;
  titleField.append(titleInput);
  draftCard.append(titleField);

  const hookField = textField({ id: 'editor-hook', label: 'Hook / headline', field: 'hook', value: item.hook, placeholder: 'The first line that earns someone’s attention', hint: 'Optional' });
  draftCard.append(hookField);
  draftCard.append(textField({ id: 'editor-body', label: 'Content', field: 'body', value: item.body, placeholder: 'Start writing here…', multiline: true, rows: 9, hint: 'Plain text' }));
  draftCard.append(textField({ id: 'editor-cta', label: 'Call to action', field: 'cta', value: item.cta, placeholder: 'What should someone do next?', hint: 'Optional' }));
  draftCard.append(textField({ id: 'editor-notes', label: 'Notes', field: 'notes', value: item.notes, placeholder: 'Anything else you want to remember…', multiline: true, rows: 4, hint: 'Private to you' }));
  const tagsField = element('div', { className: 'form-field form-field-wide' });
  tagsField.append(fieldLabel('Tags', 'editor-tags', 'Comma-separated · optional'));
  const tagsInput = element('input', { className: 'text-input', attrs: { id: 'editor-tags', name: 'tags', type: 'text', maxlength: '500', placeholder: 'Education, product, behind the scenes', 'data-field': 'tags' } });
  tagsInput.value = item.tags.join(', ');
  tagsField.append(tagsInput);
  draftCard.append(tagsField);
  form.append(draftCard);

  const side = element('aside', { className: 'editor-sidebar', attrs: { 'aria-label': 'Content details' } });
  const detailsCard = element('section', { className: 'editor-card details-card', attrs: { 'aria-labelledby': 'details-section-title' } });
  const detailsTop = element('div', { className: 'editor-card-heading compact-editor-heading' });
  detailsTop.append(element('div', { className: 'editor-section-number', text: '02' }));
  const detailsTitle = element('div');
  detailsTitle.append(element('h3', { text: 'Details', attrs: { id: 'details-section-title' } }));
  detailsTitle.append(element('p', { text: 'A few useful labels.' }));
  detailsTop.append(detailsTitle);
  detailsCard.append(detailsTop);
  detailsCard.append(selectField({ id: 'editor-status', label: 'Status', field: 'status', choices: CONTENT_STATUSES, labels: STATUS_LABELS, value: item.status, placeholder: 'Choose a status' }));
  detailsCard.append(selectField({ id: 'editor-type', label: 'Content type', field: 'contentType', choices: CONTENT_TYPES, labels: TYPE_LABELS, value: item.contentType, placeholder: 'Not set' }));
  detailsCard.append(customField({ id: 'editor-custom-type', label: 'Your content type', field: 'customContentType', value: item.customContentType, visible: item.contentType === 'other' }));
  detailsCard.append(selectField({ id: 'editor-channel', label: 'Intended channel', field: 'channel', choices: CHANNELS, labels: CHANNEL_LABELS, value: item.channel, placeholder: 'Not set' }));
  detailsCard.append(customField({ id: 'editor-custom-channel', label: 'Your channel', field: 'customChannel', value: item.customChannel, visible: item.channel === 'other' }));
  const intendedDate = element('div', { className: 'form-field' });
  intendedDate.append(fieldLabel('Intended Date', 'editor-scheduled-date', 'Optional · local date'));
  intendedDate.append(element('input', { className: 'text-input', attrs: { id: 'editor-scheduled-date', name: 'scheduledDate', type: 'date', value: item.scheduledDate ?? '', 'data-field': 'scheduledDate' } }));
  detailsCard.append(intendedDate);
  const batchField = element('div', { className: 'form-field' });
  batchField.append(fieldLabel('Batch', 'editor-batch'));
  const batchSelect = element('select', { className: 'text-input select-input', attrs: { id: 'editor-batch', name: 'batchId', 'data-field': 'batchId' } });
  const noBatch = element('option', { text: 'None', attrs: { value: '' } });
  noBatch.selected = !item.batchId;
  batchSelect.append(noBatch);
  for (const batch of batches) {
    const option = element('option', { text: batch.name, attrs: { value: batch.id } });
    option.selected = batch.id === item.batchId;
    batchSelect.append(option);
  }
  batchField.append(batchSelect);
  detailsCard.append(batchField);
  detailsCard.append(element('div', { className: 'editor-rule' }));
  const currentStatus = element('div', { className: 'current-status-line' });
  currentStatus.append(element('span', { className: 'detail-caption', text: 'CURRENT STATUS' }));
  currentStatus.append(statusBadge(item.status));
  currentStatus.dataset.statusSummary = item.status;
  detailsCard.append(currentStatus);
  side.append(detailsCard);

  const localCard = element('div', { className: 'editor-local-note' });
  localCard.append(element('span', { className: 'local-note-dot', attrs: { 'aria-hidden': 'true' } }));
  const localText = element('p');
  localText.append(element('strong', { text: 'Only in this browser.' }));
  localText.append(element('span', { text: ' Your content is saved on this device.' }));
  localCard.append(localText);
  side.append(localCard);

  editorGrid.append(form, side);
  page.append(editorGrid);
  return page;
}
