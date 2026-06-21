// Reference residential electricity prices for cross-validating our US data.
// DERIVED from U.S. EIA retail-sales, sector RES (US public domain): residential
// average price, latest annual period 2025, converted cents/kWh -> USD/kWh.
// Attributed in the ranking panel + LICENSING.md. Regenerate: EIA_API_KEY=... node scripts/refresh-baseline-us.mjs
window.OET = window.OET || {};
OET.BASELINE_US_SOURCE = 'U.S. EIA (public domain)';
OET.BASELINE_US = {"asOf":"2025","national":0.173,"states":{"AK":0.2609,"AL":0.161,"AR":0.1284,"AZ":0.1532,"CA":0.3254,"CO":0.1585,"CT":0.2938,"DC":0.2194,"DE":0.1713,"FL":0.1524,"GA":0.1473,"HI":0.4059,"IA":0.1372,"ID":0.1182,"IL":0.1769,"IN":0.1623,"KS":0.1456,"KY":0.1324,"LA":0.1257,"MA":0.3048,"MD":0.1948,"ME":0.2778,"MI":0.2001,"MN":0.1582,"MO":0.1349,"MS":0.1403,"MT":0.1298,"NC":0.1402,"ND":0.1181,"NE":0.1234,"NH":0.2456,"NJ":0.2263,"NM":0.1508,"NV":0.1315,"NY":0.2639,"OH":0.1696,"OK":0.1312,"OR":0.1537,"PA":0.193,"RI":0.2946,"SC":0.1496,"SD":0.1338,"TN":0.1318,"TX":0.1547,"UT":0.1307,"VA":0.1528,"VT":0.2292,"WA":0.1311,"WI":0.1816,"WV":0.1541,"WY":0.1338}};
