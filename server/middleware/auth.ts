import jwt from 'jsonwebtoken';

// v3.0.3.31: 修复 JWT_SECRET 硬编码 + 移除 DEV-MODE 超级管理员旁路
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in all environments');
}
const SECRET = JWT_SECRET;

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; department: string };
    }
  }
}

export function authMiddleware(req: any, res: any, next: () => void) {
  const authHeader = req.headers.authorization;

  // v3.0.3.31: 所有环境都需要 token - 移除 DEV-MODE 旁路
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token is empty' } });
  }

  try {
    const decoded = jwt.verify(token, SECRET) as { id: string; role: string; department: string };
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token verification failed' } });
  }
}
