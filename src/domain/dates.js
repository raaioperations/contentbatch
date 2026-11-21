const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > lengths[month - 1]) return null;
  return [yearText, monthText, dayText];
}

export function isValidDateOnly(value) {
  return parseDateOnly(value) !== null;
}

export function formatDateOnly(year, month, day) {
  const value = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (!isValidDateOnly(value)) throw new TypeError('Date must be a valid YYYY-MM-DD calendar date.');
  return value;
}

export function localDateKey(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('A valid Date is required.');
  return formatDateOnly(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function addCalendarMonths(year, month, delta) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(delta)) {
    throw new TypeError('Year, month, and month offset must be integers; month must be between 1 and 12.');
  }
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  return { year: nextYear, month: index - nextYear * 12 + 1 };
}

export function daysInMonth(year, month) {
  formatDateOnly(year, month, 1);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function compareDateOnly(left, right) {
  if (!isValidDateOnly(left) || !isValidDateOnly(right)) throw new TypeError('Dates must use valid YYYY-MM-DD values.');
  return left.localeCompare(right);
}

export function weekdayForDateOnly(value) {
  const parts = parseDateOnly(value);
  if (!parts) throw new TypeError('Date must use a valid YYYY-MM-DD value.');
  const [year, month, day] = parts.map(Number);
  return new Date(year, month - 1, day, 12).getDay();
}
