import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { emailSchema, nameSchema, passwordSchema } from "../lib/validation.js";
import * as authService from "../services/authService.js";

// Slows password guessing. The limit is shared across register and login, per IP address.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

const registerSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
});

// Existing passwords aren't checked against the length rules, only for a sensible maximum.
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(200),
});

export const authRouter = Router();

authRouter.post("/register", credentialLimiter, async (req, res) => {
  res.status(201).json(await authService.register(registerSchema.parse(req.body)));
});

authRouter.post("/login", credentialLimiter, async (req, res) => {
  res.json(await authService.login(loginSchema.parse(req.body)));
});

authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = refreshTokenSchema.parse(req.body);
  res.json(await authService.refresh(refreshToken));
});

authRouter.post("/logout", async (req, res) => {
  const { refreshToken } = refreshTokenSchema.parse(req.body);
  await authService.logout(refreshToken);
  res.status(204).end();
});
