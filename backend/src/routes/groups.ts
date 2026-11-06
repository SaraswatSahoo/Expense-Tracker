import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  currencySchema,
  hasAnyField,
  idParam,
  nameSchema,
  NO_FIELDS_MESSAGE,
  paginationSchema,
} from "../lib/validation.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireGroupMember } from "../middleware/requireGroupMember.js";
import { getGroupBalances } from "../services/balanceService.js";
import * as groupService from "../services/groupService.js";
import { expensesRouter } from "./expenses.js";
import { membersRouter } from "./members.js";
import { settlementsRouter } from "./settlements.js";

const createGroupSchema = z.object({ name: nameSchema, currency: currencySchema });

const updateGroupSchema = z
  .object({ name: nameSchema.optional(), currency: currencySchema.optional() })
  .refine(hasAnyField, NO_FIELDS_MESSAGE);

export const groupsRouter = Router();

groupsRouter.use(requireAuth);

groupsRouter.get("/", async (req, res) => {
  res.json(await groupService.listGroups(req.userId, paginationSchema.parse(req.query)));
});

groupsRouter.post("/", async (req, res) => {
  const input = createGroupSchema.parse(req.body);
  res.status(201).json(await groupService.createGroup(req.userId, input));
});

// Everything below requires the caller to be an active member of the group.
groupsRouter.use("/:groupId", requireGroupMember);

groupsRouter.get("/:groupId", async (req, res) => {
  res.json(await groupService.getGroup(idParam(req, "groupId")));
});

groupsRouter.patch("/:groupId", async (req, res) => {
  const input = updateGroupSchema.parse(req.body);
  res.json(await groupService.updateGroup(idParam(req, "groupId"), req.userId, input));
});

groupsRouter.delete("/:groupId", async (req, res) => {
  await groupService.deleteGroup(idParam(req, "groupId"), req.userId);
  res.status(204).end();
});

groupsRouter.get("/:groupId/balances", async (req, res) => {
  res.json(await getGroupBalances(prisma, idParam(req, "groupId")));
});

groupsRouter.use("/:groupId/members", membersRouter);
groupsRouter.use("/:groupId/expenses", expensesRouter);
groupsRouter.use("/:groupId/settlements", settlementsRouter);
