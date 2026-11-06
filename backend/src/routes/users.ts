import { Router } from "express";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { serializeUser } from "../lib/serializers.js";
import { nameSchema, passwordSchema } from "../lib/validation.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { changePassword } from "../services/authService.js";

const updateProfileSchema = z.object({ name: nameSchema });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/me", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw notFound("User not found");
  res.json(serializeUser(user));
});

usersRouter.patch("/me", async (req, res) => {
  const { name } = updateProfileSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.userId }, data: { name } });
  res.json(serializeUser(user));
});

usersRouter.patch("/me/password", async (req, res) => {
  await changePassword(req.userId, changePasswordSchema.parse(req.body));
  res.status(204).end();
});
