import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { HttpError } from "./http-error.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const uploadsRoot = path.join(backendRoot, "uploads");
const categoryUploadsDirectory = path.join(uploadsRoot, "categories");
const productUploadsDirectory = path.join(uploadsRoot, "products");
const reviewUploadsDirectory = path.join(uploadsRoot, "reviews");
const brandingUploadsDirectory = path.join(uploadsRoot, "branding");
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

fs.mkdirSync(categoryUploadsDirectory, { recursive: true });
fs.mkdirSync(productUploadsDirectory, { recursive: true });
fs.mkdirSync(reviewUploadsDirectory, { recursive: true });
fs.mkdirSync(brandingUploadsDirectory, { recursive: true });

const makeStorage = (directory: string) => multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, directory),
  filename: (_request, file, callback) => {
    const extensionByMimeType: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
      "image/avif": ".avif",
    };
    const extension = extensionByMimeType[file.mimetype] ?? path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

export const categoryMediaUpload = multer({
  storage: makeStorage(categoryUploadsDirectory),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (_request, file, callback) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      callback(new HttpError(400, "Only JPG, PNG, WebP, GIF, and AVIF images are allowed."));
      return;
    }
    callback(null, true);
  },
}).fields([
  { name: "image", maxCount: 1 },
  { name: "banner", maxCount: 1 },
]);

export const productMediaUpload = multer({
  storage: makeStorage(productUploadsDirectory),
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (_request, file, callback) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) return callback(new HttpError(400, "Only JPG, PNG, WebP, GIF, and AVIF images are allowed."));
    callback(null, true);
  },
}).array("images", 12);

export const reviewMediaUpload = multer({
  storage: makeStorage(reviewUploadsDirectory),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_request, file, callback) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) return callback(new HttpError(400, "Only JPG, PNG, WebP, GIF, and AVIF images are allowed."));
    callback(null, true);
  },
}).array("images", 5);

export const brandingMediaUpload = multer({
  storage: makeStorage(brandingUploadsDirectory),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) return callback(new HttpError(400, "Only JPG, PNG, WebP, GIF, and AVIF images are allowed."));
    callback(null, true);
  },
}).single("image");

export function uploadedFilePath(file: Express.Multer.File | undefined) {
  return file ? `/uploads/categories/${file.filename}` : undefined;
}

export function uploadedProductFilePath(file: Express.Multer.File) {
  return `/uploads/products/${file.filename}`;
}

export function uploadedReviewFilePath(file: Express.Multer.File) {
  return `/uploads/reviews/${file.filename}`;
}

export function uploadedBrandingFilePath(file: Express.Multer.File) {
  return `/uploads/branding/${file.filename}`;
}

export async function deleteLocalUpload(relativePath: string | null | undefined) {
  if (!relativePath?.startsWith("/uploads/")) return;

  const absolutePath = path.resolve(backendRoot, relativePath.replace(/^[/\\]+/, ""));
  const relativeToUploads = path.relative(uploadsRoot, absolutePath);
  if (relativeToUploads.startsWith("..") || path.isAbsolute(relativeToUploads)) return;

  await fs.promises.rm(absolutePath, { force: true });
}

export async function deleteUploadedFiles(files: Express.Multer.File[] | Record<string, Express.Multer.File[]> | undefined) {
  if (!files) return;
  const uploadedFiles = Array.isArray(files) ? files : Object.values(files).flat();
  await Promise.all(uploadedFiles.map((file) => fs.promises.rm(file.path, { force: true })));
}
