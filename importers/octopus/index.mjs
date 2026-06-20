// On-device Octopus importer entry point: fetch a product + map it to canonical.
// Intended to be called by the SDK / consumer app at runtime — output is the
// user's own data and is NEVER written to tariffs/.
import { fetchProduct, fetchProducts } from './fetch.mjs';
import { mapProduct } from './map.mjs';

export { fetchProduct, fetchProducts, mapProduct };

/**
 * Fetch one Octopus product and map it for a GSP region.
 * @param {string} code  product code, e.g. "GO-VAR-22-10-14" (dynamic ones throw).
 * @param {object} [opts] passed to mapProduct (gsp, paymentMethod, nightWindow, updated).
 */
export async function importOctopusProduct(code, opts = {}) {
  const detail = await fetchProduct(code);
  return mapProduct(detail, opts);
}
