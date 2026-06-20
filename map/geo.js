// Geo-resolver: turn a plan's meta.coverage into map points.
// Ships small built-in centroid tables (demo-grade). For production-quality maps,
// swap these for real boundary GeoJSON (postcodes -> ABS POA polygons, gsp -> DNO
// licence areas, eiaid -> EIA/HIFLD service territories) — see README.
window.OET = window.OET || {};

// UK Grid Supply Point groups (_A.._P, no _I/_O) -> approx DNO region centre.
OET.GSP_CENTROIDS = {
  _A: [52.2, 0.9, 'Eastern England'],
  _B: [52.9, -1.2, 'East Midlands'],
  _C: [51.5, -0.1, 'London'],
  _D: [53.2, -3.0, 'Merseyside & N Wales'],
  _E: [52.5, -2.0, 'West Midlands'],
  _F: [54.9, -1.6, 'North East England'],
  _G: [53.8, -2.6, 'North West England'],
  _H: [51.0, -1.3, 'Southern England'],
  _J: [51.1, 0.5, 'South East England'],
  _K: [51.6, -3.4, 'South Wales'],
  _L: [50.7, -3.5, 'South West England'],
  _M: [53.8, -1.5, 'Yorkshire'],
  _N: [55.5, -3.8, 'Southern Scotland'],
  _P: [57.5, -4.2, 'Northern Scotland'],
};

// Sample AU postcode centroids for the demo plans (QLD/NSW/VIC/SA). A production
// build joins coverage.postcodes to full ABS POA polygons instead.
OET.AU_POSTCODES = {
  // SE Queensland (Ergon)
  '4306': [-27.62, 152.70], '4310': [-27.46, 152.58], '4312': [-27.50, 152.65],
  '4313': [-27.09, 152.37], '4314': [-26.98, 152.30],
  // Sydney NSW (Ausgrid)
  '2000': [-33.87, 151.21], '2007': [-33.88, 151.20], '2008': [-33.89, 151.20],
  // Melbourne VIC (United Energy)
  '3104': [-37.80, 145.08], '3105': [-37.77, 145.10], '3106': [-37.76, 145.13],
  // Adelaide SA (SA Power Networks)
  '5000': [-34.93, 138.60], '5006': [-34.91, 138.59], '5007': [-34.90, 138.57],
};

// Sample US utility (eiaid) centroids.
OET.US_UTILITY = { '14006': [39.96, -82.99, 'Ohio Power Co (AEP Ohio)'] };

// Approx area radius (metres) per coverage type, used when no exact boundary
// polygon is available — so a plan shows as a shaded AREA, not a pinpoint.
OET.AREA_RADIUS = { postcode: 6000, gsp: 130000, utility: 90000 };

// Resolve coverage -> [{ latlng:[lat,lng], label, type }]. Unknown keys are
// skipped (and counted by the caller so nothing is silently dropped).
OET.resolveCoverage = function (coverage) {
  const out = [];
  if (!coverage) return out;
  if (coverage.gsp && OET.GSP_CENTROIDS[coverage.gsp]) {
    const [lat, lng, name] = OET.GSP_CENTROIDS[coverage.gsp];
    out.push({ latlng: [lat, lng], label: `GSP ${coverage.gsp} — ${name}`, type: 'gsp' });
  }
  for (const pc of coverage.postcodes || []) {
    if (OET.AU_POSTCODES[pc]) out.push({ latlng: OET.AU_POSTCODES[pc], label: `Postcode ${pc}`, type: 'postcode' });
  }
  if (coverage.utilityId && OET.US_UTILITY[coverage.utilityId]) {
    const [lat, lng, name] = OET.US_UTILITY[coverage.utilityId];
    out.push({ latlng: [lat, lng], label: name || `Utility ${coverage.utilityId}`, type: 'utility' });
  }
  return out;
};
