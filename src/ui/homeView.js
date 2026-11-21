import { button, contentRow, element, icon } from './dom.js';

function statusMetric(label, count, status) {
  const card = element('div', { className: `metric-card metric-${status}` });
  const top = element('div', { className: 'metric-top' });
  top.append(element('span', { className: `metric-dot dot-${status}`, attrs: { 'aria-hidden': 'true' } }));
  top.append(element('span', { className: 'metric-label', text: label }));
  card.append(top, element('strong', { className: 'metric-count', text: String(count) }));
  return card;
}

function sectionTitle(title, { detail = '', iconName = '', id = '' } = {}) {
  const wrap = element('div', { className: 'section-title-wrap' });
  const titleLine = element('div', { className: 'section-title-line' });
  if (iconName) titleLine.append(element('span', { className: 'section-title-icon', children: [icon(iconName)] }));
  titleLine.append(element('h2', { text: title, attrs: id ? { id } : {} }));
  wrap.append(titleLine);
  if (detail) wrap.append(element('p', { className: 'section-detail', text: detail }));
  return wrap;
}

export function renderHome(items) {
  const page = element('div', { className: 'home-layout' });

  const capture = element('section', { className: 'capture-card', attrs: { 'aria-labelledby': 'capture-title' } });
  const captureTop = element('div', { className: 'capture-card-top' });
  const captureTitle = element('div', { className: 'capture-title-group' });
  captureTitle.append(element('span', { className: 'capture-sparkle', children: [icon('sparkle')] }));
  const captureText = element('div');
  captureText.append(element('p', { className: 'eyebrow', text: 'QUICK CAPTURE' }));
  captureText.append(element('h2', { text: 'Catch it while it’s fresh.', attrs: { id: 'capture-title' } }));
  captureText.append(element('p', { className: 'capture-description', text: 'Start with a title. The rest can come later.' }));
  captureTitle.append(captureText);
  captureTop.append(captureTitle);
  captureTop.append(element('span', { className: 'capture-step', text: '01 / CAPTURE' }));
  capture.append(captureTop);

  const form = element('form', { className: 'quick-capture-form', attrs: { id: 'quick-capture-form' } });
  const field = element('div', { className: 'quick-capture-field' });
  field.append(element('label', { className: 'visually-hidden', text: 'Content idea title', attrs: { for: 'quick-capture-title' } }));
  field.append(element('span', { className: 'input-leading-mark', text: '✳', attrs: { 'aria-hidden': 'true' } }));
  field.append(element('input', {
    className: 'capture-input',
    attrs: { id: 'quick-capture-title', name: 'title', type: 'text', maxlength: '240', required: true, autocomplete: 'off', placeholder: 'What’s on your mind?' }
  }));
  field.append(button('Add idea', { className: 'button button-primary capture-submit', attrs: { type: 'submit' }, iconNode: icon('arrow') }));
  form.append(field);
  form.append(element('p', { className: 'capture-hint', text: 'A useful idea can start as just a few words.' }));
  capture.append(form);
  page.append(capture);

  const ideas = items.filter(item => item.status === 'idea').length;
  const drafts = items.filter(item => item.status === 'draft').length;
  const ready = items.filter(item => item.status === 'ready').length;
  const statusSection = element('section', { className: 'status-overview', attrs: { 'aria-label': 'Content status counts' } });
  const overviewIntro = element('div', { className: 'overview-intro' });
  overviewIntro.append(element('p', { className: 'eyebrow', text: 'AT A GLANCE' }));
  overviewIntro.append(element('h2', { text: 'Keep things moving.' }));
  overviewIntro.append(element('p', { className: 'overview-copy', text: 'Your ideas don’t need to be finished to have a place.' }));
  const metrics = element('div', { className: 'metrics-grid' });
  metrics.append(statusMetric('Ideas', ideas, 'idea'), statusMetric('Drafts', drafts, 'draft'), statusMetric('Ready', ready, 'ready'));
  statusSection.append(overviewIntro, metrics);
  page.append(statusSection);

  const lower = element('div', { className: 'home-lower-grid' });
  const readyPanel = element('section', { className: 'home-panel ready-panel', attrs: { 'aria-labelledby': 'ready-title' } });
  readyPanel.append(sectionTitle('Ready to use', { detail: `${ready} ${ready === 1 ? 'item' : 'items'} prepared`, iconName: 'sparkle', id: 'ready-title' }));
  const readyItems = items.filter(item => item.status === 'ready').slice(0, 3);
  if (readyItems.length) {
    const list = element('div', { className: 'content-row-list compact-list' });
    for (const item of readyItems) list.append(contentRow(item, { compact: true }));
    readyPanel.append(list);
  } else {
    const empty = element('div', { className: 'panel-empty' });
    empty.append(element('span', { className: 'empty-icon', children: [icon('empty')] }));
    empty.append(element('p', { text: 'When an item is ready, it will be easy to find here.' }));
  }
  readyPanel.append(button('Open content', { className: 'text-button', action: 'view-content', iconNode: icon('arrow') }));

  const recentPanel = element('section', { className: 'home-panel recent-panel', attrs: { 'aria-labelledby': 'recent-title' } });
  recentPanel.append(sectionTitle('Recently updated', { detail: 'A few things you’ve been working on', iconName: 'clock', id: 'recent-title' }));
  const recentItems = items.slice(0, 4);
  if (recentItems.length) {
    const list = element('div', { className: 'content-row-list compact-list' });
    for (const item of recentItems) list.append(contentRow(item, { compact: true }));
    recentPanel.append(list);
  } else {
    const empty = element('div', { className: 'panel-empty' });
    empty.append(element('span', { className: 'empty-icon', children: [icon('layers')] }));
    empty.append(element('p', { text: 'Your first idea will show up here.' }));
    recentPanel.append(empty);
  }
  recentPanel.append(button('View all content', { className: 'text-button', action: 'view-content', iconNode: icon('arrow') }));
  lower.append(readyPanel, recentPanel);
  page.append(lower);

  const privacy = element('aside', { className: 'privacy-callout' });
  const privacyIcon = element('span', { className: 'privacy-icon', attrs: { 'aria-hidden': 'true' } });
  privacyIcon.append(element('span', { text: '◈' }));
  const privacyCopy = element('p');
  privacyCopy.append(element('strong', { text: 'Your work stays on this device.' }));
  privacyCopy.append(element('span', { text: ' Clearing browser or site data may remove it. Use Backup to keep a portable copy when it becomes available.' }));
  privacy.append(privacyIcon, privacyCopy);
  page.append(privacy);
  return page;
}
