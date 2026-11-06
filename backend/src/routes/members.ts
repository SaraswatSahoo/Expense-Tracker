import { Router } from "express";
import { z } from "zod";
import { emailSchema, idParam } from "../lib/validation.js";
import * as groupService from "../services/groupService.js";

const addMemberSchema = z.object({ email: emailSchema });

export const membersRouter = Router({ mergeParams: true });

membersRouter.post("/", async (req, res) => {
  const { email } = addMemberSchema.parse(req.body);
  res.status(201).json(await groupService.addMember(idParam(req, "groupId"), req.userId, email));
});

membersRouter.delete("/:userId", async (req, res) => {
  await groupService.removeMember(idParam(req, "groupId"), req.userId, idParam(req, "userId"));
  res.status(204).end();
});
