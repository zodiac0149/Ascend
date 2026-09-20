import type { Request, Response, NextFunction } from 'express';
import { supabaseAnon } from '../config/supabase';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/**
 * Validates the Supabase JWT from the Authorization header.
 * Attaches userId and userEmail to the request object.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header.' });
    return;
  }

  const token = authHeader.slice(7);

  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
    return;
  }

  req.userId = data.user.id;
  req.userEmail = data.user.email ?? undefined;
  next();
}

/**
 * Optional auth middleware — attaches userId if token is present,
 * but does not block unauthenticated requests.
 * Use on routes that serve both guests and authenticated users.
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await supabaseAnon.auth.getUser(token);
    if (data.user) {
      req.userId = data.user.id;
      req.userEmail = data.user.email ?? undefined;
    }
  }

  next();
}
