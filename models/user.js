const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();
const SALT_WORK_FACTOR = Number(process.env.SALT_WORK_FACTOR);

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, index: { unique: true } },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    phoneNumber: { type: String },
    dateOfBirth: { type: Date },
    height: { type: String },
    sex: { type: String, },
    gymBarcode: { type: String, },
    profilePicture: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "profilePictures.files"
    },
    themeMode: { type: String, required: true, default: 'light', },
}, { minimize: false })

UserSchema.pre('save', function(next) {
    let user = this;

    // only hash the password if it has been modified (or is new)
    if (!user.isModified('password')) return next();

    // generate a salt
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) return next(err);

        // hash the password using our new salt
        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);
            // override the cleartext password with the hashed one
            user.password = hash;
            next();
        });
    });
});

UserSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);
module.exports = User;