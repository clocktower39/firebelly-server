const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').Server(app);
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { ValidationError } = require('express-validation');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const exerciseRoutes = require('./routes/exerciseRoutes');
const trainingRoutes = require('./routes/trainingRoutes');
const nutritionRoutes = require('./routes/nutritionRoutes');
const taskRoutes = require('./routes/taskRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const goalRoutes = require('./routes/goalRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const methodOverride = require('method-override');
global.io = require('./io').initialize(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});
const dayjs = require('dayjs');
const advancedFormat = require("dayjs/plugin/advancedFormat");
const utc = require("dayjs/plugin/utc");

dayjs.extend(utc);
dayjs.extend(advancedFormat);

// require('dotenv').config();
const dbUrl = process.env.DBURL;
let PORT = process.env.PORT;
if( PORT == null || PORT == ""){
    PORT = 8000;
}
const SALT_WORK_FACTOR = Number(process.env.SALT_WORK_FACTOR);
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

app.use(cors());
app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(methodOverride('_method'));

app.use('/', userRoutes);
app.use('/', exerciseRoutes);
app.use('/', trainingRoutes);
app.use('/', nutritionRoutes);
app.use('/', taskRoutes);
app.use('/', relationshipRoutes);
app.use('/', goalRoutes);
app.use('/', conversationRoutes);

const connectedClients = {};

global.io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;

    // Save the user's socket ID
    connectedClients[userId] = socket.id;
    
    // Notify all trainers about the client's online status
    global.io.emit('clientStatusChanged', { userId, status: 'online' });

    console.log(`${userId} connected with IP: ${socket.conn.remoteAddress}`);

    // Listen for the 'requestClientStatuses' event and send the current status
    socket.on('requestClientStatuses', () => {
        const clientStatuses = Object.keys(connectedClients).reduce((statuses, id) => {
            statuses[id] = 'online';
            return statuses;
        }, {});
        socket.emit('currentClientStatuses', clientStatuses);
    });

    socket.on('disconnect', () => {
        // Remove the client from the connectedClients object
        delete connectedClients[userId];
        
        // Notify all trainers about the client's offline status
        global.io.emit('clientStatusChanged', { userId, status: 'offline' });

        console.log(`${userId} disconnected`);
    });
});



mongoose.connect(dbUrl, 
    {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false
    } , (err) => {
    console.log('mongo db connection', err)
})

// Error handling Function
app.use((err, req, res, next) => {
    if (err instanceof ValidationError) {
      return res.status(err.statusCode).json(err)
    }
    console.error(err.stack);
    res.status(500).send(err.stack);
})

let server = http.listen(PORT, ()=> {
    console.log(`Server is listening on port ${PORT}`);
});

