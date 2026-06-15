import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import type { AttributeInput, AttributeValueInput } from "./attribute.schemas.js";
import type { Prisma } from "@prisma/client";

const attributeInclude = {
  values: { orderBy: [{ displayOrder: "asc" }, { name: "asc" }] },
  _count: { select: { productAssignments: true } },
} satisfies Prisma.AttributeInclude;

const normalizeAttribute = <
  T extends { _count: { productAssignments: number } },
>(
  attribute: T,
) => {
  const { _count, ...data } = attribute;
  return { ...data, productCount: _count.productAssignments };
};

export async function listAttributes() {
  const attributes = await prisma.attribute.findMany({
    include: attributeInclude,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
  return attributes.map(normalizeAttribute);
}

export async function createAttribute(input: AttributeInput) {
  const existing = await prisma.attribute.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (existing) throw new HttpError(409, "An attribute with this slug already exists.");
  return normalizeAttribute(await prisma.attribute.create({ data: input, include: attributeInclude }));
}

export async function updateAttribute(attributeId: string, input: AttributeInput) {
  const existing = await prisma.attribute.findUnique({ where: { id: attributeId }, select: { id: true } });
  if (!existing) throw new HttpError(404, "Attribute not found.");
  const slugOwner = await prisma.attribute.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (slugOwner && slugOwner.id !== attributeId) throw new HttpError(409, "An attribute with this slug already exists.");
  return normalizeAttribute(await prisma.attribute.update({ where: { id: attributeId }, data: input, include: attributeInclude }));
}

export async function updateAttributeStatus(attributeId: string, isActive: boolean) {
  return normalizeAttribute(await prisma.attribute.update({ where: { id: attributeId }, data: { isActive }, include: attributeInclude }));
}

export async function reorderAttributes(items: Array<{ id: string; displayOrder: number }>) {
  await prisma.$transaction(items.map((item) => prisma.attribute.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } })));
  return listAttributes();
}

export async function deleteAttribute(attributeId: string) {
  const attribute = await prisma.attribute.findUnique({
    where: { id: attributeId },
    select: { _count: { select: { productAssignments: true } } },
  });
  if (!attribute) throw new HttpError(404, "Attribute not found.");
  if (attribute._count.productAssignments > 0) throw new HttpError(409, "Disable this attribute instead. It is already assigned to products.");
  await prisma.attribute.delete({ where: { id: attributeId } });
}

export async function createAttributeValue(attributeId: string, input: AttributeValueInput) {
  const attribute = await prisma.attribute.findUnique({ where: { id: attributeId }, select: { id: true } });
  if (!attribute) throw new HttpError(404, "Attribute not found.");
  const existing = await prisma.attributeValue.findUnique({
    where: { attributeId_slug: { attributeId, slug: input.slug } },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, "This value already exists in the attribute.");
  return prisma.attributeValue.create({ data: { ...input, attributeId } });
}

export async function updateAttributeValue(valueId: string, input: AttributeValueInput) {
  const value = await prisma.attributeValue.findUnique({ where: { id: valueId }, select: { id: true, attributeId: true } });
  if (!value) throw new HttpError(404, "Attribute value not found.");
  const slugOwner = await prisma.attributeValue.findUnique({
    where: { attributeId_slug: { attributeId: value.attributeId, slug: input.slug } },
    select: { id: true },
  });
  if (slugOwner && slugOwner.id !== valueId) throw new HttpError(409, "This value already exists in the attribute.");
  return prisma.attributeValue.update({ where: { id: valueId }, data: input });
}

export async function updateAttributeValueStatus(valueId: string, isActive: boolean) {
  return prisma.attributeValue.update({ where: { id: valueId }, data: { isActive } });
}

export async function reorderAttributeValues(attributeId: string, items: Array<{ id: string; displayOrder: number }>) {
  const values = await prisma.attributeValue.findMany({ where: { id: { in: items.map((item) => item.id) } }, select: { id: true, attributeId: true } });
  if (values.length !== items.length || values.some((value) => value.attributeId !== attributeId)) {
    throw new HttpError(400, "All reordered values must belong to this attribute.");
  }
  await prisma.$transaction(items.map((item) => prisma.attributeValue.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } })));
}

export async function deleteAttributeValue(valueId: string) {
  const value = await prisma.attributeValue.findUnique({ where: { id: valueId }, select: { id: true } });
  if (!value) throw new HttpError(404, "Attribute value not found.");
  await prisma.attributeValue.delete({ where: { id: valueId } });
}
