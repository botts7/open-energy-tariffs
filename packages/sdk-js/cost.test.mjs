import test from 'node:test';
import assert from 'node:assert/strict';
import { hourlyRates, estimateAnnualCost, usageFromAnnual, SHAPES, parseUsageCsv } from './cost.mjs';

const flat = { kind: 'flat', supply: { daily: 1 }, import: { flatRate: 0.2 } };
const tou = {
  kind: 'tou', supply: { daily: 0.5 },
  import: {
    bands: [{ id: 'pk', name: 'Peak', rate: 0.4 }, { id: 'off', name: 'Off', rate: 0.1 }],
    schedule: [
      { days: 'all', from: '00:00', to: '07:00', band: 'off' },
      { days: 'all', from: '07:00', to: '22:00', band: 'pk' },
      { days: 'all', from: '22:00', to: '24:00', band: 'off' },
    ],
  },
};

test('hourlyRates: flat fills 24h with the flat rate', () => {
  const r = hourlyRates(flat);
  assert.equal(r.weekday.length, 24);
  assert.ok(r.weekday.every((x) => x === 0.2));
  assert.equal(r.supplyDaily, 1);
});

test('hourlyRates: tou paints the schedule into bands', () => {
  const r = hourlyRates(tou);
  assert.equal(r.weekday[0], 0.1);   // 00:00 off
  assert.equal(r.weekday[6], 0.1);   // 06:00 off
  assert.equal(r.weekday[7], 0.4);   // 07:00 peak
  assert.equal(r.weekday[21], 0.4);  // 21:00 peak
  assert.equal(r.weekday[22], 0.1);  // 22:00 off
});

test('estimateAnnualCost: flat = kWh*rate + supply*365', () => {
  // 3650 kWh/yr flat shape => 10 kWh/day; 0.2/kWh => 730 energy + 365 supply = 1095
  const cost = estimateAnnualCost(flat, usageFromAnnual(3650, 'flat'));
  assert.ok(Math.abs(cost - 1095) < 1, `got ${cost}`);
});

test('estimateAnnualCost: tou differs by load shape (night cheaper than daytime)', () => {
  const night = estimateAnnualCost(tou, usageFromAnnual(3650, 'night_ev'));
  const day = estimateAnnualCost(tou, usageFromAnnual(3650, 'daytime'));
  assert.ok(night < day, `night ${night} should be < day ${day}`);
});

test('usageFromAnnual: profile scales to the annual total', () => {
  const u = usageFromAnnual(3650, 'evening');
  const annual = u.weekday.reduce((a, b) => a + b, 0) * 261 + u.weekend.reduce((a, b) => a + b, 0) * 104;
  assert.ok(Math.abs(annual - 3650) < 1, `got ${annual}`);
});

test('parseUsageCsv: sums sub-hourly intervals per hour, totals annual', () => {
  // one weekday (Wed 2024-01-03), two 30-min reads in hour 18 = 1.5 kWh that hour
  const csv = '2024-01-03T18:00,0.5\n2024-01-03T18:30,1.0\n2024-01-03T02:00,0.2';
  const { profile, annualKwh } = parseUsageCsv(csv);
  assert.equal(profile.weekday[18], 1.5);
  assert.equal(profile.weekday[2], 0.2);
  assert.ok(annualKwh > 0);
});

test('SHAPES has the expected presets', () => {
  for (const k of ['flat', 'daytime', 'evening', 'night_ev']) assert.equal(SHAPES[k].length, 24);
});
