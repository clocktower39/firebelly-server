process.env.NODE_ENV = "test";
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "test-access-secret";
process.env.SALT_WORK_FACTOR = process.env.SALT_WORK_FACTOR || "4";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../app");
const Exercise = require("../models/exercise");
const Group = require("../models/group");
const GroupMembership = require("../models/groupMembership");
const RefreshToken = require("../models/refreshToken");
const Relationship = require("../models/relationship");
const ScheduleEvent = require("../models/scheduleEvent");
const Training = require("../models/training");
const User = require("../models/user");

let mongo;

const createUser = (overrides = {}) =>
  new User({
    firstName: overrides.firstName || "Test",
    lastName: overrides.lastName || "User",
    email: overrides.email,
    password: overrides.password || "password123",
    isTrainer: Boolean(overrides.isTrainer),
    verified: { isVerified: true },
    ...overrides,
  }).save();

const login = async (email, password = "password123") => {
  const agent = request.agent(app);
  const response = await agent.post("/login").send({ email, password }).expect(200);
  assert.ok(response.body.accessToken);
  return { agent, accessToken: response.body.accessToken, response };
};

const auth = (accessToken) => `Bearer ${accessToken}`;

test.before(async () => {
  mongo = await MongoMemoryServer.create({
    binary: { systemBinary: "/usr/bin/mongod" },
  });
  await mongoose.connect(mongo.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test.beforeEach(async () => {
  await Promise.all([
    Exercise.deleteMany({}),
    Group.deleteMany({}),
    GroupMembership.deleteMany({}),
    RefreshToken.deleteMany({}),
    Relationship.deleteMany({}),
    ScheduleEvent.deleteMany({}),
    Training.deleteMany({}),
    User.deleteMany({}),
  ]);
});

test("auth login sets an httpOnly refresh cookie and cookie refresh rotates server-side tokens", async () => {
  await createUser({ email: "client@example.com" });

  const { agent, response } = await login("client@example.com");
  assert.match(response.headers["set-cookie"].join(";"), /fb_refresh=/);
  assert.equal(Object.hasOwn(response.body, "refreshToken"), false);

  const firstTokenCount = await RefreshToken.countDocuments();
  const refreshResponse = await agent.post("/refresh-tokens").send({ refreshToken: "ignored" }).expect(200);
  assert.ok(refreshResponse.body.accessToken);
  assert.equal(Object.hasOwn(refreshResponse.body, "refreshToken"), false);

  const tokens = await RefreshToken.find().lean();
  assert.equal(tokens.length, firstTokenCount + 1);
  assert.equal(tokens.filter((token) => token.revokedAt).length, 1);
});

test("trainer/client workout writes allow accepted trainers and reject unrelated users", async () => {
  const trainer = await createUser({ email: "trainer@example.com", isTrainer: true });
  const client = await createUser({ email: "client@example.com" });
  await createUser({ email: "other@example.com", isTrainer: true });
  await Relationship.create({ trainer: trainer._id, client: client._id, accepted: true, requestedBy: "client" });
  const exercise = await Exercise.create({ exerciseTitle: "Squat", verified: true });

  const { accessToken: trainerToken } = await login("trainer@example.com");
  const { accessToken: otherToken } = await login("other@example.com");

  const created = await request(app)
    .post("/createTraining")
    .set("Authorization", auth(trainerToken))
    .send({
      userId: client._id.toString(),
      title: "Client workout",
      date: new Date().toISOString(),
      category: ["Strength"],
      training: [[{ exercise: exercise._id.toString(), exerciseType: "Reps" }]],
    })
    .expect(200);

  assert.equal(created.body.training.user, client._id.toString());

  await request(app)
    .post("/updateTraining")
    .set("Authorization", auth(otherToken))
    .send({ _id: created.body.training._id, training: { title: "Hacked" } })
    .expect(403);
});

test("schedule writes are scoped to the owning trainer", async () => {
  const trainer = await createUser({ email: "trainer@example.com", isTrainer: true });
  const client = await createUser({ email: "client@example.com" });
  await createUser({ email: "other@example.com", isTrainer: true });
  await Relationship.create({ trainer: trainer._id, client: client._id, accepted: true, requestedBy: "client" });

  const { accessToken: trainerToken } = await login("trainer@example.com");
  const { accessToken: otherToken } = await login("other@example.com");
  const startDateTime = new Date(Date.now() + 60 * 60 * 1000);
  const endDateTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const created = await request(app)
    .post("/schedule/event/create")
    .set("Authorization", auth(trainerToken))
    .send({
      clientId: client._id.toString(),
      eventType: "APPOINTMENT",
      status: "BOOKED",
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
    })
    .expect(200);

  await request(app)
    .post("/schedule/event/update")
    .set("Authorization", auth(otherToken))
    .send({ _id: created.body.event._id, updates: { notes: "not mine" } })
    .expect(403);
});

test("group writes require group trainer membership", async () => {
  await createUser({ email: "trainer@example.com", isTrainer: true });
  await createUser({ email: "other@example.com", isTrainer: true });
  const { accessToken: trainerToken } = await login("trainer@example.com");
  const { accessToken: otherToken } = await login("other@example.com");

  const created = await request(app)
    .post("/groups")
    .set("Authorization", auth(trainerToken))
    .send({ name: "Powerlifting Team" })
    .expect(200);

  await request(app)
    .put(`/groups/${created.body.group._id}`)
    .set("Authorization", auth(otherToken))
    .send({ name: "Renamed" })
    .expect(403);
});

test("billing adjustment writes require the authenticated trainer to own trainerId", async () => {
  const trainer = await createUser({ email: "trainer@example.com", isTrainer: true });
  const client = await createUser({ email: "client@example.com" });
  await createUser({ email: "other@example.com", isTrainer: true });
  const { accessToken: trainerToken } = await login("trainer@example.com");
  const { accessToken: otherToken } = await login("other@example.com");

  await request(app)
    .post("/billing/ledger/adjust")
    .set("Authorization", auth(trainerToken))
    .send({ trainerId: trainer._id.toString(), clientId: client._id.toString(), delta: 1 })
    .expect(200);

  await request(app)
    .post("/billing/ledger/adjust")
    .set("Authorization", auth(otherToken))
    .send({ trainerId: trainer._id.toString(), clientId: client._id.toString(), delta: 1 })
    .expect(403);
});
