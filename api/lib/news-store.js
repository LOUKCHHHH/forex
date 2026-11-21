import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const PAGE_SIZE = 10;
let client;
let schemaReady;

function getClient() {
  if (!process.env.DATABASE_URL) return null;
  client ||= neon(process.env.DATABASE_URL);
  return client;
}

async function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS mcfx_news_articles (
        id BIGSERIAL PRIMARY KEY,
        dedup_key TEXT NOT NULL UNIQUE,
        canonical_url TEXT NOT NULL,
        article JSONB NOT NULL,
        published_at TIMESTAMPTZ,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS mcfx_news_queries (
        article_id BIGINT NOT NULL REFERENCES mcfx_news_articles(id) ON DELETE CASCADE,
        market_code TEXT NOT NULL,
        feed TEXT NOT NULL,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (article_id, market_code, feed)
      )`;
      await sql`CREATE INDEX IF NOT EXISTS mcfx_news_query_lookup ON mcfx_news_queries (market_code, feed, article_id)`;
      await sql`CREATE INDEX IF NOT EXISTS mcfx_news_published_at ON mcfx_news_articles (published_at DESC)`;
    })().catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function canonicalizeUrl(value) {
  const url = new URL(value);
  if (url.protocol === 'http:') url.protocol = 'https:';
  url.hash = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid|ref)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

function articleKey(article, feed, canonicalUrl) {
  const identity = feed === 'forexfactory'
    ? `${article.eventCurrency || ''}|${article.title || ''}|${article.publishedAt || ''}`
    : canonicalUrl;
  return createHash('sha256').update(identity.toLowerCase()).digest('hex');
}

function fallbackPage(articles, page, completeCollection) {
  return completeCollection ? articles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : articles;
}

export async function persistAndListNews({ articles, pair, feed, page, fromMs, toMs, totalArticles, completeCollection = false }) {
  const fallback = {
    articles: fallbackPage(articles, page, completeCollection),
    totalArticles: totalArticles ?? articles.length,
    page,
    pageSize: PAGE_SIZE,
    persisted: false,
  };
  const sql = getClient();
  if (!sql) return { ...fallback, warning: 'News database is not connected yet. Results are not being saved between searches.' };

  try {
    await ensureSchema(sql);
    for (const article of articles) {
      if (!article.url || !article.title) continue;
      let canonicalUrl;
      try { canonicalUrl = canonicalizeUrl(article.url); } catch { continue; }
      const key = articleKey(article, feed, canonicalUrl);
      const publishedAt = Date.parse(article.publishedAt || '');
      const inserted = await sql`
        INSERT INTO mcfx_news_articles (dedup_key, canonical_url, article, published_at)
        VALUES (${key}, ${canonicalUrl}, ${JSON.stringify(article)}::jsonb, ${Number.isFinite(publishedAt) ? new Date(publishedAt) : null})
        ON CONFLICT (dedup_key) DO UPDATE SET
          canonical_url = EXCLUDED.canonical_url,
          article = EXCLUDED.article,
          published_at = EXCLUDED.published_at,
          last_seen_at = NOW()
        RETURNING id
      `;
      await sql`
        INSERT INTO mcfx_news_queries (article_id, market_code, feed)
        VALUES (${inserted[0].id}, ${pair}, ${feed})
        ON CONFLICT (article_id, market_code, feed) DO UPDATE SET last_seen_at = NOW()
      `;
    }

    const from = fromMs === null ? null : new Date(fromMs);
    const to = toMs === null ? null : new Date(toMs);
    const rows = await sql`
      SELECT n.article
      FROM mcfx_news_articles n
      JOIN mcfx_news_queries q ON q.article_id = n.id
      WHERE q.market_code = ${pair} AND q.feed = ${feed}
        AND (${from}::timestamptz IS NULL OR n.published_at >= ${from}::timestamptz)
        AND (${to}::timestamptz IS NULL OR n.published_at <= ${to}::timestamptz)
      ORDER BY
        CASE WHEN ${feed} = 'forexfactory' THEN n.published_at END ASC,
        CASE WHEN ${feed} <> 'forexfactory' THEN n.published_at END DESC,
        n.id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `;
    const [countRow] = await sql`
      SELECT COUNT(*)::int AS count
      FROM mcfx_news_articles n
      JOIN mcfx_news_queries q ON q.article_id = n.id
      WHERE q.market_code = ${pair} AND q.feed = ${feed}
        AND (${from}::timestamptz IS NULL OR n.published_at >= ${from}::timestamptz)
        AND (${to}::timestamptz IS NULL OR n.published_at <= ${to}::timestamptz)
    `;
    return {
      articles: rows.map(row => row.article),
      totalArticles: Math.max(Number(countRow.count) || 0, Number(totalArticles) || 0),
      page,
      pageSize: PAGE_SIZE,
      persisted: true,
    };
  } catch (error) {
    console.error('News persistence failed:', error?.message || error);
    return { ...fallback, warning: 'News storage is temporarily unavailable. Showing live results without saving them.' };
  }
}

export async function listStoredNews({ pair, feed, page = 1, fromMs = null, toMs = null }) {
  const sql = getClient();
  if (!sql) return { articles: [], totalArticles: 0, page, pageSize: PAGE_SIZE, persisted: false, warning: 'News database is not connected yet. No saved results are available.' };

  try {
    await ensureSchema(sql);
    const from = fromMs === null ? null : new Date(fromMs);
    const to = toMs === null ? null : new Date(toMs);
    const rows = await sql`
      SELECT n.article
      FROM mcfx_news_articles n
      JOIN mcfx_news_queries q ON q.article_id = n.id
      WHERE q.market_code = ${pair} AND q.feed = ${feed}
        AND (${from}::timestamptz IS NULL OR n.published_at >= ${from}::timestamptz)
        AND (${to}::timestamptz IS NULL OR n.published_at <= ${to}::timestamptz)
      ORDER BY
        CASE WHEN ${feed} = 'forexfactory' THEN n.published_at END ASC,
        CASE WHEN ${feed} <> 'forexfactory' THEN n.published_at END DESC,
        n.id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `;
    const [countRow] = await sql`
      SELECT COUNT(*)::int AS count
      FROM mcfx_news_articles n
      JOIN mcfx_news_queries q ON q.article_id = n.id
      WHERE q.market_code = ${pair} AND q.feed = ${feed}
        AND (${from}::timestamptz IS NULL OR n.published_at >= ${from}::timestamptz)
        AND (${to}::timestamptz IS NULL OR n.published_at <= ${to}::timestamptz)
    `;
    return { articles: rows.map(row => row.article), totalArticles: Number(countRow.count) || 0, page, pageSize: PAGE_SIZE, persisted: true };
  } catch (error) {
    console.error('Saved news lookup failed:', error?.message || error);
    return { articles: [], totalArticles: 0, page, pageSize: PAGE_SIZE, persisted: false, warning: 'Saved news could not be loaded right now.' };
  }
}
