const { GridFsStorage } = require('multer-gridfs-storage');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
require("dotenv").config();

const dbUrl = process.env.DBURL;

// Profile Picture Storage
const profilePictureStorage = new GridFsStorage({
    url: dbUrl,
    options: {useUnifiedTopology: true},
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString("hex") + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: "profilePicture",
                };
                resolve(fileInfo);
            });
        });
    }
});

const uploadProfilePicture = multer({
    storage: profilePictureStorage,
    limits: { fileSize: 1000000}
});

module.exports = {
    uploadProfilePicture
}