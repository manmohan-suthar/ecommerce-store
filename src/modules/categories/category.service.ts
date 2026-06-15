import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import type { CategoryInput } from "./category.schemas.js";
import { deleteLocalUpload } from "../../utils/local-upload.js";
import { toPublicUrl } from "../../utils/public-url.js";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  bannerUrl: true,
  displayOrder: true,
  isActive: true,
  seoTitle: true,
  seoDescription: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { children: true, productAssignments: true } },
} as const;

type NormalizedCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  bannerUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  childCount: number;
  productCount: number;
};

const normalizeCategory = <
  T extends {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    bannerUrl: string | null;
    displayOrder: number;
    isActive: boolean;
    seoTitle: string | null;
    seoDescription: string | null;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { children: number; productAssignments: number };
  },
>(
  category: T,
) : NormalizedCategory => {
  const { _count, ...data } = category;
  return {
    ...data,
    imageUrl: toPublicUrl(data.imageUrl),
    bannerUrl: toPublicUrl(data.bannerUrl),
    childCount: _count.children,
    productCount: _count.productAssignments,
  };
};

export type PublicCategoryNode = NormalizedCategory & {
  children: PublicCategoryNode[];
};

function buildCategoryTree(categories: NormalizedCategory[]) {
  const byId = new Map<string, PublicCategoryNode>();
  categories.forEach((category) => {
    byId.set(category.id, { ...category, children: [] });
  });

  const roots: PublicCategoryNode[] = [];
  byId.forEach((category) => {
    if (category.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId)!.children.push(category);
      return;
    }
    roots.push(category);
  });

  const sortTree = (nodes: PublicCategoryNode[]) => {
    nodes.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    nodes.forEach((node) => sortTree(node.children));
  };
  sortTree(roots);
  return roots;
}

async function ensureParentIsValid(parentId: string | null | undefined, categoryId?: string) {
  if (!parentId) return;
  if (parentId === categoryId) throw new HttpError(400, "A category cannot be its own parent.");

  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { id: true, parentId: true } });
  if (!parent) throw new HttpError(404, "Parent category not found.");

  let ancestorId = parent.parentId;
  while (ancestorId) {
    if (ancestorId === categoryId) throw new HttpError(400, "This parent would create a category loop.");
    const ancestor = await prisma.category.findUnique({
      where: { id: ancestorId },
      select: { parentId: true },
    });
    ancestorId = ancestor?.parentId ?? null;
  }
}

export async function listCategories() {
  const categories = await prisma.category.findMany({
    select: categorySelect,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
  return categories.map((category) => normalizeCategory(category));
}

export async function listPublicCategories() {
  const categories = await listCategories();
  return buildCategoryTree(categories);
}

export async function getPublicCategoryBySlug(slug: string) {
  const categories = await listCategories();
  const tree = buildCategoryTree(categories);
  const findCategory = (nodes: PublicCategoryNode[]): PublicCategoryNode | null => {
    for (const node of nodes) {
      if (node.slug === slug) return node;
      const child = findCategory(node.children);
      if (child) return child;
    }
    return null;
  };

  const category = findCategory(tree);
  if (!category) throw new HttpError(404, "Category not found.");
  return category;
}

export async function createCategory(input: CategoryInput) {
  await ensureParentIsValid(input.parentId);
  const existing = await prisma.category.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (existing) throw new HttpError(409, "A category with this slug already exists.");

  const category = await prisma.category.create({ data: input, select: categorySelect });
  return normalizeCategory(category);
}

export async function updateCategory(
  categoryId: string,
  input: CategoryInput,
  options: { removeImage: boolean; removeBanner: boolean },
) {
  await ensureParentIsValid(input.parentId, categoryId);
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, imageUrl: true, bannerUrl: true },
  });
  if (!category) throw new HttpError(404, "Category not found.");

  const slugOwner = await prisma.category.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (slugOwner && slugOwner.id !== categoryId) {
    throw new HttpError(409, "A category with this slug already exists.");
  }

  const imageUrl = options.removeImage ? null : input.imageUrl ?? category.imageUrl;
  const bannerUrl = options.removeBanner ? null : input.bannerUrl ?? category.bannerUrl;
  const updated = await prisma.category.update({
    where: { id: categoryId },
    data: { ...input, imageUrl, bannerUrl },
    select: categorySelect,
  });
  if ((options.removeImage || input.imageUrl) && category.imageUrl !== imageUrl) {
    await deleteLocalUpload(category.imageUrl);
  }
  if ((options.removeBanner || input.bannerUrl) && category.bannerUrl !== bannerUrl) {
    await deleteLocalUpload(category.bannerUrl);
  }
  return normalizeCategory(updated);
}

export async function updateCategoryStatus(categoryId: string, isActive: boolean) {
  const category = await prisma.category.update({
    where: { id: categoryId },
    data: { isActive },
    select: categorySelect,
  });
  return normalizeCategory(category);
}

export async function reorderCategories(items: Array<{ id: string; displayOrder: number }>) {
  await prisma.$transaction(
    items.map((item) =>
      prisma.category.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } }),
    ),
  );
  return listCategories();
}

export async function deleteCategory(categoryId: string, moveProductsToCategoryId?: string | null) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, imageUrl: true, bannerUrl: true, _count: { select: { productAssignments: true } } },
  });
  if (!category) throw new HttpError(404, "Category not found.");

  if (category._count.productAssignments > 0) {
    if (!moveProductsToCategoryId) {
      throw new HttpError(409, "Choose another category before deleting a category that contains products.");
    }
    if (moveProductsToCategoryId === categoryId) {
      throw new HttpError(400, "Products must be moved to a different category.");
    }

    const destination = await prisma.category.findUnique({
      where: { id: moveProductsToCategoryId },
      select: { id: true },
    });
    if (!destination) throw new HttpError(404, "Destination category not found.");

    const sourceAssignments = await prisma.productCategory.findMany({
      where: { categoryId },
      select: { productId: true },
    });

    await prisma.$transaction([
      ...sourceAssignments.map(({ productId }) =>
        prisma.productCategory.upsert({
          where: { productId_categoryId: { productId, categoryId: moveProductsToCategoryId } },
          update: {},
          create: { productId, categoryId: moveProductsToCategoryId },
        }),
      ),
      prisma.productCategory.deleteMany({ where: { categoryId } }),
      prisma.category.delete({ where: { id: categoryId } }),
    ]);
    await Promise.all([deleteLocalUpload(category.imageUrl), deleteLocalUpload(category.bannerUrl)]);
    return;
  }

  await prisma.category.delete({ where: { id: categoryId } });
  await Promise.all([deleteLocalUpload(category.imageUrl), deleteLocalUpload(category.bannerUrl)]);
}
