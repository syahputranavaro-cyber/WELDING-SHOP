import crypto from 'crypto';

const DEFAULT_ADMIN_EMAIL = 'admin@welding.local';
const DEFAULT_ADMIN_PASSWORD = 'welding23';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

function getAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

function getSigningSecret(): string {
  const base =
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    `welding-shop-pkt-${getAdminPassword()}`;
  return crypto.createHash('sha256').update(`pkt-ws-hmac-v1:${base}`).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyAdminCredentials(email: unknown, password: unknown): boolean {
  if (typeof email !== 'string' || typeof password !== 'string') return false;
  const normalizedEmail = email.trim().toLowerCase();
  return safeEqual(normalizedEmail, getAdminEmail()) && safeEqual(password, getAdminPassword());
}

export function createAdminToken(email: string): { token: string; expiresAt: string } {
  const now = Date.now();
  const exp = now + TOKEN_TTL_MS;
  const payloadObj = {
    sub: email.trim().toLowerCase(),
    role: 'admin',
    iat: now,
    exp,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf-8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payloadB64)
    .digest('base64url');

  return {
    token: `${payloadB64}.${signature}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

export function verifyAdminToken(token: string | null | undefined): {
  valid: boolean;
  email?: string;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token otorisasi tidak ditemukan' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Format token tidak valid' };
  }

  const [payloadB64, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payloadB64)
    .digest('base64url');

  if (!safeEqual(providedSig, expectedSig)) {
    return { valid: false, error: 'Signature token tidak valid' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (!decoded || decoded.role !== 'admin' || typeof decoded.sub !== 'string') {
      return { valid: false, error: 'Payload token tidak valid' };
    }
    if (typeof decoded.exp !== 'number' || Date.now() > decoded.exp) {
      return { valid: false, error: 'Sesi login telah kedaluwarsa. Silakan login kembali.' };
    }
    return { valid: true, email: decoded.sub };
  } catch {
    return { valid: false, error: 'Gagal membaca token otorisasi' };
  }
}

export function verifyAdminAuthHeader(authHeader: string | string[] | undefined): {
  valid: boolean;
  email?: string;
  error?: string;
} {
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Akses ditolak. Silakan login sebagai Admin terlebih dahulu.' };
  }
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    return { valid: false, error: 'Header otorisasi tidak valid.' };
  }
  return verifyAdminToken(match[1]);
}
