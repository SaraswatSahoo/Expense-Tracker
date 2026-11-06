import type { RequestHandler } from "express";
import { unauthorized } from "../lib/errors.js";
import { verifyAccessToken } from "../services/authService.js";

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth, so only read it on routes behind that middleware.
      userId: string;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    throw unauthorized("Missing access token");
  }
  req.userId = verifyAccessToken(token);
  next();
};
