import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

export interface PasswordValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates password complexity:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one numeric digit
 * - At least one special character
 */
export const validatePasswordPolicy = (password: string): PasswordValidationResult => {
  if (!password || typeof password !== 'string') {
    return { valid: false, reason: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long' };
  }

  if (password.length > 128) {
    return { valid: false, reason: 'Password cannot exceed 128 characters' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one numeric digit' };
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one special character' };
  }

  return { valid: true };
};

/**
 * Hashes a plaintext password using bcryptjs with work factor >= 12.
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

/**
 * Securely compares a candidate plaintext password against an existing hash.
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
};

