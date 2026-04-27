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
const relationshipRoutes = require("./routes/relationshipRoutes");
const goalRoutes = require("./routes/goalRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const programRoutes = require("./routes/programRoutes");
const groupRoutes = require("./routes/groupRoutes");
const trainerConnectionRoutes = require("./routes/trainerConnectionRoutes");
const metricRoutes = require("./routes/metricRoutes");
const guardianRoutes = require("./routes/guardianRoutes");
const billingRoutes = require("./routes/billingRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const productRoutes = require("./routes/productRoutes");
const GuardianLink = require("./models/guardianLink");
const User = require("./models/user");
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
app.use("/", relationshipRoutes);
app.use("/", goalRoutes);
app.use("/", conversationRoutes);
app.use("/", scheduleRoutes);
app.use("/", sessionRoutes);
app.use("/", programRoutes);
app.use("/", groupRoutes);
app.use("/", trainerConnectionRoutes);
app.use("/", metricRoutes);
app.use("/", guardianRoutes);
app.use("/", billingRoutes);
app.use("/", invoiceRoutes);
app.use("/", productRoutes);

const connectedClients = {};
const pagePresenceBySocket = new Map();

const getPagePresenceRoom = (pageKey) => `page:${pageKey}`;

const normalizePresenceUser = (user = {}) => ({
  userId: user.userId || null,
  firstName: user.firstName || "",
  lastName: user.lastName || "",
  profilePicture: user.profilePicture || null,
  role: user.role || "member",
  delegationMode: user.delegationMode || null,
});

const getPagePresenceUsers = (pageKey) => {
  const users = [];
  pagePresenceBySocket.forEach((presence, socketId) => {
    if (presence.pageKey === pageKey) {
      users.push({
        ...presence.user,
        socketId,
      });
    }
  });
  return users;
};

const emitPagePresence = (pageKey) => {
  if (!pageKey) return;
  global.io.to(getPagePresenceRoom(pageKey)).emit("pagePresence", {
    pageKey,
    users: getPagePresenceUsers(pageKey),
  });
};

global.io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;

  // Save the user's socket ID
  connectedClients[userId] = socket.id;

  // Notify all trainers about the client's online status
  global.io.emit("clientStatusChanged", { userId, status: "online" });

  console.log(`${userId} connected with IP: ${socket.conn.remoteAddress}`);

  // Listen for a trainer or client joining a workout room
  socket.on("joinWorkout", ({ workoutId }) => {
    socket.join(workoutId);
    console.log(`Socket ${socket.id} joined workout room ${workoutId}`);
    // Notify other clients in the room that a new user joined.
    socket.to(workoutId).emit("userJoined", { newUser: socket.id, workoutId });
  });

  socket.on("leaveWorkout", ({ workoutId }) => {
    socket.leave(workoutId);
    console.log(`Socket ${socket.id} left workout room ${workoutId}`);
  });

  socket.on("joinWorkoutAccount", ({ accountId }) => {
    if (!accountId) return;
    socket.join(`workouts:${accountId}`);
  });

  socket.on("leaveWorkoutAccount", ({ accountId }) => {
    if (!accountId) return;
    socket.leave(`workouts:${accountId}`);
  });

  socket.on("joinPagePresence", ({ pageKey, user }) => {
    if (!pageKey) return;

    const previousPresence = pagePresenceBySocket.get(socket.id);
    if (previousPresence?.pageKey && previousPresence.pageKey !== pageKey) {
      socket.leave(getPagePresenceRoom(previousPresence.pageKey));
      pagePresenceBySocket.delete(socket.id);
      emitPagePresence(previousPresence.pageKey);
    }

    socket.join(getPagePresenceRoom(pageKey));
    pagePresenceBySocket.set(socket.id, {
      pageKey,
      user: normalizePresenceUser(user),
    });
    emitPagePresence(pageKey);
  });

  socket.on("leavePagePresence", ({ pageKey }) => {
    const activePresence = pagePresenceBySocket.get(socket.id);
    const activePageKey = pageKey || activePresence?.pageKey;
    if (!activePageKey) return;

    socket.leave(getPagePresenceRoom(activePageKey));
    pagePresenceBySocket.delete(socket.id);
    emitPagePresence(activePageKey);
  });

  // When a client requests the current state, broadcast the request to all others in the room
  socket.on("requestCurrentState", ({ workoutId }) => {
    // Broadcast to everyone else in the room so that one of them can reply.
    socket.to(workoutId).emit("requestCurrentState", {
      requester: socket.id,
      workoutId,
    });
  });

  // When a client sends its current state, relay it directly to the requester.
  socket.on("currentState", ({ workoutId, currentState, requester }) => {
    global.io.to(requester).emit("currentState", { workoutId, currentState });
  });

  // Relay live updates to everyone except the sender.
  socket.on("liveTrainingUpdate", ({ workoutId, updatedTraining, workout, accountId }) => {
    const payload = { workoutId, updatedTraining, workout, accountId };
    socket.to(workoutId).emit("liveTrainingUpdate", payload);

    if (workout?._id && accountId) {
      socket.to(`workouts:${accountId}`).emit("workoutUpdated", payload);
    }
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
    const activePresence = pagePresenceBySocket.get(socket.id);
    if (activePresence?.pageKey) {
      pagePresenceBySocket.delete(socket.id);
      emitPagePresence(activePresence.pageKey);
    }

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
    try {
      await GuardianLink.syncIndexes();
      console.log("GuardianLink indexes synced");
    } catch (err) {
      console.error("GuardianLink index sync failed:", err);
    }
    try {
      await User.syncIndexes();
      console.log("User indexes synced");
    } catch (err) {
      console.error("User index sync failed:", err);
    }
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
