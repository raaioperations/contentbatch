import { calculateBatchProgress } from '../domain/batches.js';
import { button, element, formatUpdatedDate, statusBadge } from './dom.js';

const STATUS_LABELS = { idea: 'Idea', draft: 'Draft', ready: 'Ready', completed: 'Completed' };
const TYPE_LABELS = {
  'social-post': 'Social post', 'short-video': 'Short video', 'long-video': 'Long video',
  article: 'Article/Blog', email: 'Email', other: 'Other'
};
const CHANNEL_LABELS = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube',
  linkedin: 'LinkedIn', x: 'X', email: 'Email', blog: 'Blog/Web', other: 'Other'
};

function progressDisplay(progress, className = 'batch-progress') {
  const wrap = element('div', { className });
  const summary = element('div', { className: 'batch-progress-copy' });
  summary.append(element('span', { className: 'batch-progress-count', text: `${progress.readyOrCompletedCount} of ${progress.total} Ready or Completed` }));
  summary.append(element('strong', { className: 'batch-progress-percent', text: `${progress.readyOrCompletedPercent}% ready` }));
  const track = element('div', {
    className: 'batch-progress-track',
    attrs: {
      role: 'progressbar',
      'aria-label': 'Ready or completed content',
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': progress.readyOrCompletedPercent
    }
  });
  track.append(element('span', { className: 'batch-progress-fill', attrs: { style: `width: ${progress.readyOrCompletedPercent}%` } }));
  wrap.append(summary, track);
  return wrap;
}

function batchCounts(progress, className = 'batch-counts') {
  const list = element('ul', { className, attrs: { 'aria-label': 'Content by status' } });
  for (const status of ['idea', 'draft', 'ready', 'completed']) {
    list.append(element('li', { text: `${progress[`${status}Count`]} ${STATUS_LABELS[status]}` }));
  }
  return list;
}

function batchCard(batch, items) {
  const batchItems = items.filter(item => item.batchId === batch.id);
  const progress = calculateBatchProgress(batchItems);
  const card = element('article', { className: 'batch-card', attrs: { 'data-batch-card-id': batch.id } });
  const heading = element('div', { className: 'batch-card-heading' });
  const copy = element('div', { className: 'batch-card-copy' });
  copy.append(element('h3', { text: batch.name }));
  if (batch.description) copy.append(element('p', { className: 'batch-description', text: batch.description }));
  heading.append(copy, element('span', { className: 'batch-card-total', text: `${progress.total} ${progress.total === 1 ? 'item' : 'items'}` }));
  card.append(heading);
  card.append(progressDisplay(progress));
  card.append(batchCounts(progress, 'batch-counts batch-counts-compact'));
  const footer = element('div', { className: 'batch-card-footer' });
  footer.append(element('span', { className: 'batch-updated', text: `Updated ${formatUpdatedDate(batch.updatedAt)}` }));
  footer.append(button('Open Batch', { className: 'button button-secondary button-small', attrs: { 'data-open-batch-id': batch.id } }));
  card.append(footer);
  return card;
}

export function renderBatchesView(batches, contentItems) {
  const page = element('div', { className: 'batches-layout' });
  const heading = element('section', { className: 'batches-heading' });
  const copy = element('div');
  copy.append(element('p', { className: 'eyebrow', text: 'FOCUSED WORK SESSIONS' }));
  copy.append(element('h2', { text: 'Make a little room to create.' }));
  copy.append(element('p', { className: 'content-list-description', text: 'Group the content you want to prepare together, then work through it at your own pace.' }));
  heading.append(copy, button('New Batch', { className: 'button button-primary', action: 'new-batch' }));
  page.append(heading);

  if (batches.length) {
    const list = element('section', { className: 'batch-card-list', attrs: { 'aria-label': `${batches.length} Batches` } });
    for (const batch of batches) list.append(batchCard(batch, contentItems));
    page.append(list);
  } else {
    const empty = element('section', { className: 'batch-empty-state' });
    empty.append(element('span', { className: 'empty-icon empty-icon-large', attrs: { 'aria-hidden': 'true' }, children: [element('span', { text: '▦' })] }));
    empty.append(element('h3', { text: 'Start with one focused session.' }));
    empty.append(element('p', { text: 'A Batch keeps the ideas you’re preparing together in one place.' }));
    empty.append(button('Create your first Batch', { className: 'button button-primary', action: 'new-batch' }));
    page.append(empty);
  }
  return page;
}

function contentTypeLabel(item) {
  if (!item.contentType) return '';
  return item.contentType === 'other' && item.customContentType ? item.customContentType : TYPE_LABELS[item.contentType] ?? '';
}

function channelLabel(item) {
  if (!item.channel) return '';
  return item.channel === 'other' && item.customChannel ? item.customChannel : CHANNEL_LABELS[item.channel] ?? '';
}

