const SEARCH_FIELDS = ['title', 'hook', 'body', 'cta', 'notes'];
const FILTER_FIELDS = ['status', 'contentType', 'channel', 'batchId', 'tag'];

function selected(value) {
  if (Array.isArray(value)) return value.filter(entry => entry !== '' && entry !== null && entry !== undefined);
  return value === '' || value === null || value === undefined ? [] : [value];
}

function matchesCategory(item, category, values) {
  if (!values.length) return true;
  if (category === 'tag') {
    const tags = (item.tags ?? []).map(tag => tag.toLocaleLowerCase());
    return values.some(value => tags.includes(String(value).toLocaleLowerCase()));
  }
  return values.includes(item[category]);
}

export function searchAndFilterContentItems(items, query = '', filters = {}) {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  return items.filter(item => {
    if (needle) {
      const searchable = SEARCH_FIELDS.map(field => item[field] ?? '')
        .concat(item.tags ?? [])
        .join('\n')
        .toLocaleLowerCase();
      if (!searchable.includes(needle)) return false;
    }
    return FILTER_FIELDS.every(category => matchesCategory(item, category, selected(filters[category])));
  });
}

export function activeFilterCount(filters = {}) {
  return FILTER_FIELDS.reduce((count, category) => count + selected(filters[category]).length, 0);
}
