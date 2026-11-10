export const CLINIC_TIME_ZONE = import.meta.env.VITE_CLINIC_TIME_ZONE || 'America/Mexico_City';

const partsFor = (date: Date) => Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]),
);

export const clinicDateKey = (date = new Date()) => {
  const parts = partsFor(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const clinicDateAfterDays = (days: number) => {
  const today = clinicDateKey();
  return new Date(Date.parse(`${today}T12:00:00.000Z`) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

export const toClinicInput = (value: string) => {
  const parts = partsFor(new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export const fromClinicInput = (value: string) => {
  const wallTime = Date.parse(`${value}:00.000Z`);
  if (!Number.isFinite(wallTime)) throw new RangeError('Fecha de cita inválida.');
  let instant = wallTime;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = partsFor(new Date(instant));
    const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second));
    const delta = observed - wallTime;
    if (delta === 0) break;
    instant -= delta;
  }
  return new Date(instant).toISOString();
};

export const formatClinicTime = (value: string) => new Date(value).toLocaleTimeString('es-MX', {
  timeZone: CLINIC_TIME_ZONE, hour: '2-digit', minute: '2-digit',
});

export const formatClinicCalendarDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00.000Z`)
  .toLocaleDateString('es-MX', { timeZone: 'UTC' });
