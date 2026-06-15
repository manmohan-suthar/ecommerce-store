import bcrypt from "bcryptjs";
import { AuthProvider, PrismaClient, UserRole } from "@prisma/client";
import { env } from "../src/config/env.js";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL.toLowerCase() },
    update: { passwordHash, role: UserRole.ADMIN },
    create: {
      email: env.ADMIN_EMAIL.toLowerCase(),
      name: "SoleVibe Admin",
      passwordHash,
      provider: AuthProvider.LOCAL,
      role: UserRole.ADMIN,
    },
  });

  const categoryTree = [
    {
      name: "Shoes",
      slug: "shoes",
      children: [
        { name: "Men's Shoes", slug: "mens-shoes", children: ["Running Shoes", "Casual Shoes", "Sneakers", "Sports Shoes", "Formal Shoes"] },
        { name: "Women's Shoes", slug: "womens-shoes", children: ["Women's Running Shoes", "Women's Casual Shoes", "Women's Sneakers", "Women's Sports Shoes"] },
        { name: "Kids' Shoes", slug: "kids-shoes", children: [] },
      ],
    },
    {
      name: "T-Shirts",
      slug: "t-shirts",
      children: [
        { name: "Men's T-Shirts", slug: "mens-t-shirts", children: ["Oversized T-Shirts", "Regular Fit T-Shirts", "Polo T-Shirts", "Graphic T-Shirts"] },
        { name: "Women's T-Shirts", slug: "womens-t-shirts", children: ["Women's Oversized T-Shirts", "Women's Regular Fit T-Shirts", "Crop T-Shirts"] },
        { name: "Kids' T-Shirts", slug: "kids-t-shirts", children: [] },
      ],
    },
    {
      name: "Collections",
      slug: "collections",
      children: [
        { name: "New Arrivals", slug: "new-arrivals", children: [] },
        { name: "Best Sellers", slug: "best-sellers", children: [] },
        { name: "Sale", slug: "sale", children: [] },
        { name: "Limited Edition", slug: "limited-edition", children: [] },
      ],
    },
  ];

  for (const [rootOrder, root] of categoryTree.entries()) {
    const rootCategory = await prisma.category.upsert({
      where: { slug: root.slug },
      update: { name: root.name, displayOrder: rootOrder },
      create: { name: root.name, slug: root.slug, displayOrder: rootOrder },
    });

    for (const [childOrder, child] of root.children.entries()) {
      const childCategory = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: rootCategory.id, displayOrder: childOrder },
        create: { name: child.name, slug: child.slug, parentId: rootCategory.id, displayOrder: childOrder },
      });

      for (const [grandchildOrder, grandchildName] of child.children.entries()) {
        const grandchildSlug = grandchildName
          .toLowerCase()
          .replace(/'/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        await prisma.category.upsert({
          where: { slug: grandchildSlug },
          update: { name: grandchildName, parentId: childCategory.id, displayOrder: grandchildOrder },
          create: { name: grandchildName, slug: grandchildSlug, parentId: childCategory.id, displayOrder: grandchildOrder },
        });
      }
    }
  }

  const attributes = [
    { name: "Shoe Size", slug: "shoe-size", displayType: "BUTTON" as const, values: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10"] },
    { name: "T-Shirt Size", slug: "t-shirt-size", displayType: "BUTTON" as const, values: ["XS", "S", "M", "L", "XL", "XXL"] },
    {
      name: "Color",
      slug: "color",
      displayType: "COLOR" as const,
      values: [
        { name: "Black", colorHex: "#111111" },
        { name: "White", colorHex: "#FFFFFF" },
        { name: "Red", colorHex: "#EF4444" },
        { name: "Blue", colorHex: "#3B82F6" },
      ],
    },
    { name: "Gender", slug: "gender", displayType: "SELECT" as const, values: ["Men", "Women", "Unisex", "Kids"] },
    { name: "Fit", slug: "fit", displayType: "BUTTON" as const, values: ["Regular", "Slim", "Oversized"] },
    { name: "Material", slug: "material", displayType: "SELECT" as const, values: ["Cotton", "Polyester", "Leather", "Mesh"] },
    { name: "Shoe Type", slug: "shoe-type", displayType: "SELECT" as const, values: ["Running", "Casual", "Sports"] },
  ];

  for (const [attributeOrder, item] of attributes.entries()) {
    const attribute = await prisma.attribute.upsert({
      where: { slug: item.slug },
      update: { name: item.name, displayType: item.displayType, displayOrder: attributeOrder },
      create: { name: item.name, slug: item.slug, displayType: item.displayType, displayOrder: attributeOrder },
    });

    for (const [valueOrder, rawValue] of item.values.entries()) {
      const value = typeof rawValue === "string" ? { name: rawValue, colorHex: null } : rawValue;
      const slug = value.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await prisma.attributeValue.upsert({
        where: { attributeId_slug: { attributeId: attribute.id, slug } },
        update: { name: value.name, colorHex: value.colorHex, displayOrder: valueOrder },
        create: { attributeId: attribute.id, name: value.name, slug, colorHex: value.colorHex, displayOrder: valueOrder },
      });
    }
  }

  for (const name of ["SoleVibe", "Nike", "Adidas", "Puma", "New Balance"]) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await prisma.brand.upsert({ where: { slug }, update: { name }, create: { name, slug } });
  }
}

main()
  .finally(async () => prisma.$disconnect());
