import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { supabaseAnon } from '../config/supabase';

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 */
export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Not authenticated.' });
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ success: false, error: 'Invalid session.' });
    return;
  }

  res.json({
    success: true,
    data: {
      id: data.user.id,
      email: data.user.email,
      fullName: data.user.user_metadata?.full_name ?? null,
      avatarUrl: data.user.user_metadata?.avatar_url ?? null,
    },
  });
}

/**
 * POST /api/auth/verify
 * Verifies a JWT token is still valid. Used by client to check session integrity.
 */
export async function verifyToken(req: Request, res: Response): Promise<void> {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ success: false, error: 'Token is required.' });
    return;
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);

  res.json({
    success: !error && !!data.user,
    data: { valid: !error && !!data.user },
  });
}
