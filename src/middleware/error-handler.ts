import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { HttpError } from "../utils/http-error.js";

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new HttpError(404, "Route not found."));
};

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (error instanceof ZodError) {
    const details = error.flatten();
    const firstFieldError = Object.entries(details.fieldErrors).find(
      ([, messages]) => messages?.length,
    );
    response.status(400).json({
      error: firstFieldError
        ? `${firstFieldError[0]}: ${firstFieldError[1]![0]}`
        : details.formErrors[0] ?? "Validation failed.",
      details,
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    response.status(400).json({
      error: error.code === "LIMIT_FILE_SIZE" ? "Image size cannot exceed 5 MB." : error.message,
    });
    return;
  }

  const status = error instanceof HttpError ? error.status : 500;
  response.status(status).json({
    error: error instanceof Error ? error.message : "Internal server error.",
  });
};
