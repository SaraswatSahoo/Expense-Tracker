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
import * as expenseService from "../services/expenseService.js";

const descriptionSchema = z.string().trim().min(1).max(200);
const splitsSchema = z
  .array(z.object({ userId: userIdSchema, shareAmount: moneySchema }))
  .min(1)
  .max(100);

const createExpenseSchema = z.object({
  description: descriptionSchema,
  amount: moneySchema,
  expenseDate: dateSchema,
  paidById: userIdSchema,
  splits: splitsSchema,
});

const updateExpenseSchema = z
  .object({
    description: descriptionSchema.optional(),
    amount: moneySchema.optional(),
    expenseDate: dateSchema.optional(),
    paidById: userIdSchema.optional(),
    splits: splitsSchema.optional(),
  })
  .refine(hasAnyField, NO_FIELDS_MESSAGE)
  .refine((value) => (value.amount === undefined) === (value.splits === undefined), {
    message: "amount and splits must be sent together",
  });

const listExpensesSchema = paginationSchema
  .extend({ from: dateSchema.optional(), to: dateSchema.optional() })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must not be after to",
  });

export const expensesRouter = Router({ mergeParams: true });

expensesRouter.get("/", async (req, res) => {
  const filters = listExpensesSchema.parse(req.query);
  res.json(await expenseService.listExpenses(idParam(req, "groupId"), filters));
});

expensesRouter.post("/", async (req, res) => {
  const input = createExpenseSchema.parse(req.body);
  res.status(201).json(await expenseService.createExpense(idParam(req, "groupId"), req.userId, input));
});

expensesRouter.get("/:expenseId", async (req, res) => {
  res.json(await expenseService.getExpense(idParam(req, "groupId"), idParam(req, "expenseId")));
});

expensesRouter.patch("/:expenseId", async (req, res) => {
  const input = updateExpenseSchema.parse(req.body);
  res.json(
    await expenseService.updateExpense(
      idParam(req, "groupId"),
      idParam(req, "expenseId"),
      req.userId,
      input,
    ),
  );
});

expensesRouter.delete("/:expenseId", async (req, res) => {
  await expenseService.deleteExpense(idParam(req, "groupId"), idParam(req, "expenseId"), req.userId);
  res.status(204).end();
});
