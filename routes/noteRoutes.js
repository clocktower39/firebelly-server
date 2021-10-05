const express = require('express');
const noteController = require('../controllers/noteController');

const router = express.Router();

router.post('/note', noteController.get_note);
router.post('/createNote', noteController.create_note);
router.post('/updateNote', noteController.update_note);

module.exports = router;