const express = require("express");
const groupController = require("../controllers/groupController");
const { verifyAccessToken } = require("../middleware/auth");
const { uploadGroupPicture } = require("../mygridfs");

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

router.post(
  "/groups/:groupId/picture",
  verifyAccessToken,
  uploadGroupPicture.single("file"),
  groupController.upload_group_picture
);
router.get("/groups/picture/:id", groupController.get_group_picture);
router.delete("/groups/:groupId/picture", verifyAccessToken, groupController.delete_group_picture);

router.post("/groups/:groupId/invitations", verifyAccessToken, groupController.create_invite);
router.get("/groups/:groupId/invitations", verifyAccessToken, groupController.list_invites);
router.delete(
  "/groups/:groupId/invitations/:inviteId",
  verifyAccessToken,
  groupController.revoke_invite
);
router.get("/groups/invitations/:token", groupController.get_invite_by_token);
router.post("/groups/invitations/accept", verifyAccessToken, groupController.accept_invite);

router.get("/groups/:groupId/analytics", verifyAccessToken, groupController.get_group_analytics);
router.put("/groups/:groupId/billing", verifyAccessToken, groupController.update_group_billing);

module.exports = router;
