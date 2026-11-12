import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { db } from '../db/knex';
import {
  clearAuthCookies,
  clearGuestCookie,
  ensureGuestCookie,
  requireAuth,
  setAuthCookies,
  refreshAuthCookies,
  restoreAuthSession,
  invalidateAuthUser,
  userNameFromUsername,
} from '../middleware/auth';
import { validateBody, asyncHandler, HttpError } from '../middleware/common';
import { User } from '../types';
import {
  rateLimit,
  requestIdentity,
  requestIp,
} from '../middleware/rateLimit';
import { invalidateCached } from '../services/queryCache';
import { leaderboardCacheKey } from '../services/leaderboardCache';
import { hashPassword, passwordNeedsRehash, verifyPassword } from '../services/password';
import { DIFFICULTY_LEVELS } from '../difficulties';
import { allGlobalStatsCacheKeys, allPersonalStatsCacheKeys } from '../services/statsCache';
import { GeeTestVerificationError } from '../services/geetest';
import { verifyRegistrationCaptcha } from '../services/captcha';
import { TurnstileVerificationError } from '../services/turnstile';
import { claimDailyChallengeAttempts } from '../services/dailyChallenge';

const router = Router();

const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 20;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;
const USERNAME_PATTERN = /^[\w一-龥-]+$/;

const credentialsSchema = z.object({
  username: z
    .string()
    .min(USERNAME_MIN_LENGTH)
    .max(USERNAME_MAX_LENGTH)
    .regex(USERNAME_PATTERN),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});
const geeTestFields = {
  lot_number: z.string().trim().optional(),
  captcha_output: z.string().trim().optional(),
  pass_token: z.string().trim().optional(),
  gen_time: z.string().trim().optional(),
};
const turnstileFields = { turnstile_token: z.string().trim().optional() };
const registerSchema = credentialsSchema.extend({ ...geeTestFields, ...turnstileFields });

function validateRegisterBody(req: Request, res: Response, next: NextFunction) {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    const body = req.body && typeof req.body === 'object'
      ? req.body as Record<string, unknown>
      : {};
    const username = body.username;
    const password = body.password;
    let code = 'VALIDATION_FAILED';
    if (typeof username !== 'string' || username.length === 0) {
      code = 'REGISTER_USERNAME_REQUIRED';
    } else if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
      code = 'REGISTER_USERNAME_LENGTH';
    } else if (!USERNAME_PATTERN.test(username)) {
      code = 'REGISTER_USERNAME_CHARACTERS';
    } else if (typeof password !== 'string' || password.length === 0) {
      code = 'REGISTER_PASSWORD_REQUIRED';
    } else if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      code = 'REGISTER_PASSWORD_LENGTH';
    }
    return res.status(400).json({ code });
  }
  req.body = result.data;
  next();
}

function publicUser(user: { id: number; username: string; role: 'user' | 'admin' }) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

router.post(
  '/register',
  rateLimit({ name: 'register', limit: 3, windowSeconds: 3600, failClosed: true }),
  validateRegisterBody,
  asyncHandler(async (req, res) => {
    const {
      username,
      password,
      lot_number,
      captcha_output,
      pass_token,
      gen_time,
      turnstile_token,
    } = req.body;
    try {
      await verifyRegistrationCaptcha(
        {
          turnstileToken: turnstile_token,
          geeTest: { lot_number, captcha_output, pass_token, gen_time },
        },
        requestIp(req)
      );
    } catch (error) {
      if (error instanceof TurnstileVerificationError || error instanceof GeeTestVerificationError) {
        throw new HttpError(400, error.code);
      }
      throw error;
    }
    const existing = await db<User>('users').where({ username }).first();
    if (existing) throw new HttpError(409, 'USERNAME_TAKEN');

    const role = 'user' as const;

    const [id] = await db('users')
      .insert({
        username,
        display_id: userNameFromUsername(username),
        password_hash: await hashPassword(password),
        role,
      })
      .returning('id')
      .then((rows) => rows.map((r: any) => (typeof r === 'object' ? r.id : r)));

    const user = { id, username, role, token_version: 0 };
    await invalidateCached(...allGlobalStatsCacheKeys());
    setAuthCookies(res, user);
    res.json({ user: publicUser(user) });
  })
);

