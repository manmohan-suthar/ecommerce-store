import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { toPublicUrl } from "../../utils/public-url.js";
import type { InventoryQuery, StockAdjustmentInput } from "./inventory.schemas.js";

const productInclude = {
  brand: true,
  categoryAssignments: { include: { category: true } },
  media: { orderBy: { displayOrder: "asc" as const } },
  variations: {
    include: { selections: { include: { attributeValue: { include: { attribute: true } } } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

function variationName(variation: any) {
  return variation.selections
    .map((selection: any) => `${selection.attributeValue.attribute.name}: ${selection.attributeValue.name}`)
    .join(" / ");
}

function stockStatus(quantity: number, threshold: number, allowBackorder: boolean) {
  if (quantity === 0) return allowBackorder ? "BACKORDER" : "OUT_OF_STOCK";
  if (quantity <= threshold) return "LOW_STOCK";
  return "IN_STOCK";
}

function inventoryRow(product: any, variation?: any) {
  const media = product.media.find((item: any) => item.isPrimary) ?? product.media[0];
  return {
    id: variation ? `variation:${variation.id}` : `product:${product.id}`,
    productId: product.id,
    variationId: variation?.id ?? null,
    productName: product.name,
    variationName: variation ? variationName(variation) : null,
    productType: product.type,
    sku: variation?.sku ?? product.sku ?? "",
    imageUrl: toPublicUrl(variation?.imagePath) ?? toPublicUrl(media?.path),
    categories: product.categoryAssignments.map((item: any) => ({ id: item.category.id, name: item.category.name })),
    brand: product.brand ? { id: product.brand.id, name: product.brand.name } : null,
    stockQuantity: variation?.stockQuantity ?? product.stockQuantity,
    lowStockThreshold: variation?.lowStockThreshold ?? product.lowStockThreshold,
    stockStatus: variation?.stockStatus ?? product.stockStatus,
    allowBackorder: product.allowBackorder,
    isActive: variation?.isActive ?? product.status === "ACTIVE",
    updatedAt: variation?.updatedAt ?? product.updatedAt,
  };
}

export async function listInventory(query: InventoryQuery) {
  const products = await prisma.product.findMany({ include: productInclude, orderBy: { updatedAt: "desc" } });
  const rows = products.flatMap((product) =>
    product.type === "VARIABLE" ? product.variations.map((variation) => inventoryRow(product, variation)) : [inventoryRow(product)],
  ).filter((row) => {
    const searchable = `${row.productName} ${row.variationName ?? ""} ${row.sku}`.toLowerCase();
    return (!query.search || searchable.includes(query.search.toLowerCase()))
      && (!query.categoryId || row.categories.some((category: any) => category.id === query.categoryId))
      && (!query.brandId || row.brand?.id === query.brandId)
      && (!query.stockStatus || row.stockStatus === query.stockStatus);
  });

  return {
    rows,
    summary: {
      totalItems: rows.length,
      totalUnits: rows.reduce((total, row) => total + row.stockQuantity, 0),
      lowStock: rows.filter((row) => row.stockStatus === "LOW_STOCK").length,
      outOfStock: rows.filter((row) => row.stockStatus === "OUT_OF_STOCK").length,
      backorder: rows.filter((row) => row.stockStatus === "BACKORDER").length,
    },
  };
}

export async function listMovements(productId?: string, variationId?: string, limit = 50) {
  return prisma.stockMovement.findMany({
    where: { ...(productId ? { productId } : {}), ...(variationId ? { variationId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function adjustStock(input: StockAdjustmentInput, createdByEmail: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: input.productId },
      include: { variations: { include: { selections: { include: { attributeValue: { include: { attribute: true } } } } } } },
    });
    if (!product) throw new HttpError(404, "Product not found.");

    const variation = input.variationId ? product.variations.find((item) => item.id === input.variationId) : null;
    if (product.type === "VARIABLE" && !variation) throw new HttpError(400, "Choose a variation to adjust stock.");
    if (product.type === "SIMPLE" && input.variationId) throw new HttpError(400, "Simple product stock cannot use a variation.");

    const previousQuantity = variation?.stockQuantity ?? product.stockQuantity;
    const newQuantity = input.movementType === "SET"
      ? input.quantity
      : input.movementType === "INCREASE"
        ? previousQuantity + input.quantity
        : previousQuantity - input.quantity;
    if (newQuantity < 0) throw new HttpError(400, "Stock cannot be reduced below zero.");

    const threshold = variation?.lowStockThreshold ?? product.lowStockThreshold;
    const nextStatus = stockStatus(newQuantity, threshold, product.allowBackorder);
    if (variation) {
      await tx.productVariation.update({ where: { id: variation.id }, data: { stockQuantity: newQuantity, stockStatus: nextStatus } });
    } else {
      await tx.product.update({ where: { id: product.id }, data: { stockQuantity: newQuantity, stockStatus: nextStatus } });
    }

    return tx.stockMovement.create({
      data: {
        productId: product.id,
        variationId: variation?.id ?? null,
        movementType: input.movementType,
        reason: input.reason,
        skuSnapshot: variation?.sku ?? product.sku ?? "NO-SKU",
        itemNameSnapshot: variation ? `${product.name} / ${variationName(variation)}` : product.name,
        previousQuantity,
        adjustmentQuantity: newQuantity - previousQuantity,
        newQuantity,
        note: input.note,
        createdByEmail,
      },
    });
  });
}
