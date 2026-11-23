import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, ".data");
const STORE_PATH = path.join(DATA_DIR, "auth-store.json");

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET?.trim() ||
  crypto.randomBytes(32).toString("hex");

export interface StoredUserRecord {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  passwordHash: string;
  salt: string;
  sessionVersion: number;
  createdAt: number;
  lastLoginAt?: number;
}

export interface PublicAuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: number;
  lastLoginAt?: number;
  managedByEnv?: boolean;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: "admin" | "user";
  ver: number;
  jti: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends express.Request {
  authUser?: PublicAuthUser;
  authPayload?: AuthTokenPayload;
}

interface AuthStoreFile {
  version: 1;
  users: StoredUserRecord[];
  envAdminSessionVersion: number;
}

const revokedTokenIds = new Map<string, number>(); // jti -> expiresAt
const failedLoginTracker = new Map<
  string,
  { count: number; lockedUntil: number }
>();

let storeCache: AuthStoreFile | null = null;
let adminSetupInProgress = false;

export function getOwnerEmail(): string {
  const configured = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (configured && isValidEmail(configured)) {
    return configured;
  }
  return "leticiamalafoia@gmail.com";
}

export function getEnvAdminPassword(): string {
  return (process.env.ADMIN_PASSWORD || "").trim();
}

export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 160) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function sanitizeDisplayName(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (cleaned.length < 2) return fallback;
  return cleaned.slice(0, 80);
}

export function validatePasswordStrength(password: unknown): string | null {
  if (typeof password !== "string") {
    return "Informe uma senha válida.";
  }
  if (password.length < 8) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }
  if (password.length > 128) {
    return "A senha deve ter no máximo 128 caracteres.";
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    return "A senha deve combinar pelo menos uma letra e um número.";
  }
  return null;
}

function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, 64, SCRYPT_PARAMS)
    .toString("hex");
  return { salt, hash };
}

function verifyPasswordHash(
  password: string,
  salt: string,
  expectedHash: string
): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64, SCRYPT_PARAMS);
    const expected = Buffer.from(expectedHash, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function timingSafeStringCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function loadStore(): AuthStoreFile {
  if (storeCache) return storeCache;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw) as Partial<AuthStoreFile>;
      if (parsed && Array.isArray(parsed.users)) {
        storeCache = {
          version: 1,
          users: parsed.users,
          envAdminSessionVersion:
            typeof parsed.envAdminSessionVersion === "number"
              ? parsed.envAdminSessionVersion
              : 1,
        };
        return storeCache;
      }
    }
  } catch {
    // Fall back to fresh store if corrupted or unavailable
  }
  storeCache = { version: 1, users: [], envAdminSessionVersion: 1 };
  return storeCache;
}

