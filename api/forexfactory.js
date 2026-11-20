const EXPORT_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const CACHE_TTL = 55 * 60 * 1000;
let cachedEvents = null;
let cacheExpiresAt = 0;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET to load the calendar.' });
  if (cachedEvents && Date.now() < cacheExpiresAt) {
    return res.status(200).json({ events: cachedEvents, cached: true });
  }
  try {
    const response = await fetch(EXPORT_URL, { headers: { Accept: 'application/json' } });
    if (response.status === 429) return res.status(503).json({ error: 'Forex Factory rate-limited the weekly export. Wait a few minutes, then retry.' });
    if (response.status === 403) return res.status(502).json({ error: 'Forex Factory refused this server request. Open the official calendar while access is unavailable.' });
    if (!response.ok) return res.status(502).json({ error: `Forex Factory weekly export returned HTTP ${response.status}.` });
    const payload = await response.json();
    if (!Array.isArray(payload)) return res.status(502).json({ error: 'Forex Factory returned an unexpected calendar format.' });
    cachedEvents = payload;
    cacheExpiresAt = Date.now() + CACHE_TTL;
    return res.status(200).json({ events: cachedEvents, cached: false });
  } catch (error) {
    console.error('Forex Factory weekly export fetch failed:', error?.message || error);
    return res.status(502).json({ error: 'The server could not connect to Forex Factory. Retry shortly or open the official calendar.' });
  }
}