function batchItem(item) {
  const article = element('article', { className: 'batch-item-card', attrs: { 'data-batch-item-id': item.id } });
  const main = element('div', { className: 'batch-item-main' });
  main.append(button(item.title, { className: 'batch-item-title', attrs: { 'data-open-id': item.id, 'aria-label': `Open ${item.title}` } }));
  const details = [contentTypeLabel(item), channelLabel(item)].filter(Boolean);
  if (details.length) main.append(element('p', { className: 'batch-item-details', text: details.join(' · ') }));
  const controls = element('div', { className: 'batch-item-controls' });
  controls.append(statusBadge(item.status));
  const statusSelectId = `batch-status-${item.id}`;
  const label = element('label', { className: 'visually-hidden', text: `Change status for ${item.title}`, attrs: { for: statusSelectId } });
  const select = element('select', { className: 'text-input select-input batch-status-select', attrs: { id: statusSelectId, 'data-batch-status': item.id } });
  for (const status of ['idea', 'draft', 'ready', 'completed']) {
    const option = element('option', { text: STATUS_LABELS[status], attrs: { value: status } });
    option.selected = item.status === status;
    select.append(option);
  }
  controls.append(label, select);
  controls.append(button('Remove', { className: 'button button-quiet-danger button-small', attrs: { 'data-remove-batch-item': item.id, 'aria-label': `Remove ${item.title} from Batch` } }));
  article.append(main, controls);
  return article;
}

export function renderBatchDetailView(batch, items) {
  const progress = calculateBatchProgress(items);
  const page = element('div', { className: 'batch-workspace', attrs: { 'data-batch-detail-id': batch.id } });
  const toolbar = element('div', { className: 'batch-toolbar' });
  toolbar.append(button('All Batches', { className: 'back-button', action: 'back-to-batches', iconNode: element('span', { text: '←', attrs: { 'aria-hidden': 'true' } }) }));
  const toolbarActions = element('div', { className: 'batch-toolbar-actions' });
  toolbarActions.append(button('Edit Batch', { className: 'button button-secondary button-small', action: 'edit-batch' }));
  toolbarActions.append(button('Delete Batch', { className: 'button button-quiet-danger button-small', action: 'delete-batch' }));
  toolbar.append(toolbarActions);
  page.append(toolbar);

  const overview = element('section', { className: 'batch-overview', attrs: { 'aria-labelledby': 'batch-workspace-title' } });
  overview.append(element('p', { className: 'eyebrow', text: 'BATCH WORKSPACE' }));
  overview.append(element('h2', { text: batch.name, attrs: { id: 'batch-workspace-title', tabindex: '-1' } }));
  if (batch.description) overview.append(element('p', { className: 'batch-workspace-description', text: batch.description }));
  overview.append(element('p', { className: 'batch-total', text: `${progress.total} ${progress.total === 1 ? 'item' : 'items'}` }));
  overview.append(progressDisplay(progress, 'batch-progress batch-progress-large'));
  overview.append(batchCounts(progress));
  page.append(overview);

  const collection = element('section', { className: 'batch-content-section', attrs: { 'aria-labelledby': 'batch-content-title' } });
  const collectionHeading = element('div', { className: 'batch-content-heading' });
  collectionHeading.append(element('div', { children: [element('h3', { text: 'Content in this Batch', attrs: { id: 'batch-content-title', tabindex: '-1' } }), element('p', { text: 'Choose a status as each idea moves forward.' })] }));
  const actions = element('div', { className: 'batch-content-actions' });
  actions.append(button('Add Existing Content', { className: 'button button-secondary button-small', action: 'add-existing-content' }));
  actions.append(button('New Content', { className: 'button button-primary button-small', action: 'new-content' }));
  actions.append(button('Use Template', { className: 'button button-secondary button-small', action: 'open-templates' }));
  collectionHeading.append(actions);
  collection.append(collectionHeading);
  if (items.length) {
    const list = element('div', { className: 'batch-item-list' });
    for (const item of items) list.append(batchItem(item));
    collection.append(list);
  } else {
    const empty = element('div', { className: 'batch-empty-content' });
    empty.append(element('h3', { text: 'No content in this Batch yet.' }));
    empty.append(element('p', { text: 'Add an existing idea or create something new for this session.' }));
    const emptyActions = element('div', { className: 'batch-content-actions' });
    emptyActions.append(button('Add Existing Content', { className: 'button button-secondary', action: 'add-existing-content' }));
    emptyActions.append(button('New Content', { className: 'button button-primary', action: 'new-content' }));
    emptyActions.append(button('Use Template', { className: 'button button-secondary', action: 'open-templates' }));
    empty.append(emptyActions);
    collection.append(empty);
  }
  page.append(collection);
  return page;
}

export function renderExistingContentChoices(items, batches, currentBatchId) {
  const batchNames = new Map(batches.map(batch => [batch.id, batch.name]));
  const eligible = items.filter(item => item.batchId !== currentBatchId);
  if (!eligible.length) {
    return element('p', { className: 'dialog-empty', text: 'Every content item is already in this Batch.' });
  }
  const list = element('ul', { className: 'existing-content-list' });
  for (const item of eligible) {
    const row = element('li', { className: 'existing-content-choice', attrs: { 'data-existing-choice-id': item.id } });
    const copy = element('div', { className: 'existing-content-copy' });
    copy.append(element('strong', { text: item.title }), statusBadge(item.status));
    if (item.batchId) copy.append(element('span', { className: 'existing-content-current-batch', text: `Currently in ${batchNames.get(item.batchId) ?? 'another Batch'}` }));
    row.append(copy);
    row.append(button(item.batchId ? 'Move here' : 'Add to Batch', {
      className: item.batchId ? 'button button-secondary button-small' : 'button button-primary button-small',
      attrs: { 'data-assign-to-batch': item.id }
    }));
    list.append(row);
  }
  return list;
}
