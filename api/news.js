const PAIRS = {
  'EUR/USD': ['"EUR/USD" OR EURUSD OR (euro AND "US dollar")'], 'GBP/USD': ['"GBP/USD" OR GBPUSD OR ("British pound" AND "US dollar")'],
  'USD/JPY': ['"USD/JPY" OR USDJPY OR ("US dollar" AND "Japanese yen")'], 'USD/CHF': ['"USD/CHF" OR USDCHF OR ("US dollar" AND "Swiss franc")'],
  'AUD/USD': ['"AUD/USD" OR AUDUSD OR ("Australian dollar" AND "US dollar")'], 'USD/CAD': ['"USD/CAD" OR USDCAD OR ("US dollar" AND "Canadian dollar")'],
  'NZD/USD': ['"NZD/USD" OR NZDUSD OR ("New Zealand dollar" AND "US dollar")'], 'EUR/GBP': ['"EUR/GBP" OR EURGBP OR (euro AND "British pound")'],
  'EUR/JPY': ['"EUR/JPY" OR EURJPY OR (euro AND "Japanese yen")'], 'GBP/JPY': ['"GBP/JPY" OR GBPJPY OR ("British pound" AND "Japanese yen")'],
  'EUR/CHF': ['"EUR/CHF" OR EURCHF OR (euro AND "Swiss franc")'], 'AUD/JPY': ['"AUD/JPY" OR AUDJPY OR ("Australian dollar" AND "Japanese yen")'],
  'USD/CNH': ['"USD/CNH" OR USDCNH OR ("US dollar" AND "Chinese yuan")'], 'USD/MXN': ['"USD/MXN" OR USDMXN OR ("US dollar" AND "Mexican peso")'],
  'USD/ZAR': ['"USD/ZAR" OR USDZAR OR ("US dollar" AND "South African rand")'], 'USD/TRY': ['"USD/TRY" OR USDTRY OR ("US dollar" AND "Turkish lira")'],
  'USD/SEK': ['"USD/SEK" OR USDSEK OR ("US dollar" AND "Swedish krona")'], 'USD/NOK': ['"USD/NOK" OR USDNOK OR ("US dollar" AND "Norwegian krone")'],
  'USD/SGD': ['"USD/SGD" OR USDSGD OR ("US dollar" AND "Singapore dollar")'], 'USD/HKD': ['"USD/HKD" OR USDHKD OR ("US dollar" AND "Hong Kong dollar")'],
  'USD/INR': ['"USD/INR" OR USDINR OR ("US dollar" AND "Indian rupee")'], 'USD/BRL': ['"USD/BRL" OR USDBRL OR ("US dollar" AND "Brazilian real")'],
  'USD/KRW': ['"USD/KRW" OR USDKRW OR ("US dollar" AND "South Korean won")'], 'USD/PLN': ['"USD/PLN" OR USDPLN OR ("US dollar" AND "Polish zloty")'],
  'XAU/USD': ['"XAU/USD" OR XAUUSD OR "gold price" OR "gold market"'], 'XAG/USD': ['"XAG/USD" OR XAGUSD OR "silver price" OR "silver market"'],
  'WTI': ['WTI OR "West Texas Intermediate" OR "US crude oil"'], 'BRENT': ['Brent OR "Brent crude" OR "Brent oil price"'],
  'NASDAQ': ['"Nasdaq 100" OR NDX OR "Nasdaq index" OR "Nasdaq futures"'], 'S&P 500': ['"S&P 500" OR SPX OR "S&P futures"'],
  'DOW': ['"Dow Jones Industrial Average" OR "Dow Jones" OR "Dow futures"'], 'DAX': ['"DAX 40" OR "DAX index" OR "DAX futures"'],
  'FTSE 100': ['"FTSE 100" OR "FTSE index" OR "FTSE futures"'], 'NIKKEI': ['"Nikkei 225" OR "Nikkei index" OR "Nikkei futures"'],
  'BTC/USD': ['"BTC/USD" OR BTCUSD OR Bitcoin OR "Bitcoin price"'], 'ETH/USD': ['"ETH/USD" OR ETHUSD OR Ethereum OR "Ethereum price"']
};

