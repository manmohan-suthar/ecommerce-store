import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { deleteUploadedFiles, productMediaUpload, uploadedProductFilePath } from "../../utils/local-upload.js";
import { HttpError } from "../../utils/http-error.js";
import { bulkProductSchema, generateVariationsSchema, productInputSchema } from "./product.schemas.js";
import { addProductMedia, bulkProducts, createProduct, deleteProduct, deleteProductMedia, generateVariations, getProduct, listProducts, updateMedia, updateProduct, updateVariationImage } from "./product.service.js";

export const productRouter = Router();
productRouter.use(requireAuth, requireAdmin);
productRouter.get("/", asyncHandler(async (_req, res) => res.json({ data: await listProducts() })));
productRouter.get("/metadata", asyncHandler(async (_req, res) => res.json({ data: { brands: await prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }) } })));
productRouter.post("/generate-variations", asyncHandler(async (req, res) => { const i = generateVariationsSchema.parse(req.body); res.json({ data: generateVariations(i.attributeValueGroups, i.skuPrefix, i.regularPrice, i.stockQuantity) }); }));
productRouter.post("/bulk", asyncHandler(async (req, res) => { const i = bulkProductSchema.parse(req.body); await bulkProducts(i.productIds, i.action, i.categoryId); res.status(204).send(); }));
productRouter.get("/:id", asyncHandler(async (req, res) => res.json({ data: await getProduct(z.string().uuid().parse(req.params.id)) })));
productRouter.post("/", asyncHandler(async (req, res) => res.status(201).json({ data: await createProduct(productInputSchema.parse(req.body)) })));
productRouter.put("/:id", asyncHandler(async (req, res) => res.json({ data: await updateProduct(z.string().uuid().parse(req.params.id), productInputSchema.parse(req.body)) })));
productRouter.delete("/:id", asyncHandler(async (req, res) => { await deleteProduct(z.string().uuid().parse(req.params.id)); res.status(204).send(); }));
productRouter.post("/:id/media", productMediaUpload, asyncHandler(async (req, res) => {
  try { const files = (req.files as Express.Multer.File[] | undefined) ?? []; res.json({ data: await addProductMedia(z.string().uuid().parse(req.params.id), files.map(uploadedProductFilePath)) }); }
  catch (error) { await deleteUploadedFiles(req.files as Express.Multer.File[] | undefined); throw error; }
}));
productRouter.patch("/media/:mediaId", asyncHandler(async (req, res) => res.json({ data: await updateMedia(z.string().uuid().parse(req.params.mediaId), z.object({ altText: z.string().max(200).nullable().optional(), isPrimary: z.boolean().optional(), displayOrder: z.number().int().nonnegative().optional() }).parse(req.body)) })));
productRouter.post("/:id/variations/:variationId/image", productMediaUpload, asyncHandler(async (req, res) => {
  try {
    const productId = z.string().uuid().parse(req.params.id);
    const variationId = z.string().uuid().parse(req.params.variationId);
    const file = (req.files as Express.Multer.File[] | undefined)?.[0];
    if (!file) throw new HttpError(400, "No file uploaded.");
    res.json({ data: await updateVariationImage(productId, variationId, uploadedProductFilePath(file)) });
  } catch (error) {
    await deleteUploadedFiles(req.files as Express.Multer.File[] | undefined);
    throw error;
  }
}));
productRouter.delete("/media/:mediaId", asyncHandler(async (req, res) => { await deleteProductMedia(z.string().uuid().parse(req.params.mediaId)); res.status(204).send(); }));
