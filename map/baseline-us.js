// Reference residential electricity prices for cross-validating our US data.
// DERIVED from U.S. EIA retail-sales, sector RES (US public domain): residential
// average price, latest annual period 2025, converted cents/kWh -> USD/kWh.
// Attributed in the ranking panel + LICENSING.md. Regenerate: EIA_API_KEY=... node scripts/refresh-baseline-us.mjs
window.OET = window.OET || {};
OET.BASELINE_US_SOURCE = 'U.S. EIA (public domain)';
OET.BASELINE_US = {"asOf":"2025","national":0.1723,"states":{"AK":0.2611,"AL":0.1609,"AR":0.1287,"AZ":0.1526,"CA":0.3135,"CO":0.1569,"CT":0.2931,"DC":0.2192,"DE":0.1715,"FL":0.1521,"GA":0.1474,"HI":0.404,"IA":0.1362,"ID":0.1183,"IL":0.1767,"IN":0.1596,"KS":0.1444,"KY":0.1313,"LA":0.1252,"MA":0.3041,"MD":0.1953,"ME":0.2769,"MI":0.2003,"MN":0.1583,"MO":0.133,"MS":0.1403,"MT":0.1299,"NC":0.14,"ND":0.1182,"NE":0.1205,"NH":0.2453,"NJ":0.2248,"NM":0.1485,"NV":0.1326,"NY":0.2639,"OH":0.169,"OK":0.1321,"OR":0.1546,"PA":0.1929,"RI":0.2948,"SC":0.1512,"SD":0.1332,"TN":0.1322,"TX":0.154,"UT":0.1302,"VA":0.1528,"VT":0.2279,"WA":0.1317,"WI":0.1808,"WV":0.1539,"WY":0.1337}};
