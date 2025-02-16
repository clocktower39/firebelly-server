const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const http = require("http").Server(app);
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { ValidationError } = require("express-validation");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const exerciseRoutes = require("./routes/exerciseRoutes");
const trainingRoutes = require("./routes/trainingRoutes");
const nutritionRoutes = require("./routes/nutritionRoutes");
const taskRoutes = require("./routes/taskRoutes");
const relationshipRoutes = require("./routes/relationshipRoutes");
const goalRoutes = require("./routes/goalRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const methodOverride = require("method-override");
global.io = require("./io").initialize(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});
const dayjs = require("dayjs");
const advancedFormat = require("dayjs/plugin/advancedFormat");
const utc = require("dayjs/plugin/utc");

dayjs.extend(utc);
dayjs.extend(advancedFormat);

// require('dotenv').config();
const dbUrl = process.env.DBURL;
let PORT = process.env.PORT;
if (PORT == null || PORT == "") {
  PORT = 8000;
}
const SALT_WORK_FACTOR = Number(process.env.SALT_WORK_FACTOR);
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

app.use(cors());
app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride("_method"));

app.use("/", userRoutes);
app.use("/", exerciseRoutes);
app.use("/", trainingRoutes);
app.use("/", nutritionRoutes);
app.use("/", taskRoutes);
app.use("/", relationshipRoutes);
app.use("/", goalRoutes);
app.use("/", conversationRoutes);

const connectedClients = {};

global.io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;

  // Save the user's socket ID
  connectedClients[userId] = socket.id;

  // Notify all trainers about the client's online status
  global.io.emit("clientStatusChanged", { userId, status: "online" });

  console.log(`${userId} connected with IP: ${socket.conn.remoteAddress}`);

  // Listen for a trainer or client joining a workout room
  socket.on("joinWorkout", ({ workoutId }) => {
    if (workoutId) {
      socket.join(workoutId);
      console.log(`Socket ${socket.id} joined workout room ${workoutId}`);

      // Optionally, notify other users in the room that someone joined
      socket.to(workoutId).emit("userJoined", { socketId: socket.id });
    }
  });

  // Listen for a trainer or client leaving a workout room
  socket.on("leaveWorkout", ({ workoutId }) => {
    if (workoutId) {
      socket.leave(workoutId);
      console.log(`Socket ${socket.id} left workout room ${workoutId}`);

      // Optionally, notify others in the room that someone left
      socket.to(workoutId).emit("userLeft", { socketId: socket.id });
    }
  });

  socket.on("liveTrainingUpdate", ({ workoutId, updatedTraining }) => {
    // Broadcast the update to all other clients in the room
    console.log(new Date())
    socket.to(workoutId).emit("liveTrainingUpdate", updatedTraining);
  });

  // Listen for the 'requestClientStatuses' event and send the current status
  socket.on("requestClientStatuses", () => {
    const clientStatuses = Object.keys(connectedClients).reduce((statuses, id) => {
      statuses[id] = "online";
      return statuses;
    }, {});
    socket.emit("currentClientStatuses", clientStatuses);
  });

  socket.on("disconnect", () => {
    // Remove the client from the connectedClients object
    delete connectedClients[userId];

    // Notify all trainers about the client's offline status
    global.io.emit("clientStatusChanged", { userId, status: "offline" });

    console.log(`${userId} disconnected`);
  });
});

const connectToDB = async () => {
  try {
    await mongoose.connect(dbUrl);
    console.log("MongoDB connection successful");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
};

connectToDB();

// Error handling Function
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json(err);
  }
  console.error(err.stack);
  res.status(500).send(err.stack);
});

let server = http.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
