const express = require("express");
const groupController = require("../controllers/groupController");
const { verifyAccessToken } = require("../middleware/auth");

const router = express.Router();

router.post("/groups", verifyAccessToken, groupController.create_group);
router.get("/groups", verifyAccessToken, groupController.list_groups);
router.get("/groups/:groupId", verifyAccessToken, groupController.get_group);
router.put("/groups/:groupId", verifyAccessToken, groupController.update_group);

router.get("/groups/:groupId/members", verifyAccessToken, groupController.list_members);
router.post("/groups/:groupId/members", verifyAccessToken, groupController.add_member);
router.post("/groups/:groupId/member-search", verifyAccessToken, groupController.search_group_users);
router.put("/groups/:groupId/members/:memberId", verifyAccessToken, groupController.update_member);
router.delete("/groups/:groupId/members/:memberId", verifyAccessToken, groupController.remove_member);

router.get("/groups/:groupId/assignments", verifyAccessToken, groupController.list_group_assignments);
router.post("/groups/:groupId/assignments", verifyAccessToken, groupController.assign_program_to_group);

module.exports = router;
