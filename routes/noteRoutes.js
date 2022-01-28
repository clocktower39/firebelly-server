const express = require('express');
const noteController = require('../controllers/noteController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/notes', auth, noteController.get_notes);
router.post('/createNote', auth, noteController.create_note);
router.post('/updateNote', auth, noteController.update_note);

module.exports = router;