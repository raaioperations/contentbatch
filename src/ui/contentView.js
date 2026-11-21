import { CHANNELS, CONTENT_STATUSES, CONTENT_TYPES } from '../domain/content.js';
import { activeFilterCount } from '../domain/search.js';
import { button, contentRow, element } from './dom.js';

const STATUS_LABELS = { idea: 'Idea', draft: 'Draft', ready: 'Ready', completed: 'Completed' };
const TYPE_LABELS = { 'social-post': 'Social Post', 'short-video': 'Short Video', 'long-video': 'Long Video', article: 'Article/Blog', email: 'Email', other: 'Other' };
const CHANNEL_LABELS = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X', email: 'Email', blog: 'Blog/Web', other: 'Other' };

function filterSelect(id, label, labels, category, selected, values = []) {
  const wrapper = element('div', { className: 'filter-field' });
  wrapper.append(element('label', { text: label, attrs: { for: id } }));
  const select = element('select', { className: 'text-input select-input filter-select', attrs: { id, 'data-content-filter': category } });
  select.append(element('option', { text: 'Any', attrs: { value: '' } }));
  for (const value of values) {
    const option = element('option', { text: labels[value] ?? value, attrs: { value } });
    option.selected = selected === value;
    select.append(option);
  }
  wrapper.append(select);
  return wrapper;
}

export function renderContentView(items, { query = '', filters = {}, batches = [], tags = [], filteredItems = items } = {}) {
  const page = element('div', { className: 'content-layout' });
  const intro = element('section', { className: 'content-list-heading' });
  const copy = element('div');
  copy.append(element('p', { className: 'eyebrow', text: 'YOUR LIBRARY' }));
  copy.append(element('h2', { text: 'Everything you’re shaping.' }));
  copy.append(element('p', { className: 'content-list-description', text: 'Ideas, drafts and ready-to-use content, all in one place.' }));
  intro.append(copy);
  const introActions = element('div', { className: 'content-header-actions' });
  introActions.append(button('Templates', { className: 'button button-secondary', action: 'open-templates' }));
  introActions.append(button('New content', { className: 'button button-primary', action: 'new-content', iconNode: element('span', { className: 'button-plus', text: '+' }) }));
  intro.append(introActions);
  page.append(intro);

  const retrieval = element('section', { className: 'retrieval-controls', attrs: { 'aria-label': 'Search and filter Content' } });
  const searchRow = element('div', { className: 'content-search-row' });
  const searchWrap = element('div', { className: 'form-field search-field' });
  searchWrap.append(element('label', { className: 'field-label', text: 'Search your content', attrs: { for: 'content-search' } }));
  const search = element('input', { className: 'text-input', attrs: { id: 'content-search', type: 'search', maxlength: '200', placeholder: 'Title, hook, body, notes or tags', value: query, autocomplete: 'off' } });
  searchWrap.append(search);
  searchRow.append(searchWrap);
  const filtersDisclosure = element('details', { className: 'filters-disclosure', attrs: { open: true } });
  const activeCount = activeFilterCount(filters);
  filtersDisclosure.append(element('summary', { text: activeCount ? `Filters · ${activeCount} active` : 'Filters' }));
  const filterGrid = element('div', { className: 'filter-grid' });
  filterGrid.append(filterSelect('filter-status', 'Status', STATUS_LABELS, 'status', filters.status, CONTENT_STATUSES));
  filterGrid.lastChild.querySelector('select').value = filters.status ?? '';
  filterGrid.append(filterSelect('filter-type', 'Content type', TYPE_LABELS, 'contentType', filters.contentType, CONTENT_TYPES));
  filterGrid.lastChild.querySelector('select').value = filters.contentType ?? '';
  filterGrid.append(filterSelect('filter-channel', 'Channel', CHANNEL_LABELS, 'channel', filters.channel, CHANNELS));
  filterGrid.lastChild.querySelector('select').value = filters.channel ?? '';
  const batchOptions = Object.fromEntries(batches.map(batch => [batch.id, batch.name]));
  filterGrid.append(filterSelect('filter-batch', 'Batch', batchOptions, 'batchId', filters.batchId, Object.keys(batchOptions)));
  filterGrid.lastChild.querySelector('select').value = filters.batchId ?? '';
  filterGrid.append(filterSelect('filter-tag', 'Tag', Object.fromEntries(tags.map(tag => [tag, tag])), 'tag', filters.tag, tags));
  filterGrid.lastChild.querySelector('select').value = filters.tag ?? '';
  filtersDisclosure.append(filterGrid);
  searchRow.append(filtersDisclosure);
  retrieval.append(searchRow);
  const retrievalState = element('div', { className: 'retrieval-status' });
  retrievalState.append(element('p', { text: activeCount ? `${activeCount} ${activeCount === 1 ? 'filter' : 'filters'} active${query.trim() ? ' · search active' : ''}` : query.trim() ? 'Search active' : 'No active search or filters', attrs: { id: 'active-filter-status', 'aria-live': 'polite', 'aria-atomic': 'true' } }));
  retrievalState.append(button('Clear Filters', { className: 'text-button clear-filters-button', action: 'clear-content-filters', attrs: { hidden: activeCount === 0 && !query.trim() } }));
  retrieval.append(retrievalState);
  page.append(retrieval);

  const collection = element('section', { className: 'content-collection', attrs: { 'aria-label': `${filteredItems.length} content ${filteredItems.length === 1 ? 'item' : 'items'}` } });
  collection.id = 'content-results';
  collection.append(renderContentResults(filteredItems, { isFiltered: Boolean(query.trim()) || activeCount > 0, total: items.length }));
  page.append(collection);
  return page;
}

export function renderContentResults(items, { isFiltered = false, total = items.length } = {}) {
  const collection = element('div');
  const collectionTop = element('div', { className: 'collection-topline' });
  collectionTop.append(element('h3', { text: 'All content' }));
  collectionTop.append(element('span', { className: 'collection-count', text: `${items.length} of ${total} ${total === 1 ? 'item' : 'items'}` }));
  collection.append(collectionTop);

  if (items.length) {
    const list = element('div', { className: 'content-row-list' });
    for (const item of items) list.append(contentRow(item));
    collection.append(list);
  } else if (isFiltered) {
    const empty = element('div', { className: 'library-empty filter-empty', attrs: { role: 'status' } });
    empty.append(element('h3', { text: 'No content matches these search and filters.' }));
    empty.append(element('p', { text: 'Try a different search, or clear filters to see your full library.' }));
    collection.append(empty);
  } else {
    const empty = element('div', { className: 'library-empty' });
    empty.append(element('span', { className: 'empty-icon empty-icon-large', attrs: { 'aria-hidden': 'true' }, children: [element('span', { text: '✳' })] }));
    empty.append(element('h3', { text: 'A good idea deserves a home.' }));
    empty.append(element('p', { text: 'Capture a thought now and come back to shape it when you’re ready.' }));
    empty.append(button('Create your first idea', { className: 'button button-primary', action: 'new-content' }));
    collection.append(empty);
  }
  return collection;
}
