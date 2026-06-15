import { prisma } from "../../config/prisma.js";
import { deleteLocalUpload } from "../../utils/local-upload.js";
import { HttpError } from "../../utils/http-error.js";
import { toPublicUrl } from "../../utils/public-url.js";
import type { ProductInput } from "./product.schemas.js";

const include = {
  brand: true, categoryAssignments: { include: { category: true } }, tagAssignments: { include: { tag: true } },
  attributeAssignments: { include: { attribute: { include: { values: true } } } },
  media: { orderBy: { displayOrder: "asc" as const } },
  variations: { include: { selections: { include: { attributeValue: { include: { attribute: true } } } } } },
} as const;
const normalize = (product: any) => ({
  ...product,
  regularPrice: product.regularPrice == null ? null : Number(product.regularPrice), salePrice: product.salePrice == null ? null : Number(product.salePrice), costPrice: product.costPrice == null ? null : Number(product.costPrice),
  weight: product.weight == null ? null : Number(product.weight), length: product.length == null ? null : Number(product.length), width: product.width == null ? null : Number(product.width), height: product.height == null ? null : Number(product.height),
  media: product.media.map((m: any) => ({ ...m, url: toPublicUrl(m.path) })),
  variations: product.variations.map((v: any) => ({ ...v, regularPrice: Number(v.regularPrice), salePrice: v.salePrice == null ? null : Number(v.salePrice), imageUrl: toPublicUrl(v.imagePath) })),
  totalStock: product.type === "VARIABLE" ? product.variations.reduce((n: number, v: any) => n + v.stockQuantity, 0) : product.stockQuantity,
});
const relationData = (input: ProductInput) => ({
  categoryAssignments: { create: input.categoryIds.map((categoryId) => ({ categoryId })) },
  attributeAssignments: { create: input.attributeIds.map((attributeId) => ({ attributeId })) },
  tagAssignments: { create: input.tagNames.map((name) => ({ tag: { connectOrCreate: { where: { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }, create: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") } } } })) },
  variations: { create: input.type === "VARIABLE" ? input.variations.map(({ id: _id, attributeValueIds, ...v }) => ({ ...v, selections: { create: attributeValueIds.map((attributeValueId) => ({ attributeValueId })) } })) : [] },
});
const scalarData = (input: ProductInput) => {
  const { categoryIds: _c, attributeIds: _a, tagNames: _t, variations: _v, saleStartsAt, saleEndsAt, ...data } = input;
  return { ...data, saleStartsAt: saleStartsAt ? new Date(saleStartsAt) : null, saleEndsAt: saleEndsAt ? new Date(saleEndsAt) : null };
};

async function findDuplicateProduct(input: ProductInput, excludeId?: string) {
  return prisma.product.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        { slug: input.slug },
        ...(input.sku ? [{ sku: input.sku }] : []),
      ],
    },
    select: { id: true },
  });
}

export async function listProducts() { return (await prisma.product.findMany({ include, orderBy: { createdAt: "desc" } })).map(normalize); }
export async function getProduct(id: string) { const p = await prisma.product.findUnique({ where: { id }, include }); if (!p) throw new HttpError(404, "Product not found."); return normalize(p); }
export async function createProduct(input: ProductInput) {
  const duplicate = await findDuplicateProduct(input);
  if (duplicate) throw new HttpError(409, "Product slug or SKU already exists.");
  return normalize(await prisma.product.create({ data: { ...scalarData(input), ...relationData(input) }, include }));
}
export async function updateProduct(id: string, input: ProductInput) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } }); if (!existing) throw new HttpError(404, "Product not found.");
  const duplicate = await findDuplicateProduct(input, id); if (duplicate) throw new HttpError(409, "Product slug or SKU already exists.");
  return normalize(await prisma.$transaction(async (tx) => {
    await tx.productCategory.deleteMany({ where: { productId: id } }); await tx.productAttribute.deleteMany({ where: { productId: id } }); await tx.productTag.deleteMany({ where: { productId: id } }); await tx.productVariation.deleteMany({ where: { productId: id } });
    return tx.product.update({ where: { id }, data: { ...scalarData(input), ...relationData(input) }, include });
  }));
}
export async function deleteProduct(id: string) {
  const media = await prisma.productMedia.findMany({ where: { productId: id }, select: { path: true } });
  const variations = await prisma.productVariation.findMany({ where: { productId: id }, select: { imagePath: true } });
  await prisma.product.delete({ where: { id } }); await Promise.all([...media.map((m) => deleteLocalUpload(m.path)), ...variations.map((v) => deleteLocalUpload(v.imagePath))]);
}
export async function bulkProducts(ids: string[], action: string, categoryId?: string) {
  if (action === "DELETE") { for (const id of ids) await deleteProduct(id); return; }
  if (action === "UPDATE_CATEGORY") { if (!categoryId) throw new HttpError(400, "Category is required."); await prisma.$transaction(ids.map((productId) => prisma.productCategory.upsert({ where: { productId_categoryId: { productId, categoryId } }, update: {}, create: { productId, categoryId } }))); return; }
  const status = action === "ACTIVATE" ? "ACTIVE" : action === "DEACTIVATE" ? "INACTIVE" : "ARCHIVED";
  await prisma.product.updateMany({ where: { id: { in: ids } }, data: { status: status as any } });
}
export async function addProductMedia(productId: string, paths: string[]) {
  const count = await prisma.productMedia.count({ where: { productId } });
  await prisma.productMedia.createMany({ data: paths.map((path, i) => ({ productId, path, displayOrder: count + i, isPrimary: count === 0 && i === 0 })) });
  return getProduct(productId);
}
export async function deleteProductMedia(mediaId: string) { const m = await prisma.productMedia.findUnique({ where: { id: mediaId } }); if (!m) throw new HttpError(404, "Media not found."); await prisma.productMedia.delete({ where: { id: mediaId } }); await deleteLocalUpload(m.path); }
export async function updateMedia(mediaId: string, input: { altText?: string | null; isPrimary?: boolean; displayOrder?: number }) {
  const media = await prisma.productMedia.findUnique({ where: { id: mediaId } }); if (!media) throw new HttpError(404, "Media not found.");
  if (input.isPrimary) await prisma.productMedia.updateMany({ where: { productId: media.productId }, data: { isPrimary: false } });
  return prisma.productMedia.update({ where: { id: mediaId }, data: input });
}
export async function updateVariationImage(productId: string, variationId: string, imagePath: string) {
  const variation = await prisma.productVariation.findFirst({ where: { id: variationId, productId }, select: { id: true, imagePath: true } });
  if (!variation) throw new HttpError(404, "Variation not found.");
  const updated = await prisma.productVariation.update({ where: { id: variationId }, data: { imagePath } });
  await deleteLocalUpload(variation.imagePath);
  return updated;
}
export function generateVariations(groups: string[][], prefix: string, price: number, stock: number) {
  const combinations = groups.reduce<string[][]>((acc, group) => acc.flatMap((combo) => group.map((value) => [...combo, value])), [[]]);
  return combinations.map((attributeValueIds, index) => ({ sku: `${prefix}-${String(index + 1).padStart(3, "0")}`, regularPrice: price, salePrice: null, stockQuantity: stock, lowStockThreshold: 5, stockStatus: stock ? "IN_STOCK" : "OUT_OF_STOCK", weight: null, length: null, width: null, height: null, imagePath: null, isActive: true, attributeValueIds }));
}
