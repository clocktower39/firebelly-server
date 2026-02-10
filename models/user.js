const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();
const SALT_WORK_FACTOR = Number(process.env.SALT_WORK_FACTOR);

const UserSchema = new mongoose.Schema({
    email: { type: String, index: { unique: true, sparse: true } },
    username: { type: String, index: { unique: true, sparse: true } },
    usernameLower: { type: String, index: { unique: true, sparse: true } },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    isTrainer: { type: Boolean, default: false },
    password: { type: String, required: true },
    phoneNumber: { type: String },
    dateOfBirth: { type: Date },
    accountType: {
        type: String,
        enum: ["adult", "guardian", "teen", "child"],
        default: "adult",
    },
    ageBand: {
        type: String,
        enum: ["u13", "13_15", "16_17", "18_plus"],
        default: null,
    },
    coppaStatus: {
        type: String,
        enum: ["needs_consent", "consented", "denied"],
        default: null,
    },
    consentScope: {
        type: String,
        enum: ["collection_only", "collection_and_disclosure"],
        default: null,
    },
    saleShareOptIn: { type: Boolean, default: false },
    adPersonalizationAllowed: { type: Boolean, default: false },
    coppaConsent: {
        method: { type: String },
        scope: { type: String },
        consentedAt: { type: Date },
        guardianId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    height: { type: String },
    sex: { type: String, },
    gymBarcode: { type: String, },
    profilePicture: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "profilePictures.files"
    },
    themeMode: { type: String, required: true, default: 'light', },
    customThemes: {
        type: [
            {
                id: { type: String, required: true },
                name: { type: String, required: true },
                colors: {
                    primary: { type: String, required: true },
                    secondary: { type: String, required: true },
                    backgroundDefault: { type: String, required: true },
                    backgroundPaper: { type: String, required: true },
                    textPrimary: { type: String, required: true },
                    textSecondary: { type: String, required: true },
                },
            },
        ],
        default: [],
    },
    weeklyFrequency: { type: Number, min: 1, max: 7 },
    preferredWorkoutDays: { type: [Number], default: [] },
    verified: {
        isVerified: { type: Boolean, default: false },
        verificationToken: { type: String, default: null },
        verificationTokenExpires: { type: Date, default: null },
      },
      
}, { minimize: false })

UserSchema.pre('save', function(next) {
    let user = this;

    if (user.username) {
        user.usernameLower = user.username.toLowerCase();
    }

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
