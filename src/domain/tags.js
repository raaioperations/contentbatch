export function normalizeTags(tags) {
  if (!Array.isArray(tags)) throw new TypeError('Tags must be a list of text values.');
  const seen = new Set();
  const result = [];
  for (const value of tags) {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError('Tags cannot be empty.');
    const tag = value.trim();
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

export function parseTagInput(value) {
  if (typeof value !== 'string') return [];
  return normalizeTags(value.split(',').map(tag => tag.trim()).filter(Boolean));
}

export function collectAvailableTags(contentItems) {
  const unique = new Map();
  for (const item of contentItems) {
    for (const tag of normalizeTags(item.tags ?? [])) {
      const key = tag.toLocaleLowerCase();
      if (!unique.has(key)) unique.set(key, tag);
    }
  }
  return [...unique.values()].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}
