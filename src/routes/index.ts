import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { categoryRouter } from "../modules/categories/category.routes.js";
import { publicCategoryRouter } from "../modules/categories/public-category.routes.js";
import { attributeRouter } from "../modules/attributes/attribute.routes.js";
import { productRouter } from "../modules/products/product.routes.js";
import { publicProductRouter } from "../modules/products/public-product.routes.js";
import { inventoryRouter } from "../modules/inventory/inventory.routes.js";
import { customerProfileRouter } from "../modules/customer-profile/customer-profile.routes.js";
import { customersRouter } from "../modules/customers/customers.routes.js";
import { ordersRouter } from "../modules/orders/orders.routes.js";
import { adminOrdersRouter } from "../modules/orders/admin-orders.routes.js";
import { paymentSettingsRouter, publicPaymentSettingsRouter } from "../modules/payment-settings/payment-settings.routes.js";
import { adminReviewRouter, reviewRouter } from "../modules/reviews/review.routes.js";
import { adminPromoRouter, promoRouter } from "../modules/promos/promo.routes.js";
import { homepageSettingsRouter, publicHomepageSettingsRouter } from "../modules/homepage-settings/homepage-settings.routes.js";
import { publicThemeSettingsRouter, themeSettingsRouter } from "../modules/theme-settings/theme-settings.routes.js";
import { publicSiteSettingsRouter, siteSettingsRouter } from "../modules/site-settings/site-settings.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "solevibe-api",
    timestamp: new Date().toISOString(),
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/categories", publicCategoryRouter);
apiRouter.use("/products", publicProductRouter);
apiRouter.use("/admin/categories", categoryRouter);
apiRouter.use("/admin/attributes", attributeRouter);
apiRouter.use("/admin/products", productRouter);
apiRouter.use("/admin/inventory", inventoryRouter);
apiRouter.use("/admin/customers", customersRouter);
apiRouter.use("/admin/orders", adminOrdersRouter);
apiRouter.use("/admin/payment-settings", paymentSettingsRouter);
apiRouter.use("/admin/reviews", adminReviewRouter);
apiRouter.use("/admin/promos", adminPromoRouter);
apiRouter.use("/admin/homepage-settings", homepageSettingsRouter);
apiRouter.use("/admin/theme-settings", themeSettingsRouter);
apiRouter.use("/admin/site-settings", siteSettingsRouter);
apiRouter.use("/customer-profile", customerProfileRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/payments", publicPaymentSettingsRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/promos", promoRouter);
apiRouter.use("/homepage", publicHomepageSettingsRouter);
apiRouter.use("/theme", publicThemeSettingsRouter);
apiRouter.use("/site-settings", publicSiteSettingsRouter);
