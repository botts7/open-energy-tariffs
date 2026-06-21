// Forward-geocode a free-text AU street address via OpenStreetMap Nominatim.
// Free, no key, CORS *. Nominatim usage policy: low volume + identify the app
// (the browser Referer does this) — so we ONLY call on an explicit submit (Enter),
// never per keystroke. Privacy: the typed address is sent to OSM's geocoder.
// Attribution: results © OpenStreetMap contributors (ODbL) / Nominatim.
window.OET = window.OET || {};

OET.geocodeAddress = function (q) {
  q = (q || '').trim();
  if (q.length < 4) return Promise.resolve(null);
  const url = 'https://nominatim.openstreetmap.org/search'
    + '?format=jsonv2&addressdetails=1&limit=1&countrycodes=au&q=' + encodeURIComponent(q);
  return fetch(url, { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((a) => {
      const f = a && a[0];
      if (!f) return null;
      return { lat: +f.lat, lng: +f.lon, postcode: (f.address || {}).postcode || null, label: f.display_name || q };
    })
    .catch(() => null);
};
