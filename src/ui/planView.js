import { addCalendarMonths, daysInMonth, formatDateOnly, isValidDateOnly, parseDateOnly, weekdayForDateOnly } from '../domain/dates.js';
import { button, element, statusBadge } from './dom.js';

const STATUS_LABELS = { idea: 'Idea', draft: 'Draft', ready: 'Ready', completed: 'Completed' };
const TYPE_LABELS = { 'social-post': 'Social post', 'short-video': 'Short video', 'long-video': 'Long video', article: 'Article/Blog', email: 'Email', other: 'Other' };
const CHANNEL_LABELS = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X', email: 'Email', blog: 'Blog/Web', other: 'Other' };

function dateLabel(date, options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) {
  const parts = parseDateOnly(date);
  if (!parts) return date;
  const [year, month, day] = parts.map(Number);
  return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day, 12));
}

function itemCard(item, { scheduled = false } = {}) {
  const card = element('article', { className: 'plan-item', attrs: { 'data-plan-item-id': item.id } });
  const main = element('div', { className: 'plan-item-main' });
  main.append(button(item.title, { className: 'plan-item-title', attrs: { 'data-plan-open-id': item.id } }));
  const metadata = element('div', { className: 'plan-item-meta' });
  metadata.append(statusBadge(item.status));
  if (item.channel) metadata.append(element('span', { text: CHANNEL_LABELS[item.channel] ?? item.customChannel ?? item.channel }));
  if (item.contentType) metadata.append(element('span', { text: TYPE_LABELS[item.contentType] ?? item.customContentType ?? item.contentType }));
  main.append(metadata);
  card.append(main);
  const actions = element('div', { className: 'plan-item-actions' });
  const label = element('label', { className: 'visually-hidden', text: scheduled ? `Change intended date for ${item.title}` : `Assign intended date for ${item.title}` });
  const dateInput = element('input', { className: 'plan-date-input', attrs: { type: 'date', value: item.scheduledDate ?? '', 'data-plan-date': item.id, 'aria-label': label.textContent } });
  actions.append(dateInput);
  if (scheduled) actions.append(button('Remove date', { className: 'text-button plan-remove-date', attrs: { 'data-clear-plan-date': item.id } }));
  card.append(actions);
  return card;
}

function itemGroup(date, items) {
  const group = element('section', { className: 'agenda-day', attrs: { 'aria-labelledby': `agenda-${date}` } });
  const heading = element('div', { className: 'agenda-day-heading' });
  heading.append(element('h3', { text: dateLabel(date), attrs: { id: `agenda-${date}` } }));
  heading.append(element('span', { text: `${items.length} ${items.length === 1 ? 'item' : 'items'}` }));
  group.append(heading);
  const list = element('div', { className: 'agenda-item-list' });
  for (const item of items) list.append(itemCard(item, { scheduled: true }));
  group.append(list);
  return group;
}

function renderUnscheduled(items) {
  const section = element('section', { className: 'plan-panel unscheduled-panel', attrs: { 'aria-labelledby': 'unscheduled-title' } });
  const heading = element('div', { className: 'plan-panel-heading' });
  heading.append(element('div', { children: [element('p', { className: 'eyebrow', text: 'NO DATE ASSIGNED' }), element('h2', { text: 'Unscheduled', attrs: { id: 'unscheduled-title' } })] }));
  heading.append(element('span', { className: 'plan-count', text: `${items.length}` }));
  section.append(heading);
  if (!items.length) section.append(element('p', { className: 'plan-empty-copy', text: 'Everything here has an intended date. New undated content will always appear in this section.' }));
  else {
    const list = element('div', { className: 'agenda-item-list' });
    for (const item of items) list.append(itemCard(item));
    section.append(list);
  }
  return section;
}

function renderCalendar(items, year, month, selectedDate) {
  const section = element('section', { className: 'plan-panel plan-calendar-panel', attrs: { 'aria-label': 'Monthly content calendar' } });
  const heading = element('div', { className: 'calendar-heading' });
  heading.append(button('Previous month', { className: 'calendar-nav-button', attrs: { 'data-month-delta': '-1', 'aria-label': 'Previous month' }, iconNode: element('span', { text: '‹', attrs: { 'aria-hidden': 'true' } }) }));
  heading.append(element('h2', { text: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1, 12)), attrs: { id: 'calendar-month-title' } }));
  heading.append(button('Next month', { className: 'calendar-nav-button', attrs: { 'data-month-delta': '1', 'aria-label': 'Next month' }, iconNode: element('span', { text: '›', attrs: { 'aria-hidden': 'true' } }) }));
  section.append(heading);
  const grid = element('div', { className: 'calendar-grid', attrs: { 'aria-labelledby': 'calendar-month-title' } });
  for (const dayName of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) grid.append(element('span', { className: 'calendar-weekday', text: dayName, attrs: {} }));
  const monthStart = formatDateOnly(year, month, 1);
  for (let blank = 0; blank < weekdayForDateOnly(monthStart); blank += 1) grid.append(element('span', { className: 'calendar-blank', attrs: { 'aria-hidden': 'true' } }));
  const itemsByDate = new Map();
  for (const item of items) {
    if (!item.scheduledDate) continue;
    itemsByDate.set(item.scheduledDate, (itemsByDate.get(item.scheduledDate) ?? 0) + 1);
  }
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const date = formatDateOnly(year, month, day);
    const count = itemsByDate.get(date) ?? 0;
    const cell = button('', { className: `calendar-day${date === selectedDate ? ' is-selected' : ''}${count ? ' has-content' : ''}`, attrs: { 'data-select-date': date, 'aria-pressed': date === selectedDate ? 'true' : 'false', 'aria-label': `${dateLabel(date, { month: 'long', day: 'numeric' })}${count ? `, ${count} ${count === 1 ? 'item' : 'items'}` : ''}` } });
    cell.append(element('span', { className: 'calendar-day-number', text: String(day) }));
    cell.append(element('span', { className: 'calendar-day-count', text: count ? `${count} ${count === 1 ? 'item' : 'items'}` : '' }));
    grid.append(cell);
  }
  section.append(grid);
  return section;
}

