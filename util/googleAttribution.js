// utils/googleAttribution.js


function parseGl(gl) {
  if (!gl || typeof gl !== "string") return {};
  const parts = gl.split("*");
  const out = {};
  for (let i = 2; i < parts.length - 1; i += 2) {
    const key = parts[i];
    const val = parts[i + 1];
    if (key && val) out[key] = val;
  }
  return out;
}

function extractIds(googleData) {
  if (!googleData || typeof googleData !== "object") return {};

  const root   = googleData;
  const nested = root.data && typeof root.data === "object" ? root.data : {};

  const _gl       = root._gl       || nested._gl       || null;
  const gclid     = root.gclid     || nested.gclid     || null;
  const _gcl_aw   = root._gcl_aw   || nested._gcl_aw   || null;
  const _gcl_au   = root._gcl_au   || nested._gcl_au   || null;
  const timestamp = root.timestamp || nested.timestamp || null;

  let glMap = {};
  if (_gl) glMap = parseGl(_gl);

  return {
    _gl,
    gclid,
    _gcl_aw: _gcl_aw || glMap["_gcl_aw"] || null,
    _gcl_au: _gcl_au || glMap["_gcl_au"] || null,
    _ga: glMap["_ga"] || null,
    _ga_any: Object.fromEntries(Object.entries(glMap).filter(([k]) => k.startsWith("_ga_"))),
    timestamp,
    _gl_parsed: glMap,
  };
}

// Tanpa UTM (karena kolom tidak ada). Kita bedakan 3 status saja.
function classifyAttributionFromIds(ids) {
  if (ids.gclid) {
    return { label: "google_ads_direct_click", why: "gclid present in session/URL" };
  }
  if (ids._gcl_aw) {
    return { label: "google_ads_prior_click", why: "_gcl_aw present (cookie/_gl), prior Ads click" };
  }
  return { label: "direct_unknown", why: "no gclid/_gcl_aw detected" };
}
function classifyAttribution(converted) {
  if (converted.gclid) {
    return { is_ads_conversion: true, ads_type: "direct" }; // klik langsung dari Ads
  }
  if (converted._gcl_aw) {
    return { is_ads_conversion: true, ads_type: "prior" }; // pernah klik Ads sebelumnya
  }
  return { is_ads_conversion: false, ads_type: "none" };   // bukan dari Ads
}
module.exports = {
  parseGl,
  extractIds,
  classifyAttributionFromIds,
  classifyAttribution
};