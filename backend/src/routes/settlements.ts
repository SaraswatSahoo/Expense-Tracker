import { Router } from "express";
import { z } from "zod";
import {
  dateSchema,
  hasAnyField,
  idParam,
  moneySchema,
  NO_FIELDS_MESSAGE,
  paginationSchema,
  userIdSchema,
} from "../lib/validation.js";
import * as settlementService from "../services/settlementService.js";

const noteSchema = z.string().trim().max(500);

const createSettlementSchema = z
  .object({
    fromUserId: userIdSchema,
    toUserId: userIdSchema,
    amount: moneySchema,
    settledOn: dateSchema,
    note: noteSchema.optional(),
  })
  .refine((value) => value.fromUserId !== value.toUserId, {
    message: "fromUserId and toUserId must be different",
  });

const updateSettlementSchema = z
  .object({
    amount: moneySchema.optional(),
    settledOn: dateSchema.optional(),
    note: noteSchema.nullable().optional(),
  })
  .refine(hasAnyField, NO_FIELDS_MESSAGE);

const listSettlementsSchema = paginationSchema.extend({
  status: z.enum(["PENDING", "CONFIRMED", "REJECTED"]).optional(),
});

export const settlementsRouter = Router({ mergeParams: true });

settlementsRouter.get("/", async (req, res) => {
  const filters = listSettlementsSchema.parse(req.query);
  res.json(await settlementService.listSettlements(idParam(req, "groupId"), filters));
});

settlementsRouter.post("/", async (req, res) => {
  const input = createSettlementSchema.parse(req.body);
  res
    .status(201)
    .json(await settlementService.createSettlement(idParam(req, "groupId"), req.userId, input));
});

settlementsRouter.get("/:settlementId", async (req, res) => {
  res.json(
    await settlementService.getSettlement(idParam(req, "groupId"), idParam(req, "settlementId")),
  );
});

settlementsRouter.patch("/:settlementId", async (req, res) => {
  const input = updateSettlementSchema.parse(req.body);
  res.json(
    await settlementService.updateSettlement(
      idParam(req, "groupId"),
      idParam(req, "settlementId"),
      req.userId,
      input,
    ),
  );
});

settlementsRouter.delete("/:settlementId", async (req, res) => {
  await settlementService.deleteSettlement(
    idParam(req, "groupId"),
    idParam(req, "settlementId"),
    req.userId,
  );
  res.status(204).end();
});

settlementsRouter.post("/:settlementId/confirm", async (req, res) => {
  res.json(
    await settlementService.respondToSettlement(
      idParam(req, "groupId"),
      idParam(req, "settlementId"),
      req.userId,
      "CONFIRMED",
    ),
  );
});

settlementsRouter.post("/:settlementId/reject", async (req, res) => {
  res.json(
    await settlementService.respondToSettlement(
      idParam(req, "groupId"),
      idParam(req, "settlementId"),
      req.userId,
      "REJECTED",
    ),
  );
});
