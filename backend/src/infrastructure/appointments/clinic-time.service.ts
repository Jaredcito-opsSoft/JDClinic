import { env } from '../config/env.config.js';

const dateParts = (instant: Date, timeZone: string) => Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).map(part => [part.type, part.value]),
);

export const clinicDateKey = (instant = new Date(), timeZone = env.CLINIC_TIME_ZONE): string => {
  const parts = dateParts(instant, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const isValidDateKey = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const zonedMidnight = (dateKey: string, timeZone: string): Date => {
  const wallTime = Date.parse(`${dateKey}T00:00:00.000Z`);
  let instant = wallTime;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = dateParts(new Date(instant), timeZone);
    const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second));
    const delta = observed - wallTime;
    if (delta === 0) break;
    instant -= delta;
  }
  return new Date(instant);
};

export const clinicDayRange = (dateKey = clinicDateKey(), timeZone = env.CLINIC_TIME_ZONE) => {
  if (!isValidDateKey(dateKey)) throw new RangeError('Fecha clínica inválida.');
  const nextDate = new Date(Date.parse(`${dateKey}T00:00:00.000Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { start: zonedMidnight(dateKey, timeZone), end: zonedMidnight(nextDate, timeZone) };
};
