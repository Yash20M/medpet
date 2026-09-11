import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../../shared/config/database';
import { EmailService } from '../../shared/email/email.service';
import {
  RegisterDto, LoginDto, UpdateProfileDto,
  AuthPayload, AuthUser, UserRow,
} from './auth.types';

const SALT_ROUNDS = 12;

// Invite / reset links stay valid for 3 days.
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 3;

const hashToken = (raw: string): string =>
  crypto.createHash('sha256').update(raw).digest('hex');

/** Public URL a reset/invite link should point at (the backend serves the page). */
export const buildResetUrl = (rawToken: string): string => {
  const base = (process.env.PUBLIC_APP_URL ?? `http://localhost:${process.env.PORT ?? 5000}`).replace(/\/$/, '');
  return `${base}/reset-password?token=${rawToken}`;
};

/**
 * Issue a fresh single-use reset token for a user and persist its hash + expiry.
 * Returns the RAW token (only ever exposed via the emailed link / dev fallback).
 * Shared by "forgot password" and delivery-partner onboarding.
 */
export const issueResetToken = async (userId: number, ttlMs = RESET_TOKEN_TTL_MS): Promise<string> => {
  const raw = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + ttlMs);
  await db.query(
    'UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3',
    [hashToken(raw), expires, userId]
  );
  return raw;
};

const signToken = (id: number): string =>
  jwt.sign(
    { id },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'] }
  );

const safeUser = (row: UserRow): AuthUser => {
  const { password: _pwd, is_active: _active, ...user } = row;
  return user;
};

export const AuthService = {
  async register(dto: RegisterDto): Promise<AuthPayload> {
    const existing = await db.query<{ id: number }>(
      'SELECT id FROM users WHERE email = $1',
      [dto.email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      throw Object.assign(new Error('Email already registered.'), { statusCode: 409 });
    }

    const hashed = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const { rows } = await db.query<UserRow>(
      `INSERT INTO users (name, email, password, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, password, phone, role, avatar_url, is_active, created_at`,
      [dto.name.trim(), dto.email.toLowerCase(), hashed, dto.phone ?? null]
    );

    const user = safeUser(rows[0]);
    return { token: signToken(user.id), user };
  },

  async login(dto: LoginDto): Promise<AuthPayload> {
    const { rows } = await db.query<UserRow>(
      `SELECT id, name, email, password, phone, role, avatar_url, is_active, created_at
       FROM users WHERE email = $1`,
      [dto.email.toLowerCase()]
    );

    if (rows.length === 0) {
      throw Object.assign(new Error('Invalid email or password.'), { statusCode: 401 });
    }

    const row = rows[0];
    if (!row.is_active) {
      throw Object.assign(new Error('Account deactivated. Contact support.'), { statusCode: 403 });
    }

    const isMatch = await bcrypt.compare(dto.password, row.password);
    if (!isMatch) {
      throw Object.assign(new Error('Invalid email or password.'), { statusCode: 401 });
    }

    const user = safeUser(row);
    return { token: signToken(user.id), user };
  },

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<AuthUser> {
    const { rows } = await db.query<UserRow>(
      `UPDATE users
       SET name = COALESCE($1, name), phone = COALESCE($2, phone)
       WHERE id = $3
       RETURNING id, name, email, password, phone, role, avatar_url, is_active, created_at`,
      [dto.name?.trim() ?? null, dto.phone?.trim() ?? null, userId]
    );

    return safeUser(rows[0]);
  },

  /**
   * Start a password reset. Always resolves the same way regardless of whether
   * the email exists, so the endpoint can't be used to enumerate accounts.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const { rows } = await db.query<{ id: number; name: string; email: string }>(
      'SELECT id, name, email FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user) return;

    const raw = await issueResetToken(user.id);
    const url = buildResetUrl(raw);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    // Fire-and-forget — never log the raw token; EmailService's own logs mask
    // the recipient and never touch the URL/body.
    EmailService.sendPasswordResetEmail(user.id, user.name, user.email, url, expiresAt).catch((err) =>
      console.error(`📧 Failed to send password-reset email for user ${user.id}:`, (err as Error).message)
    );
  },

  /** Consume a reset token and set a new password. Also (re)activates the account. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { rows } = await db.query<{ id: number }>(
      `SELECT id FROM users
       WHERE reset_token_hash = $1 AND reset_token_expires > NOW()`,
      [hashToken(token)]
    );
    const user = rows[0];
    if (!user) {
      throw Object.assign(new Error('This reset link is invalid or has expired.'), { statusCode: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query(
      `UPDATE users
       SET password = $1, reset_token_hash = NULL, reset_token_expires = NULL, is_active = true
       WHERE id = $2`,
      [hashed, user.id]
    );
  },
};
