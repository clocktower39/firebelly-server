process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "test-access-secret";

const test = require("node:test");
const assert = require("node:assert/strict");
const trainingController = require("../controllers/trainingController");
const scheduleController = require("../controllers/scheduleController");
const billingController = require("../controllers/billingController");
const userController = require("../controllers/userController");
const Training = require("../models/training");
const ScheduleEvent = require("../models/scheduleEvent");
const Relationship = require("../models/relationship");
const User = require("../models/user");
const { createMockRes, createThenableQuery } = require("./helpers");

test("update_training rejects non-owner/non-trainer before writing", async () => {
  const originalFindById = Training.findById;
  const originalFindByIdAndUpdate = Training.findByIdAndUpdate;
  const originalFindOne = Relationship.findOne;
  let updateCalled = false;

  try {
    Training.findById = () => ({ lean: async () => ({ _id: "workout1", user: "client1" }) });
    Training.findByIdAndUpdate = () => {
      updateCalled = true;
      return createThenableQuery({ _id: "workout1", user: "client1" });
    };
    Relationship.findOne = async () => null;

    const req = { body: { _id: "workout1", training: { complete: true } } };
    const res = createMockRes();
    res.locals.user = { _id: "other-user", isTrainer: true };

    await trainingController.update_training(req, res, (err) => {
      throw err;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(updateCalled, false);
  } finally {
    Training.findById = originalFindById;
    Training.findByIdAndUpdate = originalFindByIdAndUpdate;
    Relationship.findOne = originalFindOne;
  }
});

test("update_training allows accepted trainer and strips protected workout fields", async () => {
  const originalFindById = Training.findById;
  const originalFindByIdAndUpdate = Training.findByIdAndUpdate;
  const originalRelationshipFindOne = Relationship.findOne;
  const originalScheduleFindOne = ScheduleEvent.findOne;
  let capturedUpdate;

  try {
    Training.findById = () => ({ lean: async () => ({ _id: "workout1", user: "client1", complete: false }) });
    Training.findByIdAndUpdate = (_id, update) => {
      capturedUpdate = update;
      return createThenableQuery({ _id: "workout1", user: "client1", complete: false });
    };
    Relationship.findOne = async () => ({ trainer: "trainer1", client: "client1", accepted: true });
    ScheduleEvent.findOne = async () => null;

    const req = {
      body: {
        _id: "workout1",
        training: {
          title: "Allowed",
          complete: false,
          user: "attacker",
          assignedBy: "attacker",
        },
      },
    };
    const res = createMockRes();
    res.locals.user = { _id: "trainer1", isTrainer: true };

    await trainingController.update_training(req, res, (err) => {
      throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedUpdate, { $set: { title: "Allowed", complete: false } });
  } finally {
    Training.findById = originalFindById;
    Training.findByIdAndUpdate = originalFindByIdAndUpdate;
    Relationship.findOne = originalRelationshipFindOne;
    ScheduleEvent.findOne = originalScheduleFindOne;
  }
});

test("update_user whitelists profile fields and blocks role/verification mass assignment", async () => {
  const originalFindById = User.findById;
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  let capturedUpdate;

  try {
    User.findById = async () => ({ _id: "user1", isTrainer: false });
    User.findByIdAndUpdate = async (_id, update) => {
      capturedUpdate = update;
      return {
        _id,
        firstName: update.$set.firstName,
        lastName: "User",
        isTrainer: false,
        themeMode: "light",
      };
    };

    const req = {
      body: {
        firstName: "Updated",
        isTrainer: true,
        verified: { isVerified: true },
      },
    };
    const res = createMockRes();
    res.locals.user = { _id: "user1" };

    await userController.update_user(req, res, (err) => {
      throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedUpdate, { $set: { firstName: "Updated" } });
  } finally {
    User.findById = originalFindById;
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("update_schedule_event strips protected event fields", async () => {
  const originalFindById = ScheduleEvent.findById;
  const originalFindByIdAndUpdate = ScheduleEvent.findByIdAndUpdate;
  let capturedUpdate;

  try {
    ScheduleEvent.findById = async () => ({
      _id: "event1",
      trainerId: "trainer1",
      eventType: "APPOINTMENT",
      status: "BOOKED",
    });
    ScheduleEvent.findByIdAndUpdate = (_id, update) => {
      capturedUpdate = update;
      return createThenableQuery({
        _id,
        trainerId: "trainer1",
        eventType: "APPOINTMENT",
        status: "BOOKED",
      });
    };

    const req = {
      body: {
        _id: "event1",
        updates: {
          notes: "Allowed",
          trainerId: "attacker",
          createdAt: new Date(),
        },
      },
    };
    const res = createMockRes();
    res.locals.user = { _id: "trainer1" };

    await scheduleController.update_schedule_event(req, res, (err) => {
      throw err;
    });

    assert.deepEqual(capturedUpdate, { $set: { notes: "Allowed" } });
  } finally {
    ScheduleEvent.findById = originalFindById;
    ScheduleEvent.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("billing adjustment rejects non-trainer-owner writes", async () => {
  const req = {
    body: {
      trainerId: "507f1f77bcf86cd799439011",
      clientId: "507f1f77bcf86cd799439012",
      delta: 1,
    },
  };
  const res = createMockRes();
  res.locals.user = { _id: "507f1f77bcf86cd799439013", isTrainer: true };

  await billingController.create_adjustment(req, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 403);
});
