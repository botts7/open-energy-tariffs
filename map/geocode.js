// Forward-geocode a free-text street address / place via OpenStreetMap Nominatim.
// Free, no key, CORS *. Nominatim usage policy: low volume + identify the app
// (the browser Referer does this) — so we ONLY call on an explicit submit (Enter),
// never per keystroke. Privacy: the typed address is sent to OSM's geocoder.
// Attribution: results © OpenStreetMap contributors (ODbL) / Nominatim.
//
// Country scope: the tool covers many countries, so geocoding is WORLDWIDE by
// default. Callers pass the selected country's ISO-3166 alpha-2 (lower-case) to
// restrict results to that country; pass null/'' for a worldwide search.
window.OET = window.OET || {};

// Live AUTOCOMPLETE suggestions via Photon (Komoot) — OSM-based, free, no key,
// CORS *, and (unlike Nominatim) explicitly built for typeahead/per-keystroke.
// Biased to the current map view; optionally restricted to one country. Returns
// [{lat,lng,postcode,label}]. We debounce the caller so we stay polite.
OET.suggestAddress = function (q, near, cc) {
  q = (q || '').trim();
  if (q.length < 3) return Promise.resolve([]);
  cc = (cc || '').toLowerCase();
  let url = 'https://photon.komoot.io/api/?limit=6&q=' + encodeURIComponent(q);
  if (near && isFinite(near[0]) && isFinite(near[1])) url += '&lat=' + near[0] + '&lon=' + near[1];
  return fetch(url).then((r) => (r.ok ? r.json() : null)).then((d) => {
    const fs = (d && d.features) || [];
    return fs.filter((f) => {
      if (!cc) return true; // worldwide
      const p = f.properties || {};
      return (p.countrycode || '').toLowerCase() === cc;
    }).map((f) => {
      const p = f.properties || {}, c = f.geometry.coordinates;
      const name = p.name || [p.housenumber, p.street].filter(Boolean).join(' ');
      const label = [name, p.city || p.district || p.county, p.state, p.postcode, p.country]
        .filter(Boolean).join(', ');
      return { lat: c[1], lng: c[0], postcode: p.postcode || null, label: label || q };
    });
  }).catch(() => []);
};

OET.geocodeAddress = function (q, cc) {
  q = (q || '').trim();
  if (q.length < 3) return Promise.resolve(null);
  cc = (cc || '').toLowerCase();
  let url = 'https://nominatim.openstreetmap.org/search'
    + '?format=jsonv2&addressdetails=1&limit=1&q=' + encodeURIComponent(q);
  if (cc) url += '&countrycodes=' + encodeURIComponent(cc);
  return fetch(url, { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((a) => {
      const f = a && a[0];
      if (!f) return null;
      return { lat: +f.lat, lng: +f.lon, postcode: (f.address || {}).postcode || null, label: f.display_name || q };
    })
    .catch(() => null);
};
