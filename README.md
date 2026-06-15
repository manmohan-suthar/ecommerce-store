# SoleVibe Authentication Backend

Direct PostgreSQL backend using Prisma ORM. Docker, Supabase, and Firebase are
not required.

## Current Scope

- Customer login with Google OAuth ID token
- Admin email/password login
- JWT authentication
- Prisma migrations and admin seed
- Protected category and sub-category management APIs
- Category hierarchy, SEO, ordering, status, and product reassignment foundation
- Product, order, and other commerce APIs are not included yet

## Prerequisites

- Node.js 20+
- PostgreSQL installed and running locally
- Google OAuth Web Client ID

## PostgreSQL Setup

Create a local database using pgAdmin or `psql`:

```sql
create database solevibe;
```

Copy `.env.example` to `.env`, then configure it for the target environment:

Local development:

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/solevibe
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
ADMIN_EMAIL=admin@solevibe.local
ADMIN_PASSWORD=change-this-admin-password
```

Neon or any hosted Postgres:

```env
NODE_ENV=production
PORT=4000
PUBLIC_API_URL=https://your-api-domain.com
FRONTEND_URL=https://your-frontend-domain.com
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxxx.region.aws.neon.tech/solevibe?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
ADMIN_EMAIL=admin@solevibe.local
ADMIN_PASSWORD=change-this-admin-password
```

For VPS hosting later, keep the same code and replace only `DATABASE_URL`,
`PUBLIC_API_URL`, and `FRONTEND_URL`.

## Prisma Migration

From `backend/`:

```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
```

For future schema changes during development:

```bash
npx prisma migrate dev --name describe_your_change
```

Inspect database records with:

```bash
npm run db:studio
```

## Start API

```bash
npm run dev
```

API URL: `http://localhost:4000/api/v1`

## Authentication API

- `POST /api/v1/auth/google`
- `POST /api/v1/auth/admin/login`
- `GET /api/v1/auth/me`

The frontend admin login route is `/dev`.

## Category Management API

All category routes require an admin bearer token.

- `GET /api/v1/admin/categories`
- `POST /api/v1/admin/categories`
- `PUT /api/v1/admin/categories/reorder`
- `PUT /api/v1/admin/categories/:categoryId`
- `PATCH /api/v1/admin/categories/:categoryId/status`
- `DELETE /api/v1/admin/categories/:categoryId`

Category create and update endpoints accept `multipart/form-data`. Use `image`
and `banner` fields for local image uploads. Files are stored under
`backend/uploads/categories`; the database stores relative paths, while API
responses expose full public URLs.

## Product Attribute Management API

All attribute routes require an admin bearer token.

- `GET /api/v1/admin/attributes`
- `POST /api/v1/admin/attributes`
- `PUT /api/v1/admin/attributes/reorder`
- `PUT /api/v1/admin/attributes/:attributeId`
- `PATCH /api/v1/admin/attributes/:attributeId/status`
- `DELETE /api/v1/admin/attributes/:attributeId`
- `POST /api/v1/admin/attributes/:attributeId/values`
- `PUT /api/v1/admin/attributes/:attributeId/values/reorder`
- `PUT /api/v1/admin/attributes/values/:valueId`
- `PATCH /api/v1/admin/attributes/values/:valueId/status`
- `DELETE /api/v1/admin/attributes/values/:valueId`

## Product Management API

Product routes require an admin bearer token and support simple/variable
products, categories, brands, tags, inventory, shipping, policies, SEO,
variations, bulk actions, and local media uploads.

- `GET /api/v1/admin/products`
- `GET /api/v1/admin/products/metadata`
- `GET /api/v1/admin/products/:id`
- `POST /api/v1/admin/products`
- `PUT /api/v1/admin/products/:id`
- `DELETE /api/v1/admin/products/:id`
- `POST /api/v1/admin/products/bulk`
- `POST /api/v1/admin/products/generate-variations`
- `POST /api/v1/admin/products/:id/media`
- `PATCH /api/v1/admin/products/media/:mediaId`
- `DELETE /api/v1/admin/products/media/:mediaId`