router.post(
  '/login',
  rateLimit({
    name: 'login',
    limit: 5,
    windowSeconds: 60,
    failClosed: true,
    key: (req) => `${req.ip}:${String(req.body?.username ?? '').toLowerCase()}`,
  }),
  validateBody(credentialsSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const user = await db<User>('users').where({ username }).first();
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new HttpError(401, 'INVALID_CREDENTIALS');
    }
    if (user.banned_at) throw new HttpError(403, 'USER_BANNED');
    if (passwordNeedsRehash(user.password_hash)) {
      const previousHash = user.password_hash;
      const passwordHash = await hashPassword(password);
      await db('users')
        .where({ id: user.id, password_hash: previousHash })
        .update({ password_hash: passwordHash });
    }
    setAuthCookies(res, user);
    res.json({ user: publicUser({ id: user.id, username: user.username, role: user.role }) });
  })
);

router.get('/me', requireAuth, rateLimit({
  name: 'auth-me',
  limit: 60,
  windowSeconds: 60,
  key: requestIdentity,
  failClosed: true,
}), (req, res) => {
  res.json({ user: req.user });
});

router.post(
  '/refresh',
  rateLimit({ name: 'auth-refresh', limit: 60, windowSeconds: 60, failClosed: true }),
  asyncHandler(async (req, res) => {
    const user = await refreshAuthCookies(req.headers.cookie, res);
    if (!user) {
      clearAuthCookies(res);
      throw new HttpError(401, 'AUTH_REQUIRED');
    }
    res.json({ user });
  })
);

router.post(
  '/session',
  rateLimit({ name: 'session', limit: 60, windowSeconds: 60, failClosed: true }),
  asyncHandler(async (req, res) => {
    const user = await restoreAuthSession(req.headers.cookie, res);
    if (user) return res.json({ authenticated: true, user });
    const guest = ensureGuestCookie(req, res);
    res.json({ authenticated: false, guest: { name: guest.name } });
  })
);

router.post(
  '/logout',
  requireAuth,
  rateLimit({
    name: 'logout',
    limit: 30,
    windowSeconds: 60,
    key: requestIdentity,
    failClosed: true,
  }),
  asyncHandler(async (req, res) => {
    await db('users').where({ id: req.user!.id }).increment('token_version', 1);
    await invalidateAuthUser(req.user!.id);
    clearAuthCookies(res);
    ensureGuestCookie(req, res);
    res.json({ ok: true });
  })
);

/** 登录后认领匿名期间的对局记录,实现本地进度同步到账号 */
router.post(
  '/claim',
  requireAuth,
  rateLimit({
    name: 'claim',
    limit: 3,
    windowSeconds: 3600,
    key: requestIdentity,
    failClosed: true,
  }),
  asyncHandler(async (req, res) => {
    if (!req.guestKey) throw new HttpError(400, 'GUEST_KEY_REQUIRED');
    const guestKey = req.guestKey;
    const dailyClaimed = await claimDailyChallengeAttempts({
      guestKey,
      userId: req.user!.id,
      username: req.user!.username,
    });
    const gameClaimed = await db('games')
      .where({ guest_key: guestKey })
      .whereNull('user_id')
      .update({ user_id: req.user!.id, guest_key: null });
    clearGuestCookie(res);
    await invalidateCached(
      ...DIFFICULTY_LEVELS.map((difficulty) => leaderboardCacheKey('single', difficulty.key)),
      ...allPersonalStatsCacheKeys(`g:${guestKey}`),
      ...allPersonalStatsCacheKeys(`u:${req.user!.id}`),
      `room-player-performance:g:${guestKey}`,
      `room-player-performance:u:${req.user!.id}`
    );
    res.json({ claimed: Number(gameClaimed) + dailyClaimed });
  })
);

export default router;
