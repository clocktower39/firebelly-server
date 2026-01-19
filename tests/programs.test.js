const test = require("node:test");
const assert = require("node:assert/strict");
const { buildProgramWeeks, validatePublish } = require("../services/programs");

test("buildProgramWeeks preserves existing workouts", () => {
  const existing = [
    [
      { dayIndex: 1, workoutId: "w1", notes: "keep" },
      { dayIndex: 2, workoutId: "w2", notes: "" },
    ],
  ];
  const result = buildProgramWeeks(2, 3, existing);
  assert.equal(result.length, 2);
  assert.equal(result[0].length, 3);
  assert.equal(result[0][0].workoutId, "w1");
  assert.equal(result[0][1].workoutId, "w2");
  assert.equal(result[1][0].workoutId, null);
});

test("validatePublish enforces required fields", () => {
  const errors = validatePublish({
    title: "",
    weeksCount: 0,
    daysPerWeek: 0,
    weeks: [],
  });
  assert.ok(errors.length >= 3);
});
