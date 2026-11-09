import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { User, UserRole, AccountStatus } from '../models/User.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accountStatus: AccountStatus;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Extracts and verifies the Bearer JWT access token from the Authorization header.
 * Resolves the user from the database and confirms the account is active.
 */
export const requireAuthentication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Authentication token missing or invalid Bearer format'
    });
    return;
  }

  const token = authHeader.split(' ')[1]?.trim();
  if (!token) {
    res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Token string cannot be empty'
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    // Resolve authoritative user state from MongoDB
    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'Account associated with this token no longer exists'
      });
      return;
    }

    if (user.accountStatus !== 'active') {
      res.status(403).json({
        status: 'error',
        code: 'ACCOUNT_SUSPENDED',
        message: `Account is ${user.accountStatus}. Access denied.`
      });
      return;
    }

    // Attach verified user context to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      accountStatus: user.accountStatus
    };

    next();
  } catch (err: unknown) {
    const errorName = err && typeof err === 'object' && 'name' in err ? (err as { name: string }).name : '';
    if (errorName === 'TokenExpiredError') {
      res.status(401).json({
        status: 'error',
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired. Please refresh your session.'
      });
      return;
    }

    res.status(401).json({
      status: 'error',
      code: 'INVALID_TOKEN',
      message: 'Access token signature or format is invalid'
    });
  }
};

/**
 * Optional authentication: extracts user identity if valid Bearer token is provided,
 * but allows unauthenticated requests to proceed without error.
 */
export const optionalAuthentication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1]?.trim();
  if (!token) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.accountStatus === 'active') {
      req.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        accountStatus: user.accountStatus
      };
    }
  } catch (_) {
    // Ignore invalid/expired token in optional authentication mode
  }

  next();
};

/**
 * Enforces role-based access control against the authoritative database role.
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN_ROLE',
        message: `Access denied. Authorized roles: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'`
      });
      return;
    }

    next();
  };
};

/**
 * Verifies that the user account is in 'active' status.
 */
export const requireActiveAccount = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.accountStatus !== 'active') {
    res.status(403).json({
      status: 'error',
      code: 'ACCOUNT_SUSPENDED',
      message: `Account is ${req.user.accountStatus}`
    });
    return;
  }

  next();
};

