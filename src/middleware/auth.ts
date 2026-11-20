import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  } else if (typeof req.query.token === 'string' && req.query.token.trim()) {
    // Allow query token specifically for EventSource (SSE) connections
    token = req.query.token.trim();
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    // Ensure authenticated user exists in PostgreSQL users table
    try {
      await getOrCreateUser(
        decodedToken.uid,
        decodedToken.email || '',
        decodedToken.name || undefined
      );
    } catch (syncErr) {
      console.error('Non-fatal user sync error:', syncErr);
    }

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};
