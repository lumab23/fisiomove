import { currentWeek } from '../src/integration/usePatientData';

const weekMs = 7 * 24 * 60 * 60 * 1000;

function expectWeek(now: Date, mondayDate: number) {
  const { period_start, period_end } = currentWeek(now);
  const start = new Date(period_start);
  const end = new Date(period_end);
  expect(start.getDay()).toBe(1);
  expect(start.getDate()).toBe(mondayDate);
  expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([
    0, 0, 0,
  ]);
  expect(end.getTime() - start.getTime()).toBe(weekMs - 1);
  expect(end.getDay()).toBe(0);
  expect(start.getTime()).toBeLessThanOrEqual(now.getTime());
  expect(end.getTime()).toBeGreaterThanOrEqual(now.getTime());
}

test('a semana corrente começa na segunda e termina no domingo', () => {
  // 6 Nov 2026 is a Friday; 2 Nov is the Monday of that week.
  expectWeek(new Date(2026, 10, 6, 15, 30), 2);
});

test('domingo pertence à semana iniciada na segunda anterior', () => {
  expectWeek(new Date(2026, 10, 8, 23, 59, 59), 2);
});

test('segunda à meia-noite abre uma nova semana', () => {
  expectWeek(new Date(2026, 10, 9, 0, 0, 0), 9);
});
