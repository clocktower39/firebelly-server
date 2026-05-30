process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "test-access-secret";

const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyAccessToken } = require("../middleware/auth");
const userController = require("../controllers/userController");
const User = require("../models/user");
const RefreshToken = require("../models/refreshToken");
const { createMockRes } = require("./helpers");

test("verifyAccessToken returns 401 when bearer token is missing", async () => {
  const req = { headers: {} };
  const res = createMockRes();
  let nextCalled = false;

  verifyAccessToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("login_user sets httpOnly refresh cookie and does not return refresh token in JSON", async () => {
  const originalFindOne = User.findOne;
  const originalSave = RefreshToken.prototype.save;
  try {
    User.findOne = async () => ({
      _id: "507f1f77bcf86cd799439011",
      email: "client@example.com",
      firstName: "Client",
      lastName: "User",
      verified: { isVerified: true },
      comparePassword: async () => true,
    });
    RefreshToken.prototype.save = async function save() {
      return this;
    };

    const req = {
      body: { email: "client@example.com", password: "secret" },
      headers: { "user-agent": "node-test" },
      ip: "127.0.0.1",
      socket: {},
    };
    const res = createMockRes();

    await userController.login_user(req, res, (err) => {
      throw err;
    });

    assert.ok(res.body.accessToken);
    assert.equal(Object.hasOwn(res.body, "refreshToken"), false);
    assert.equal(res.cookies.length, 1);
    assert.equal(res.cookies[0].name, "fb_refresh");
    assert.equal(res.cookies[0].options.httpOnly, true);
  } finally {
    User.findOne = originalFindOne;
    RefreshToken.prototype.save = originalSave;
  }
});
