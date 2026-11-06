import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Prisma } from "../generated/prisma/client.js";
import { conflict, unauthorized } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { serializeUser } from "../lib/serializers.js";

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function signAccessToken(userId: string): string {
  return jwt.sign({}, env.jwtSecret, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: ACCESS_TOKEN_SECONDS,
  });
}

export function verifyAccessToken(token: string): string {
  try {
    const { sub } = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    if (!sub) throw new Error("Token has no subject");
    return sub;
  } catch {
    throw unauthorized("Invalid or expired access token");
  }
}

async function issueRefreshToken(db: Prisma.TransactionClient, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS),
    },
  });
  return token;
}

export async function register(input: { email: string; name: string; password: string }) {
  const passwordHash = await argon2.hash(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
      return {
        user: serializeUser(user),
        accessToken: signAccessToken(user.id),
        refreshToken: await issueRefreshToken(tx, user.id),
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("Email is already registered");
    }
    throw error;
  }
}

// Unknown emails still run a hash check, so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  dummyHash ??= argon2.hash(randomBytes(32));
  const passwordMatches = await argon2.verify(
    user?.passwordHash ?? (await dummyHash),
    input.password,
  );
  if (!user || !passwordMatches) {
    throw unauthorized("Incorrect email or password");
  }
  return {
    user: serializeUser(user),
    accessToken: signAccessToken(user.id),
    refreshToken: await issueRefreshToken(prisma, user.id),
  };
}

export function refresh(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.refreshToken.findUnique({ where: { tokenHash } });
    const now = new Date();
    // The status check is part of the update, so one token can't be swapped twice at once.
    const { count } = await tx.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    if (!existing || count === 0) {
      throw unauthorized("Invalid or expired refresh token");
    }
    return {
      accessToken: signAccessToken(existing.userId),
      refreshToken: await issueRefreshToken(tx, existing.userId),
    };
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await argon2.verify(user.passwordHash, input.currentPassword))) {
    throw unauthorized("Current password is incorrect");
  }
  const passwordHash = await argon2.hash(input.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
