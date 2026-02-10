const express = require("express");
const metricController = require("../controllers/metricController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

const router = express.Router();

router.post("/metrics/create", verifyAccessToken, ensureWriteAccess, metricController.create_metric_entry);
router.post("/metrics/update", verifyAccessToken, ensureWriteAccess, metricController.update_metric_entry);
router.post("/metrics/delete", verifyAccessToken, ensureWriteAccess, metricController.delete_metric_entry);
router.post("/metrics/list", verifyAccessToken, metricController.list_metrics);
router.post("/metrics/pending", verifyAccessToken, metricController.list_pending_metrics);
router.post("/metrics/review", verifyAccessToken, ensureWriteAccess, metricController.review_metric);
router.post("/metrics/latest", verifyAccessToken, metricController.latest_metric);

module.exports = router;
