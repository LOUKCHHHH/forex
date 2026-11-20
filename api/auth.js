import { pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2 = promisify(pbkdf2Callback);
const CREDENTIALS_KEY = 'fxbrief:shared-auth:credentials';
const SESSION_PREFIX = 'fxbrief:shared-auth:session:';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_USERNAME = 'mc';
const DEFAULT_PASSWORD = 'mc1234';

function redisSettings() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function redisCommand(settings, command) {
  const response = await fetch(settings.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error('Shared login storage request failed.');
  return payload.result;
}

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = await pbkdf2(password, salt, 210000, 32, 'sha256');
  return { salt, hash: hash.toString('hex') };
}

async function readCredentials(settings) {
  let stored = await redisCommand(settings, ['GET', CREDENTIALS_KEY]);
  if (!stored) {
    const initial = await hashPassword(DEFAULT_PASSWORD);
    await redisCommand(settings, ['SET', CREDENTIALS_KEY, JSON.stringify({
      username: DEFAULT_USERNAME, salt: initial.salt, passwordHash: initial.hash, version: 1,
    }), 'NX']);
    stored = await redisCommand(settings, ['GET', CREDENTIALS_KEY]);
  }
  const credentials = JSON.parse(stored);
  if (!credentials?.username || !credentials?.salt || !credentials?.passwordHash) throw new Error('Shared login storage is not initialized correctly.');
  return { ...credentials, version: Number(credentials.version) || 1 };
}

async function passwordMatches(password, credentials) {
  const actual = await pbkdf2(password, credentials.salt, 210000, 32, 'sha256');
  const expected = Buffer.from(credentials.passwordHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sessionToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const raw = cookieHeader.split(';').map(item => item.trim()).find(item => item.startsWith('fxbrief_session='));
  return raw ? decodeURIComponent(raw.slice('fxbrief_session='.length)) : '';
}

function cookieHeader(req, token, maxAge = SESSION_SECONDS) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `fxbrief_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function response(res, code, body) {
  return res.status(code).json(body);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const settings = redisSettings();
  if (!settings) return response(res, 503, { error: 'Shared login storage is not configured. Connect Upstash Redis to the Vercel project.' });

  try {
    const credentials = await readCredentials(settings);
    const token = sessionToken(req);
    const sessionKey = token ? `${SESSION_PREFIX}${token}` : '';
    const storedSession = sessionKey ? await redisCommand(settings, ['GET', sessionKey]) : null;
    let session = null;
    try { session = storedSession ? JSON.parse(storedSession) : null; } catch {}
    const authenticated = Boolean(session && session.version === credentials.version);

    if (req.method === 'GET') return response(res, 200, { authenticated, username: authenticated ? credentials.username : '' });
    if (req.method !== 'POST') return response(res, 405, { error: 'Use GET or POST.' });
    if (!req.headers['content-type']?.includes('application/json')) return response(res, 415, { error: 'Send JSON request data.' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (body.action === 'login') {
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (username !== credentials.username || !(await passwordMatches(password, credentials))) return response(res, 401, { error: 'Incorrect username or password.' });
      const nextToken = randomBytes(32).toString('hex');
      await redisCommand(settings, ['SET', `${SESSION_PREFIX}${nextToken}`, JSON.stringify({ version: credentials.version }), 'EX', SESSION_SECONDS]);
      res.setHeader('Set-Cookie', cookieHeader(req, nextToken));
      return response(res, 200, { authenticated: true, username: credentials.username });
    }

    if (body.action === 'logout') {
      if (sessionKey) await redisCommand(settings, ['DEL', sessionKey]);
      res.setHeader('Set-Cookie', cookieHeader(req, '', 0));
      return response(res, 200, { authenticated: false });
    }

    if (body.action === 'update') {
      if (!authenticated) return response(res, 401, { error: 'Your sign-in has expired. Sign in again before changing login details.' });
      const username = String(body.username || '').trim();
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      if (!await passwordMatches(currentPassword, credentials)) return response(res, 400, { error: 'Current password is incorrect.' });
      if (!username || username.length > 40) return response(res, 400, { error: 'Username must be between 1 and 40 characters.' });
      if (newPassword.length < 6 || newPassword.length > 200) return response(res, 400, { error: 'Password must be between 6 and 200 characters.' });
      const next = await hashPassword(newPassword);
      const updated = { username, salt: next.salt, passwordHash: next.hash, version: credentials.version + 1 };
      await redisCommand(settings, ['SET', CREDENTIALS_KEY, JSON.stringify(updated)]);
      await redisCommand(settings, ['SET', sessionKey, JSON.stringify({ version: updated.version }), 'EX', SESSION_SECONDS]);
      return response(res, 200, { authenticated: true, username });
    }

    return response(res, 400, { error: 'Unknown authentication action.' });
  } catch (error) {
    console.error('Shared authentication failed:', error?.message || error);
    return response(res, 503, { error: 'Could not reach shared login storage. Check the Upstash Redis connection and try again.' });
  }
}
