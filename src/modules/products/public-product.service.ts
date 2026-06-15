import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { toPublicUrl } from "../../utils/public-url.js";

const publicInclude = {
  brand: true,
  categoryAssignments: { include: { category: true } },
  tagAssignments: { include: { tag: true } },
  media: { orderBy: { displayOrder: "asc" as const } },
  variations: {
    include: { selections: { include: { attributeValue: { include: { attribute: true } } } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

function primaryMedia(product: any) {
  return product.media.find((item: any) => item.isPrimary) ?? product.media[0];
}

function deriveSizes(product: any) {
  const sizes = new Set<number>();
  const fallback = [7, 8, 9, 10, 11, 12];

  for (const variation of product.variations) {
    for (const selection of variation.selections) {
      const attributeName = selection.attributeValue.attribute.name.toLowerCase();
      const value = selection.attributeValue.name;
      if (!/size|fit/.test(attributeName)) continue;
      const numeric = Number.parseInt(value.match(/\d+/)?.[0] ?? "", 10);
      if (!Number.isNaN(numeric)) sizes.add(numeric);
    }
  }

  return Array.from(sizes).sort((a, b) => a - b).slice(0, 6).length ? Array.from(sizes).sort((a, b) => a - b) : fallback;
}

function deriveColors(product: any) {
  const colors: Array<{ name: string; value: string }> = [];
  for (const variation of product.variations) {
    for (const selection of variation.selections) {
      const attributeName = selection.attributeValue.attribute.name.toLowerCase();
      if (!attributeName.includes("color")) continue;
      const name = selection.attributeValue.name;
      const value = selection.attributeValue.colorHex ?? fallbackHex(name);
      if (!colors.some((entry) => entry.name === name)) colors.push({ name, value });
    }
  }
  return colors.length ? colors : [
    { name: "Default", value: "#111118" },
    { name: "Soft Gray", value: "#8E9196" },
  ];
}

function fallbackHex(name: string) {
  const palette = ["#111118", "#5B52E7", "#FF6B35", "#1CB87A", "#8E9196", "#E24B4A", "#D97706", "#374151"];
  const hash = name.toLowerCase().split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function deriveBadge(product: any) {
  if (product.isNewArrival) return "NEW";
  if (product.salePrice != null) return "SALE";
  if (product.isFeatured) return "BESTSELLER";
  return undefined;
}

function deriveDetails(product: any) {
  const categories = product.categoryAssignments.map((assignment: any) => assignment.category.name);
  const tags = product.tagAssignments.map((assignment: any) => assignment.tag.name);
  const details = [
    product.shortDescription || product.description || `Hand-selected for ${product.name}.`,
    categories.length ? `Category: ${categories.slice(0, 2).join(" / ")}` : "Category assignment not set yet.",
    tags.length ? `Tags: ${tags.slice(0, 3).join(", ")}` : `Stock management enabled with ${product.totalStock} units.`,
  ];
  return details.filter(Boolean).slice(0, 3);
}

function normalizeVariation(variation: any) {
  const selections = variation.selections.map((selection: any) => ({
    attributeValueId: selection.attributeValue.id,
    attributeName: selection.attributeValue.attribute.name,
    attributeValueName: selection.attributeValue.name,
    colorHex: selection.attributeValue.colorHex ?? null,
  }));

  return {
    id: variation.id,
    sku: variation.sku,
    regularPrice: Number(variation.regularPrice),
    salePrice: variation.salePrice == null ? null : Number(variation.salePrice),
    stockQuantity: variation.stockQuantity,
    lowStockThreshold: variation.lowStockThreshold,
    stockStatus: variation.stockStatus,
    imageUrl: variation.imagePath ? toPublicUrl(variation.imagePath) : null,
    isActive: variation.isActive,
    selections,
  };
}

export function normalizePublicProduct(product: any) {
  const media = product.media.map((item: any) => ({ ...item, url: toPublicUrl(item.path) }));
  const sizes = deriveSizes(product);
  const colors = deriveColors(product);
  const basePrice = product.regularPrice == null ? 0 : Number(product.regularPrice);
  const salePrice = product.salePrice == null ? null : Number(product.salePrice);
  const totalStock = product.type === "VARIABLE"
    ? product.variations.reduce((total: number, variation: any) => total + variation.stockQuantity, 0)
    : product.stockQuantity;

  return {
    id: product.id,
    slug: product.slug,
    brand: product.brand?.name ?? "Unknown",
    name: product.name,
    description: product.shortDescription ?? product.description ?? "",
    price: salePrice ?? basePrice,
    originalPrice: basePrice || salePrice || 0,
    images: media.length ? media.map((item: any) => item.url).filter(Boolean) : ["/src/assets/images/joyride_runner_1781357501076.jpg"],
    category: product.categoryAssignments[0]?.category.name ?? "Uncategorized",
    rating: 0,
    ratingCount: 0,
    sizes,
    colors,
    badge: deriveBadge(product),
    categories: product.categoryAssignments.map((assignment: any) => ({
      id: assignment.category.id,
      slug: assignment.category.slug,
      name: assignment.category.name,
    })),
    variations: product.variations.map(normalizeVariation),
    totalStock,
    details: deriveDetails({ ...product, totalStock }),
    reviews: [],
  };
}

async function fetchPublicProducts() {
  return prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: publicInclude,
    orderBy: [{ isFeatured: "desc" }, { isNewArrival: "desc" }, { createdAt: "desc" }],
  });
}

export async function listFreshDrops() {
  const products = await fetchPublicProducts();
  return products.map(normalizePublicProduct).slice(0, 8);
}

export async function listPublicProducts() {
  const products = await fetchPublicProducts();
  return products.map(normalizePublicProduct);
}

export async function getPublicProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: publicInclude,
  });
  if (!product || product.status !== "ACTIVE") throw new HttpError(404, "Product not found.");
  return normalizePublicProduct(product);
}