const FED_FEEDS = [
  'https://www.federalreserve.gov/feeds/press_monet.xml',
  'https://www.federalreserve.gov/feeds/speeches.xml',
  'https://www.federalreserve.gov/feeds/testimony.xml',
];
const CNBC_FED_QUERY = '"Federal Reserve" OR FOMC OR "Federal Open Market Committee" OR "Fed rate" OR "Fed chair"';
const CNBC_FED_RELEVANCE = /\b(federal reserve|fomc|federal open market committee|fed (?:chair|officials?|rate|rates|policy|meeting|decision|minutes))\b/i;

function assessImpact(article) {
  const text = `${article.title || ''} ${article.description || ''}`;
  const rules = [
    [/\b(fomc|rate decision|interest rate decision|rate announcement|emergency rate|nonfarm payrolls?|nfp|payrolls?|unemployment rate|cpi|pce|inflation|consumer prices|currency intervention|sovereign default|market crash|armed conflict|invasion)\b/i, 'very-high', 'Rate, inflation, employment, intervention, or crisis headline'],
    [/\b(central bank|fed chair|fed officials?|ecb|bank of england|boe|boj|rba|rbnz|snb|rate cut|rate hike|rate hold|interest rate|gdp|recession|tariff|sanction|trade war)\b/i, 'high', 'Central-bank, growth, or geopolitical headline'],
    [/\b(pmi|retail sales|trade balance|wages|industrial production|business activity|consumer confidence|housing|manufacturing|oil supply|opec|budget)\b/i, 'medium', 'Economic data or sector headline'],
  ];
  for (const [pattern, impact, reason] of rules) if (pattern.test(text)) return { impact, impactReason: reason };
  return { impact: 'low', impactReason: 'No major market-impact terms identified in the headline or summary' };
}

