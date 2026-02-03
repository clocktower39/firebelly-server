const mongoose = require("mongoose");

const groupProgramAssignmentSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: "Program", required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    dayMap: { type: [Number], default: null },
    autoAddNewMembers: { type: Boolean, default: false },
  },
  { timestamps: true, minimize: false }
);

groupProgramAssignmentSchema.index({ groupId: 1, programId: 1, startDate: 1 });

const GroupProgramAssignment = mongoose.model("GroupProgramAssignment", groupProgramAssignmentSchema);
module.exports = GroupProgramAssignment;
