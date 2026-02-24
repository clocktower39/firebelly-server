const express = require("express");
const invoiceController = require("../controllers/invoiceController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

const router = express.Router();

router.post("/invoices", verifyAccessToken, ensureWriteAccess, invoiceController.create_invoice);
router.post("/invoices/list", verifyAccessToken, invoiceController.list_invoices);
router.post("/invoices/detail", verifyAccessToken, invoiceController.get_invoice);
router.post("/invoices/status", verifyAccessToken, ensureWriteAccess, invoiceController.update_invoice_status);
router.post("/invoices/payment", verifyAccessToken, ensureWriteAccess, invoiceController.record_payment);
router.post("/invoices/pdf", verifyAccessToken, invoiceController.export_invoice_pdf);
router.post("/invoices/email", verifyAccessToken, ensureWriteAccess, invoiceController.email_invoice);

module.exports = router;