function decodeXml(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ')
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function rssTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

async function getFederalReserveArticles(fromMs, toMs) {
  const results = await Promise.allSettled(FED_FEEDS.map(async url => {
    const response = await fetch(url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
    if (!response.ok) throw new Error(`Federal Reserve feed request failed (${response.status})`);
    return response.text();
  }));
  const feeds = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  if (!feeds.length) throw new Error('No Federal Reserve feeds responded.');
  const articles = feeds.flatMap(xml => [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([, item]) => {
    const title = rssTag(item, 'title');
    const url = rssTag(item, 'link');
    const description = rssTag(item, 'description');
    const publishedAt = rssTag(item, 'pubDate');
    const imageMatch = item.match(/<(?:media:content|enclosure)\b[^>]*url=["']([^"']+)["']/i);
    const image = imageMatch ? decodeXml(imageMatch[1]) : '';
    return { title, url, description, image, publishedAt, source: { name: 'Federal Reserve', url: 'https://www.federalreserve.gov' } };
  })).filter(article => {
    if (!article.title || !article.url) return false;
    const published = Date.parse(article.publishedAt);
    if ((fromMs !== null || toMs !== null) && !Number.isFinite(published)) return false;
    if (Number.isFinite(fromMs) && published < fromMs) return false;
    if (Number.isFinite(toMs) && published > toMs) return false;
    return true;
  }).map(article => ({ ...article, ...assessImpact(article) }))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return articles.slice(0, 30);
}

async function getCnbcFedArticles(apiKey, from, to, fromMs, toMs) {
  const params = new URLSearchParams({ q: CNBC_FED_QUERY, lang: 'en', max: '10', sortby: 'publishedAt' });
  const freshnessFloor = Date.now() - 12 * 60 * 60 * 1000;
  const providerCanSearchRange = fromMs === null || fromMs <= freshnessFloor;
  if (from && providerCanSearchRange) params.set('from', from);
  if (to && providerCanSearchRange) params.set('to', to);
  const response = await fetch(`https://gnews.io/api/v4/search?${params}`, { headers: { 'X-Api-Key': apiKey } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.errors?.[0] || `GNews request failed (${response.status})`);
  return (payload.articles || []).filter(article => {
    if (!article.title || !article.url) return false;
    let url;
    try { url = new URL(article.url); } catch { return false; }
    if (url.hostname !== 'cnbc.com' && !url.hostname.endsWith('.cnbc.com')) return false;
    if (!CNBC_FED_RELEVANCE.test(`${article.title} ${article.description || ''} ${article.content || ''}`)) return false;
    const published = Date.parse(article.publishedAt || '');
    if ((fromMs !== null || toMs !== null) && !Number.isFinite(published)) return false;
    if (Number.isFinite(fromMs) && published < fromMs) return false;
    if (Number.isFinite(toMs) && published > toMs) return false;
    return true;
  }).map(article => {
    const normalized = { title: article.title, description: article.description, content: article.content, url: article.url, image: article.image, publishedAt: article.publishedAt, source: article.source };
    return { ...normalized, ...assessImpact(normalized) };
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET to search news.' });
  const pair = String(req.query.pair || '').toUpperCase();
  const pairQuery = PAIRS[pair]?.[0];
  if (!pairQuery) return res.status(400).json({ error: 'Choose a supported market.' });
  const source = String(req.query.source || 'all');
  if (!['all', 'fed', 'fed-cnbc'].includes(source)) return res.status(400).json({ error: 'Choose a supported news source.' });
  const from = req.query.from ? String(req.query.from) : '';
  const to = req.query.to ? String(req.query.to) : '';
  const fromMs = from ? Date.parse(from) : null;
  const toMs = to ? Date.parse(to) : null;
  if ((from && (!Number.isFinite(fromMs) || new Date(fromMs).toISOString() !== from)) ||
      (to && (!Number.isFinite(toMs) || new Date(toMs).toISOString() !== to)) ||
      (fromMs !== null && toMs !== null && fromMs > toMs)) {
    return res.status(400).json({ error: 'The selected date range is invalid.' });
  }
  if (source === 'fed' || source === 'fed-cnbc') {
    try {
      const fedArticles = await getFederalReserveArticles(fromMs, toMs);
      if (source === 'fed') return res.status(200).json({ pair, source, from, to, articles: fedArticles });
      const apiKey = process.env.GNEWS_API_KEY;
      if (!apiKey) return res.status(200).json({ pair, source, from, to, articles: fedArticles, warning: 'CNBC coverage needs GNEWS_API_KEY. Showing official Federal Reserve items only.' });
      try {
        const cnbcArticles = await getCnbcFedArticles(apiKey, from, to, fromMs, toMs);
        const byUrl = new Map([...fedArticles, ...cnbcArticles].map(article => [article.url, article]));
        const articles = [...byUrl.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
        return res.status(200).json({ pair, source, from, to, articles });
      } catch {
        return res.status(200).json({ pair, source, from, to, articles: fedArticles, warning: 'CNBC could not be reached right now. Showing official Federal Reserve items only.' });
      }
    } catch {
      return res.status(502).json({ error: 'Could not load Federal Reserve RSS feeds. Open the official News & Events calendar and try again later.' });
    }
  }
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Live news is not configured. Locally, add GNEWS_API_KEY to .env.local and restart Vite. On Vercel, add it in Project Settings → Environment Variables, then redeploy.' });
  const params = new URLSearchParams({ q: pairQuery, lang: 'en', max: '10', sortby: 'publishedAt' });
  // GNews Free cannot return articles from the most recent 12 hours. Avoid
  // sending an inverted interval for short ranges; filter the fetched articles below.
  const freeFreshnessFloor = Date.now() - 12 * 60 * 60 * 1000;
  const providerCanSearchRange = fromMs === null || fromMs <= freeFreshnessFloor;
  if (from && providerCanSearchRange) params.set('from', from);
  if (to && providerCanSearchRange) params.set('to', to);
  try {
    const upstream = await fetch(`https://gnews.io/api/v4/search?${params}`, { headers: { 'X-Api-Key': apiKey } });
    const payload = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status === 429 ? 429 : 502).json({ error: payload.errors?.[0] || 'The news provider could not complete this search.' });
    const articles = (payload.articles || []).filter(a => {
      if (!a.title || !a.url) return false;
      let url;
      try { url = new URL(a.url); } catch { return false; }
      const published = Date.parse(a.publishedAt || '');
      if ((fromMs !== null || toMs !== null) && !Number.isFinite(published)) return false;
      if (Number.isFinite(fromMs) && published < fromMs) return false;
      if (Number.isFinite(toMs) && published > toMs) return false;
      return true;
    }).map(a => {
      const normalized = { title: a.title, description: a.description, content: a.content, url: a.url, image: a.image, publishedAt: a.publishedAt, source: a.source };
      return { ...normalized, ...assessImpact(normalized) };
    });
    return res.status(200).json({ pair, source, from, to, articles });
  } catch { return res.status(502).json({ error: 'Could not connect to the news provider. Try again shortly.' }); }
}
