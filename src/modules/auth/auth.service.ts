import bcrypt from "bcryptjs";
import { AuthProvider, UserRole } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const publicUser = (user: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  role: user.role,
});

const createToken = (user: {
  id: string;
  email: string;
  role: UserRole;
}) =>
  jwt.sign(
    { email: user.email, role: user.role.toLowerCase() },
    env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    },
  );

export async function loginWithGoogle(credential: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new HttpError(401, "Google account could not be verified.");
  }

  const normalizedEmail = payload.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser?.role === UserRole.ADMIN) {
    throw new HttpError(403, "Admin accounts must use the /dev login.");
  }

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      googleId: payload.sub,
      name: payload.name,
      avatarUrl: payload.picture,
    },
    create: {
      email: normalizedEmail,
      googleId: payload.sub,
      name: payload.name,
      avatarUrl: payload.picture,
      provider: AuthProvider.GOOGLE,
      role: UserRole.CUSTOMER,
    },
  });

  return { token: createToken(user), user: publicUser(user) };
}

export async function loginAdmin(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (
    !user?.passwordHash ||
    user.role !== UserRole.ADMIN ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    throw new HttpError(401, "Invalid admin credentials.");
  }

  return { token: createToken(user), user: publicUser(user) };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "User not found.");
  return publicUser(user);
}
