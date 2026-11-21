export function element(tagName, { className = '', text = '', attrs = {}, children = [] } = {}) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (value === true) node.setAttribute(name, '');
    else node.setAttribute(name, String(value));
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

export function icon(name) {
  const paths = {
    sparkle: ['M12 3.5 13.7 9l5.3 2-5.3 2L12 18.5 10.3 13 5 11l5.3-2z', 'm19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z'],
    arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
    empty: ['M5 5.5h14v13H5z', 'M8 9h8M8 12h8M8 15h4'],
    clock: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z', 'M12 7v5l3 2'],
    layers: ['M12 3.5 3.5 8l8.5 4.5L20.5 8z', 'm3.5 12 8.5 4.5 8.5-4.5', 'm3.5 16 8.5 4.5 8.5-4.5']
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon');
  for (const d of paths[name] ?? []) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export function button(label, { className = 'button button-secondary', action = '', attrs = {}, iconNode = null } = {}) {
  const node = element('button', { className, text: label, attrs: { type: 'button', ...(action ? { 'data-action': action } : {}), ...attrs } });
  if (iconNode) node.prepend(iconNode);
  return node;
}

export function statusBadge(status) {
  const labels = { idea: 'Idea', draft: 'Draft', ready: 'Ready', completed: 'Completed' };
  return element('span', { className: `status-badge status-${status}`, text: labels[status] ?? status });
}

export function formatUpdatedDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export function contentRow(item, { compact = false } = {}) {
  const row = element('button', {
    className: `content-row${compact ? ' content-row-compact' : ''}`,
    attrs: { type: 'button', 'data-open-id': item.id, 'aria-label': `Open ${item.title}` }
  });
  const copy = element('span', { className: 'content-row-copy' });
  copy.append(element('span', { className: 'content-row-title', text: item.title }));
  const summary = item.hook || item.body;
  if (summary) copy.append(element('span', { className: 'content-row-summary', text: summary }));
  const meta = element('span', { className: 'content-row-meta' });
  meta.append(statusBadge(item.status));
  meta.append(element('span', { className: 'content-row-date', text: formatUpdatedDate(item.updatedAt) }));
  const arrow = element('span', { className: 'row-arrow', text: '↗', attrs: { 'aria-hidden': 'true' } });
  row.append(copy, meta, arrow);
  return row;
}
