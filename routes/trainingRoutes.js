const express = require('express');
const trainingController = require('../controllers/trainingController');
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { validate, Joi } = require("express-validation");
const router = express.Router();

const objectId = Joi.string().hex().length(24);
const trainingFields = {
  title: Joi.string().allow("").optional(),
  date: Joi.date().optional(),
  workoutType: Joi.string().allow("").optional(),
  cardio: Joi.object().unknown(true).optional(),
  category: Joi.array().items(Joi.string().allow("")).optional(),
  training: Joi.array().items(Joi.array().items(Joi.object().unknown(true))).optional(),
  workoutFeedback: Joi.object().unknown(true).optional(),
  queuePosition: Joi.number().optional(),
  isTemplate: Joi.boolean().optional(),
  complete: Joi.boolean().optional(),
};
const createTrainingValidate = {
  body: Joi.object({
    userId: objectId.optional(),
    ...trainingFields,
  }),
};
const updateTrainingValidate = {
  body: Joi.object({
    _id: objectId.required(),
    training: Joi.object(trainingFields).unknown(true).required(),
  }),
};
const idBodyValidate = {
  body: Joi.object({
    _id: objectId.required(),
  }).unknown(true),
};

router.post('/training', verifyAccessToken, trainingController.get_training_by_id);
router.post('/workouts', verifyAccessToken, trainingController.get_workouts_by_date);
router.post('/updateTraining', validate(updateTrainingValidate, {}, {}), verifyAccessToken, ensureWriteAccess, trainingController.update_training);
router.post('/createTraining', validate(createTrainingValidate, {}, {}), verifyAccessToken, ensureWriteAccess, trainingController.create_training);
router.post('/trainingWeek', verifyAccessToken, trainingController.get_weekly_training);
router.post('/exerciseHistory', verifyAccessToken, trainingController.get_exercise_history);
router.post('/exerciseProgressSummary', verifyAccessToken, trainingController.get_exercise_progress_summary);
router.post('/myExerciseList', verifyAccessToken, trainingController.get_exercise_list);
router.post('/copyWorkoutById', verifyAccessToken, ensureWriteAccess, trainingController.copy_workout_by_id);
router.post('/updateWorkoutDateById', validate(idBodyValidate, {}, {}), verifyAccessToken, ensureWriteAccess, trainingController.update_workout_date_by_id);
router.post('/workoutsRange', verifyAccessToken, trainingController.get_workouts_by_range);
router.post('/trainingRangeEnd', verifyAccessToken, trainingController.get_training_range_end);
router.post('/bulkMoveCopyWorkouts', verifyAccessToken, ensureWriteAccess, trainingController.bulk_move_copy_workouts);
router.post('/undoBulkMoveCopy', verifyAccessToken, ensureWriteAccess, trainingController.undo_bulk_move_copy);
router.post('/deleteWorkoutById', validate(idBodyValidate, {}, {}), verifyAccessToken, ensureWriteAccess, trainingController.delete_workout_by_id);
router.post('/getWorkoutHistory', verifyAccessToken, trainingController.workout_history_request);
router.post('/workoutMonth', verifyAccessToken, trainingController.workout_month_request);
router.post('/workoutYear', verifyAccessToken, trainingController.workout_year_request);
router.post('/workoutTemplates', verifyAccessToken, trainingController.workout_templates_request);
router.get('/getWorkoutQueue', verifyAccessToken, trainingController.get_workout_queue);

module.exports = router;