function saveStore(store: AuthStoreFile): void {
  storeCache = store;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
    const tmpPath = `${STORE_PATH}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(tmpPath, STORE_PATH);
  } catch {
    // Keep operating in-memory if filesystem is read-only
  }
}

function toPublicUser(
  record: StoredUserRecord,
  managedByEnv = false
): PublicAuthUser {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt,
    lastLoginAt: record.lastLoginAt,
    managedByEnv,
  };
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLen), "base64").toString("utf8");
}

function signToken(payload: AuthTokenPayload): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest();
  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

function pruneRevokedTokens(): void {
  const now = Date.now();
  for (const [jti, exp] of revokedTokenIds.entries()) {
    if (exp <= now) revokedTokenIds.delete(jti);
  }
}

export function issueSessionToken(
  user: PublicAuthUser,
  sessionVersion: number
): string {
  const now = Date.now();
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    ver: sessionVersion,
    jti: crypto.randomBytes(16).toString("hex"),
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  return signToken(payload);
}

export function verifySessionToken(
  token: string
): { user: PublicAuthUser; payload: AuthTokenPayload } | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  const expectedSig = base64UrlEncode(
    crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(encodedPayload)
      .digest()
  );

  const sigBufA = Buffer.from(encodedSig, "utf8");
  const sigBufB = Buffer.from(expectedSig, "utf8");
  if (
    sigBufA.length !== sigBufB.length ||
    !crypto.timingSafeEqual(sigBufA, sigBufB)
  ) {
    return null;
  }

  let payload: AuthTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as AuthTokenPayload;
  } catch {
    return null;
  }

  if (
    !payload ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.ver !== "number" ||
    typeof payload.exp !== "number" ||
    typeof payload.jti !== "string"
  ) {
    return null;
  }

  if (payload.exp <= Date.now()) return null;
  if (revokedTokenIds.has(payload.jti)) return null;

  const store = loadStore();
  const ownerEmail = getOwnerEmail();
  const envAdminPass = getEnvAdminPassword();

  if (payload.sub === "env-admin" && envAdminPass && payload.email === ownerEmail) {
    if (payload.ver !== store.envAdminSessionVersion) return null;
    const existing = store.users.find((u) => u.email === ownerEmail);
    return {
      user: {
        id: "env-admin",
        name: existing?.name || "Leticia",
        email: ownerEmail,
        role: "admin",
        createdAt: existing?.createdAt || payload.iat,
        lastLoginAt: existing?.lastLoginAt || payload.iat,
        managedByEnv: true,
      },
      payload,
    };
  }

  const record = store.users.find(
    (u) => u.id === payload.sub && u.email === payload.email
  );
  if (!record) return null;
  if (record.sessionVersion !== payload.ver) return null;

  return {
    user: toPublicUser(
      record,
      Boolean(envAdminPass && record.email === ownerEmail)
    ),
    payload,
  };
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  errorMessage: string
): express.RequestHandler {
  const buckets = new Map<string, number[]>();

  return (req, res, next) => {
    const now = Date.now();
    const key =
      (req as AuthenticatedRequest).authUser?.id || getClientIp(req);
    const list = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);

    if (list.length >= maxRequests) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((windowMs - (now - list[0])) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: errorMessage });
    }

    list.push(now);
    buckets.set(key, list);

    if (buckets.size > 1500) {
      for (const [bucketKey, timestamps] of buckets.entries()) {
        const active = timestamps.filter((ts) => now - ts < windowMs);
        if (active.length === 0) buckets.delete(bucketKey);
        else buckets.set(bucketKey, active);
      }
    }

    next();
  };
}

function checkAccountLockout(email: string): number {
  const entry = failedLoginTracker.get(email);
  if (!entry) return 0;
  if (entry.lockedUntil > Date.now()) {
    return Math.ceil((entry.lockedUntil - Date.now()) / 1000);
  }
  if (entry.lockedUntil > 0 && entry.lockedUntil <= Date.now()) {
    failedLoginTracker.delete(email);
  }
  return 0;
}

function recordFailedLogin(email: string): void {
  const current = failedLoginTracker.get(email) || { count: 0, lockedUntil: 0 };
  const nextCount = current.count + 1;
  failedLoginTracker.set(email, {
    count: nextCount,
    lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
  });
}

function clearFailedLogin(email: string): void {
  failedLoginTracker.delete(email);
}

export const securityHeadersMiddleware: express.RequestHandler = (
  _req,
  res,
  next
) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
};

export const requireAuth: express.RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    return res.status(401).json({
      error: "Autenticação necessária. Faça login para acessar este recurso.",
    });
  }

  const verified = verifySessionToken(match[1]);
  if (!verified) {
    return res.status(401).json({
      error: "Sua sessão expirou ou foi encerrada. Faça login novamente.",
    });
  }

  const authReq = req as AuthenticatedRequest;
  authReq.authUser = verified.user;
  authReq.authPayload = verified.payload;
  next();
};

export function mountAuthRoutes(app: express.Express): void {
  const authRateLimiter = createRateLimiter(
    15 * 60 * 1000,
    25,
    "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente."
  );

  app.use("/api/auth", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  app.get("/api/auth/status", (_req, res) => {
    const store = loadStore();
    const ownerEmail = getOwnerEmail();
    const envAdminPass = getEnvAdminPassword();
    const hasClaimedAdmin = store.users.some(
      (u) => u.role === "admin" || u.email === ownerEmail
    );

    res.json({
      ownerEmail,
      needsAdminSetup: !envAdminPass && !hasClaimedAdmin,
      adminConfiguredByEnv: Boolean(envAdminPass),
      registrationEnabled: true,
    });
  });

  app.post("/api/auth/setup-admin", authRateLimiter, (req, res) => {
    if (adminSetupInProgress) {
      return res.status(409).json({
        error: "Configuração inicial já está em andamento.",
      });
    }
    adminSetupInProgress = true;
    try {
      const store = loadStore();
      const ownerEmail = getOwnerEmail();
      const envAdminPass = getEnvAdminPassword();
      const hasClaimedAdmin = store.users.some(
        (u) => u.role === "admin" || u.email === ownerEmail
      );

      if (envAdminPass || hasClaimedAdmin) {
        return res.status(409).json({
          error:
            "A conta de administradora já está configurada. Faça login com seu e-mail e senha.",
        });
      }

      const { name, password } = (req.body || {}) as {
        name?: unknown;
        password?: unknown;
      };

      const passwordErr = validatePasswordStrength(password);
      if (passwordErr) {
        return res.status(400).json({ error: passwordErr });
      }

      const displayName = sanitizeDisplayName(name, "Leticia");
      const { salt, hash } = hashPassword(password as string);
      const now = Date.now();
      const newAdmin: StoredUserRecord = {
        id: `usr-${crypto.randomUUID()}`,
        name: displayName,
        email: ownerEmail,
        role: "admin",
        passwordHash: hash,
        salt,
        sessionVersion: 1,
        createdAt: now,
        lastLoginAt: now,
      };

      store.users.push(newAdmin);
      saveStore(store);

      const publicUser = toPublicUser(newAdmin, false);
      const token = issueSessionToken(publicUser, newAdmin.sessionVersion);
      return res.status(201).json({ token, user: publicUser });
    } finally {
      adminSetupInProgress = false;
    }
  });

  app.post("/api/auth/register", authRateLimiter, (req, res) => {
    const { name, email, password } = (req.body || {}) as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
    };

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: "Informe um e-mail válido." });
    }

    const passwordErr = validatePasswordStrength(password);
    if (passwordErr) {
      return res.status(400).json({ error: passwordErr });
    }

    const store = loadStore();
    const ownerEmail = getOwnerEmail();
    if (normalizedEmail === ownerEmail) {
      return res.status(409).json({
        error:
          "Este e-mail é reservado à conta principal. Use a opção de ativação inicial ou faça login.",
      });
    }

    if (store.users.some((u) => u.email === normalizedEmail)) {
      return res.status(409).json({
        error: "Já existe uma conta cadastrada com este e-mail.",
      });
    }

    const displayName = sanitizeDisplayName(
      name,
      normalizedEmail.split("@")[0] || "Leitor"
    );
    const { salt, hash } = hashPassword(password as string);
    const now = Date.now();
    const newUser: StoredUserRecord = {
      id: `usr-${crypto.randomUUID()}`,
      name: displayName,
      email: normalizedEmail,
      role: "user",
      passwordHash: hash,
      salt,
      sessionVersion: 1,
      createdAt: now,
      lastLoginAt: now,
    };

    store.users.push(newUser);
    saveStore(store);

    const publicUser = toPublicUser(newUser, false);
    const token = issueSessionToken(publicUser, newUser.sessionVersion);
    return res.status(201).json({ token, user: publicUser });
  });

  app.post("/api/auth/login", authRateLimiter, (req, res) => {
    const { email, password } = (req.body || {}) as {
      email?: unknown;
      password?: unknown;
    };

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail) || typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Informe seu e-mail e senha." });
    }

    const lockRemaining = checkAccountLockout(normalizedEmail);
    if (lockRemaining > 0) {
      return res.status(429).json({
        error: `Muitas tentativas incorretas. Tente novamente em ${Math.ceil(
          lockRemaining / 60
        )} minuto(s).`,
      });
    }

    const store = loadStore();
    const ownerEmail = getOwnerEmail();
    const envAdminPass = getEnvAdminPassword();

    // Configured ADMIN_PASSWORD in process.env always overrides any claimed fallback hash
    if (envAdminPass && normalizedEmail === ownerEmail) {
      if (timingSafeStringCompare(password, envAdminPass)) {
        clearFailedLogin(normalizedEmail);
        const now = Date.now();
        const existing = store.users.find((u) => u.email === ownerEmail);
        if (existing) {
          existing.lastLoginAt = now;
          saveStore(store);
        }
        const publicUser: PublicAuthUser = {
          id: "env-admin",
          name: existing?.name || "Leticia",
          email: ownerEmail,
          role: "admin",
          createdAt: existing?.createdAt || now,
          lastLoginAt: now,
          managedByEnv: true,
        };
        const token = issueSessionToken(
          publicUser,
          store.envAdminSessionVersion
        );
        return res.json({ token, user: publicUser });
      }
      recordFailedLogin(normalizedEmail);
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }

    const record = store.users.find((u) => u.email === normalizedEmail);
    if (!record || !verifyPasswordHash(password, record.salt, record.passwordHash)) {
      recordFailedLogin(normalizedEmail);
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }

    clearFailedLogin(normalizedEmail);
    record.lastLoginAt = Date.now();
    saveStore(store);

    const publicUser = toPublicUser(record, false);
    const token = issueSessionToken(publicUser, record.sessionVersion);
    return res.json({ token, user: publicUser });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const authReq = req as AuthenticatedRequest;
    res.json({ user: authReq.authUser });
  });

  app.post("/api/auth/change-password", authRateLimiter, requireAuth, (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const currentUser = authReq.authUser!;
    const currentPayload = authReq.authPayload!;

    if (currentUser.managedByEnv) {
      return res.status(400).json({
        error:
          "A senha da administradora está definida pela variável ADMIN_PASSWORD no servidor. Atualize-a nas configurações de ambiente.",
      });
    }

    const { currentPassword, newPassword } = (req.body || {}) as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };

    if (typeof currentPassword !== "string" || !currentPassword) {
      return res.status(400).json({ error: "Informe sua senha atual." });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }

    const store = loadStore();
    const record = store.users.find((u) => u.id === currentUser.id);
    if (!record) {
      return res.status(404).json({ error: "Conta não encontrada." });
    }

    if (!verifyPasswordHash(currentPassword, record.salt, record.passwordHash)) {
      return res.status(401).json({ error: "A senha atual está incorreta." });
    }

    const { salt, hash } = hashPassword(newPassword as string);
    record.salt = salt;
    record.passwordHash = hash;
    record.sessionVersion += 1;
    saveStore(store);

    pruneRevokedTokens();
    revokedTokenIds.set(currentPayload.jti, currentPayload.exp);

    const publicUser = toPublicUser(record, false);
    const token = issueSessionToken(publicUser, record.sessionVersion);
    return res.json({
      token,
      user: publicUser,
      message: "Senha atualizada com sucesso. Outras sessões foram encerradas.",
    });
  });

  app.post("/api/auth/logout", requireAuth, (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = authReq.authPayload!;
    const user = authReq.authUser!;
    const { allSessions } = (req.body || {}) as { allSessions?: unknown };

    pruneRevokedTokens();
    revokedTokenIds.set(payload.jti, payload.exp);

    if (allSessions === true) {
      const store = loadStore();
      if (user.id === "env-admin") {
        store.envAdminSessionVersion += 1;
        saveStore(store);
      } else {
        const record = store.users.find((u) => u.id === user.id);
        if (record) {
          record.sessionVersion += 1;
          saveStore(store);
        }
      }
    }

    res.json({ ok: true });
  });
}
