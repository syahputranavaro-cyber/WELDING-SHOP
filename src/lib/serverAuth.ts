import crypto from 'crypto';

const DEFAULT_ADMIN_EMAIL = 'admin@welding.local';
const DEFAULT_ADMIN_PASSWORD = 'welding23';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

// Rate limiter ringan untuk melindungi /api/auth/login dari percobaan brute-force
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 menit
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttemptsMap = new Map<string, { count: number; resetAt: number }>();

export function extractClientIp(
  headers: Record<string, string | string[] | undefined>,
  fallbackIp?: string
): string {
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0 && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return fallbackIp || 'unknown';
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  // Bersihkan entri kadaluarsa bila map membesar
  if (loginAttemptsMap.size > 500) {
    for (const [key, entry] of loginAttemptsMap.entries()) {
      if (now >= entry.resetAt) loginAttemptsMap.delete(key);
    }
  }
  const record = loginAttemptsMap.get(ip);
  if (!record || now >= record.resetAt) {
    if (record) loginAttemptsMap.delete(ip);
    return { allowed: true };
  }
  if (record.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true };
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const record = loginAttemptsMap.get(ip);
  if (!record || now >= record.resetAt) {
    loginAttemptsMap.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    record.count += 1;
  }
}

export function clearLoginFailures(ip: string): void {
  loginAttemptsMap.delete(ip);
}

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
    process.env.SUPABASE_SECRET_KEY ||
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