export function renderPlanView(items, { year, month, selectedDate }) {
  const page = element('div', { className: 'plan-layout', attrs: { 'data-plan-month': `${year}-${String(month).padStart(2, '0')}`, 'data-selected-date': selectedDate } });
  const heading = element('div', { className: 'plan-page-heading' });
  heading.append(element('div', { children: [element('p', { className: 'eyebrow', text: 'INTENDED USE' }), element('h2', { text: 'Plan your content' }), element('p', { text: 'Dates are optional. Choose a day when you intend to use each piece.' })] }));
  const headingActions = element('div', { className: 'plan-heading-actions' });
  const mobileMonth = element('div', { className: 'mobile-month-nav' });
  mobileMonth.append(button('Previous month', { className: 'calendar-nav-button', attrs: { 'data-month-delta': '-1', 'aria-label': 'Previous month' }, iconNode: element('span', { text: '‹', attrs: { 'aria-hidden': 'true' } }) }));
  mobileMonth.append(element('strong', { text: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1, 12)) }));
  mobileMonth.append(button('Next month', { className: 'calendar-nav-button', attrs: { 'data-month-delta': '1', 'aria-label': 'Next month' }, iconNode: element('span', { text: '›', attrs: { 'aria-hidden': 'true' } }) }));
  headingActions.append(mobileMonth);
  headingActions.append(button('Today', { className: 'button button-secondary', action: 'plan-today' }));
  heading.append(headingActions);
  page.append(heading);

  const scheduledItems = items.filter(item => isValidDateOnly(item.scheduledDate)).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || b.updatedAt.localeCompare(a.updatedAt));
  const byDate = new Map();
  for (const item of scheduledItems) byDate.set(item.scheduledDate, [...(byDate.get(item.scheduledDate) ?? []), item]);
  const planned = element('div', { className: 'plan-content' });
  planned.append(renderCalendar(items, year, month, selectedDate));
  const dayAgenda = element('section', { className: 'plan-panel selected-day-panel', attrs: { 'aria-labelledby': 'selected-day-title' } });
  const dayHeading = element('div', { className: 'plan-panel-heading' });
  dayHeading.append(element('div', { children: [element('p', { className: 'eyebrow', text: 'SELECTED DAY' }), element('h2', { text: dateLabel(selectedDate), attrs: { id: 'selected-day-title' } })] }));
  dayHeading.append(element('span', { className: 'plan-count', text: `${(byDate.get(selectedDate) ?? []).length}` }));
  dayAgenda.append(dayHeading);
  const selectedItems = byDate.get(selectedDate) ?? [];
  if (selectedItems.length) {
    const list = element('div', { className: 'agenda-item-list' });
    for (const item of selectedItems) list.append(itemCard(item, { scheduled: true }));
    dayAgenda.append(list);
  } else dayAgenda.append(element('p', { className: 'plan-empty-copy', text: 'No content planned for this date.' }));
  planned.append(dayAgenda);
  const agenda = element('section', { className: 'plan-panel mobile-agenda-panel', attrs: { 'aria-labelledby': 'month-agenda-title' } });
  const mobileHeading = element('div', { className: 'plan-panel-heading' });
  mobileHeading.append(element('div', { children: [element('p', { className: 'eyebrow', text: 'MONTH AGENDA' }), element('h2', { text: dateLabel(formatDateOnly(year, month, 1), { month: 'long', year: 'numeric' }), attrs: { id: 'month-agenda-title' } })] }));
  agenda.append(mobileHeading);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  const monthDates = [...byDate.keys()].filter(date => date.startsWith(monthPrefix)).sort();
  if (monthDates.length) for (const date of monthDates) agenda.append(itemGroup(date, byDate.get(date)));
  else agenda.append(element('p', { className: 'plan-empty-copy', text: 'No content is scheduled this month yet.' }));
  planned.append(agenda);
  page.append(planned);
  const unscheduled = items.filter(item => item.scheduledDate === null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  page.append(renderUnscheduled(unscheduled));
  return page;
}

export function monthAfter(year, month, delta) {
  return addCalendarMonths(year, month, delta);
}
