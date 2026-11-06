import type { RequestHandler } from "express";
import { idParam } from "../lib/validation.js";
import { assertActiveCaller } from "../services/groupAccess.js";
import { prisma } from "../lib/prisma.js";

// Non-members get a 404, so they can't discover which groups exist.
export const requireGroupMember: RequestHandler = async (req, _res, next) => {
  await assertActiveCaller(prisma, idParam(req, "groupId"), req.userId);
  next();
};
