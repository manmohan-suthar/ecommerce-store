import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getCurrentUser,
  loginAdmin,
  loginWithGoogle,
} from "./auth.service.js";

export const authRouter = Router();

authRouter.post(
  "/google",
  asyncHandler(async (request, response) => {
    const { credential } = z
      .object({ credential: z.string().min(1) })
      .parse(request.body);
    response.json({ data: await loginWithGoogle(credential) });
  }),
);

authRouter.post(
  "/admin/login",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
      })
      .parse(request.body);
    response.json({ data: await loginAdmin(input.email, input.password) });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json({ data: await getCurrentUser(request.user!.id) });
  }),
);
