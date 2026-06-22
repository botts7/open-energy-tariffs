import test from 'node:test';
import assert from 'node:assert/strict';
import { bandRole, assignRoles } from './canonical.mjs';

test('bandRole maps source semantic words (any language) to roles', () => {
  assert.equal(bandRole('Peak'), 'peak');
  assert.equal(bandRole('Off-peak'), 'offpeak');
  assert.equal(bandRole('Shoulder'), 'shoulder');
  assert.equal(bandRole('Heures Pleines'), 'peak');
  assert.equal(bandRole('Heures Creuses'), 'offpeak');
  assert.equal(bandRole('半尖峰'), 'shoulder');
  assert.equal(bandRole('離峰'), 'offpeak');
  assert.equal(bandRole('Controlled load'), 'controlled');
  // rank words are intentionally NOT semantic -> undefined (rate-rank decides)
  assert.equal(bandRole('High'), undefined);
  assert.equal(bandRole('Low'), undefined);
});

test('assignRoles falls back to rate rank for rank-named bands (DK Low/High/Peak)', () => {
  const bands = [
    { id: 'b1', name: 'Low', rate: 0.10 },
    { id: 'b2', name: 'High', rate: 0.20 },
    { id: 'b3', name: 'Peak', rate: 0.45 },
  ];
  assignRoles(bands);
  assert.deepEqual(bands.map((b) => b.role), ['offpeak', 'shoulder', 'peak']);
});

test('assignRoles: two bands -> offpeak/peak, no shoulder', () => {
  const bands = [{ name: 'Night', rate: 0.08 }, { name: 'Day', rate: 0.30 }];
  assignRoles(bands);
  assert.deepEqual(bands.map((b) => b.role), ['offpeak', 'peak']);
});

test('assignRoles prefers the source word over rank (a cheap "Peak" stays peak)', () => {
  const bands = [{ name: 'Peak', rate: 0.10 }, { name: 'Off-peak', rate: 0.30 }];
  assignRoles(bands);
  assert.equal(bands.find((b) => b.name === 'Peak').role, 'peak');
  assert.equal(bands.find((b) => b.name === 'Off-peak').role, 'offpeak');
});
