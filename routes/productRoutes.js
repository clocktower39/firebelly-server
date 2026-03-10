const express = require("express");
const productController = require("../controllers/productController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

const router = express.Router();

router.get("/products", verifyAccessToken, productController.list_products);
router.post("/products", verifyAccessToken, ensureWriteAccess, productController.create_product);
router.put("/products/:id", verifyAccessToken, ensureWriteAccess, productController.update_product);
router.delete(
  "/products/:id",
  verifyAccessToken,
  ensureWriteAccess,
  productController.delete_product
);

module.exports = router;
