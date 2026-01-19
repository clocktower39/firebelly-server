const buildProgramWeeks = (weeksCount, daysPerWeek, existingWeeks = []) => {
  const weeks = [];
  for (let weekIndex = 0; weekIndex < weeksCount; weekIndex += 1) {
    const days = [];
    for (let dayIndex = 0; dayIndex < daysPerWeek; dayIndex += 1) {
      const existingDay = existingWeeks?.[weekIndex]?.[dayIndex];
      days.push({
        dayIndex: dayIndex + 1,
        workoutId: existingDay?.workoutId || null,
        notes: existingDay?.notes || "",
      });
    }
    weeks.push(days);
  }
  return weeks;
};

const validatePublish = (program, { requireWorkout = true } = {}) => {
  const errors = [];
  if (!program.title || !program.title.trim()) {
    errors.push("Title is required to publish.");
  }
  if (!program.weeksCount || program.weeksCount < 1) {
    errors.push("Weeks count must be at least 1.");
  }
  if (!program.daysPerWeek || program.daysPerWeek < 1) {
    errors.push("Days per week must be at least 1.");
  }
  if (requireWorkout) {
    const hasWorkout = program.weeks?.some((week) =>
      week?.some((day) => Boolean(day?.workoutId))
    );
    if (!hasWorkout) {
      errors.push("Assign at least one workout before publishing.");
    }
  }
  return errors;
};

module.exports = {
  buildProgramWeeks,
  validatePublish,
};
