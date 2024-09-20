const multer = require('multer');
const mongoose = require('mongoose');

// Use memory storage to temporarily store the file in memory before uploading to GridFS
const storage = multer.memoryStorage();

const uploadProfilePicture = multer({
    storage,
    limits: { fileSize: 1000000 } // 1MB limit
});

module.exports = {
    uploadProfilePicture
};
