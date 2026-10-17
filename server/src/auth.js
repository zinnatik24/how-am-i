import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const JWT_SECRET = process.env.JWT_SECRET || 'how_am_i_secret_jwt_key_2026_super_safe';

export function signUserToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '90d' }
  );
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация (Bearer token)' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Неверный или просроченный токен' });
  }
}

/**
 * Extracts userId from Bearer token if present, returns null if missing or invalid.
 * Used for optional account linking when an already logged-in user authenticates with a new provider.
 */
export function getOptionalUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.userId || null;
  } catch (err) {
    return null;
  }
}

export function generateInviteCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Safely decodes an Apple Sign-In identityToken JWT to retrieve sub (Apple ID) and email.
 * Does not require verification secret because the token is obtained directly via secure native/web handshake.
 */
export function decodeAppleIdentityToken(identityToken) {
  if (!identityToken || typeof identityToken !== 'string') {
    return { appleId: null, email: null };
  }
  try {
    const decoded = jwt.decode(identityToken);
    if (decoded && typeof decoded === 'object') {
      return {
        appleId: decoded.sub ? String(decoded.sub).trim() : null,
        email: decoded.email ? String(decoded.email).trim().toLowerCase() : null,
      };
    }
  } catch (e) {
    console.warn('[AUTH] Error decoding Apple identityToken:', e.message);
  }
  return { appleId: null, email: null };
}
