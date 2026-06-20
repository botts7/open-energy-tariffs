// Embedded sample of the real captured plans, so map/index.html renders
// standalone (file:// blocks fetch of ../dist). When served over http the app
// loads the live bundle instead (see data.js). Trimmed to the fields the map uses.
window.OET = window.OET || {};
OET.SAMPLE = {
  schemaMajor: 1,
  entries: [
    {
      meta: {
        id: 'au-qld-ergon-ergon-energy-tariff-12d',
        country: 'AU', region: 'QLD', provider: 'Ergon Energy', plan: 'Tariff 12D',
        currency: 'AUD', source: 'cdr',
        coverage: { postcodes: ['4306', '4310', '4312', '4313', '4314'] },
      },
      tariff: {
        kind: 'tou', supply: { daily: 1.35304 },
        import: { bands: [
          { id: 'peak', name: 'Peak', rate: 0.41556 },
          { id: 'shoulder', name: 'Shoulder', rate: 0.25486 },
          { id: 'off-peak', name: 'Off peak', rate: 0.20618 },
        ] },
      },
    },
    {
      meta: {
        id: 'au-nsw-ausgrid-energyaustralia-business-balance-12',
        country: 'AU', region: 'NSW', provider: 'EnergyAustralia', plan: 'Business Balance Plan 12 (Loadsmart)',
        currency: 'AUD', source: 'cdr',
        coverage: { postcodes: ['2000', '2007', '2008'] },
      },
      tariff: { kind: 'tou', supply: { daily: 7.412 }, import: { bands: [{ id: 'peak', name: 'Peak', rate: 0.45561 }] } },
    },
    {
      meta: {
        id: 'au-vic-united-energy-agl-residential-seniors-saver',
        country: 'AU', region: 'VIC', provider: 'AGL', plan: 'Residential Seniors Saver',
        currency: 'AUD', source: 'cdr',
        coverage: { postcodes: ['3104', '3105', '3106'] },
      },
      tariff: { kind: 'tou', supply: { daily: 0.8894 }, import: { bands: [{ id: 'peak', name: 'Peak', rate: 0.293 }] } },
    },
    {
      meta: {
        id: 'au-sa-sa-power-networks-energyaustralia-business-balance-12-tou',
        country: 'AU', region: 'SA', provider: 'EnergyAustralia', plan: 'Business Balance Plan 12 (7-day ToU)',
        currency: 'AUD', source: 'cdr',
        coverage: { postcodes: ['5000', '5006', '5007'] },
      },
      tariff: { kind: 'tou', supply: { daily: 1.47 }, import: { bands: [{ id: 'peak', name: 'Peak', rate: 0.64338 }] } },
    },
    {
      meta: {
        id: 'gb-a-octopus-var-22-11-01',
        country: 'GB', region: 'A', provider: 'Octopus Energy', plan: 'Flexible Octopus',
        currency: 'GBP', source: 'octopus',
        coverage: { gsp: '_A' },
      },
      tariff: { kind: 'flat', supply: { daily: 0.47977 }, import: { flatRate: 0.24937 } },
    },
    {
      meta: {
        id: 'us-oh-ohio-power-co-residential-service-bundled-ohio-power-rate-zone-rs',
        country: 'US', region: 'OH', provider: 'Ohio Power Co', plan: 'Residential Service (RS)',
        currency: 'USD', source: 'urdb',
        coverage: { utilityId: '14006' },
      },
      tariff: { kind: 'flat', supply: { daily: 0.61721 }, import: { flatRate: 0.16776 } },
    },
  ],
};
