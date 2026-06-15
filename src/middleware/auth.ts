import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

interface TokenPayload {
  sub: string;
  email: string;
  role: "customer" | "admin";
}

export function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return next(new HttpError(401, "Authentication required."));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired access token."));
  }
}

export function requireAdmin(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  if (request.user?.role !== "admin") {
    return next(new HttpError(403, "Admin access required."));
  }
  next();
}
