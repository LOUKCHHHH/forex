import { neon } from '@neondatabase/serverless';
import { timingSafeEqual } from 'node:crypto';

let client;
let schemaReady;

function getClient() {
  if (!process.env.DATABASE_URL) return null;
  client ||= neon(process.env.DATABASE_URL);
  return client;
}

async function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = sql`CREATE TABLE IF NOT EXISTS mcfx_notes (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`.catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function validText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function secureEqual(candidate, expected) {
  const left = Buffer.from(String(candidate || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const expectedUsername = process.env.MCFX_USERNAME;
  const expectedPassword = process.env.MCFX_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    return res.status(503).json({ error: 'Notes access is not configured. Set MCFX_USERNAME and MCFX_PASSWORD in the server environment.' });
  }
  if (!secureEqual(req.headers?.['x-mcfx-username'], expectedUsername) || !secureEqual(req.headers?.['x-mcfx-password'], expectedPassword)) {
    return res.status(401).json({ error: 'Sign in with the shared MCFX account to access notes.' });
  }

  const sql = getClient();
  if (!sql) return res.status(503).json({ error: 'Notes storage is not configured. Connect DATABASE_URL to the app.' });

  try {
    await ensureSchema(sql);
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, title, description, created_at AS "createdAt", updated_at AS "updatedAt" FROM mcfx_notes ORDER BY updated_at DESC, id DESC`;
      return res.status(200).json({ notes: rows });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (req.method === 'POST') {
      if (!validText(body.title, 200) || !validText(body.description, 10000)) {
        return res.status(400).json({ error: 'Add a title (up to 200 characters) and description (up to 10,000 characters).' });
      }
      const [note] = await sql`INSERT INTO mcfx_notes (title, description) VALUES (${body.title.trim()}, ${body.description.trim()}) RETURNING id, title, description, created_at AS "createdAt", updated_at AS "updatedAt"`;
      return res.status(201).json({ note });
    }

    const id = validId(req.query.id);
    if (!id) return res.status(400).json({ error: 'Choose a valid note.' });
    if (req.method === 'PATCH') {
      if (!validText(body.title, 200) || !validText(body.description, 10000)) {
        return res.status(400).json({ error: 'Add a title (up to 200 characters) and description (up to 10,000 characters).' });
      }
      const rows = await sql`UPDATE mcfx_notes SET title = ${body.title.trim()}, description = ${body.description.trim()}, updated_at = NOW() WHERE id = ${id} RETURNING id, title, description, created_at AS "createdAt", updated_at AS "updatedAt"`;
      if (!rows.length) return res.status(404).json({ error: 'Note not found.' });
      return res.status(200).json({ note: rows[0] });
    }

    const rows = await sql`DELETE FROM mcfx_notes WHERE id = ${id} RETURNING id`;
    if (!rows.length) return res.status(404).json({ error: 'Note not found.' });
    return res.status(200).json({ deleted: true, id });
  } catch (error) {
    console.error('Notes API failed:', error?.message || error);
    return res.status(500).json({ error: 'Notes could not be loaded or saved right now.' });
  }
}
