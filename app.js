const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').Server(app);
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const exerciseRoutes = require('./routes/exerciseRoutes');
const trainingRoutes = require('./routes/trainingRoutes');
const nutritionRoutes = require('./routes/nutritionRoutes');
const taskRoutes = require('./routes/taskRoutes');
const noteRoutes = require('./routes/noteRoutes');

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
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json());

app.use('/', userRoutes);
app.use('/', exerciseRoutes);
app.use('/', trainingRoutes);
app.use('/', nutritionRoutes);
app.use('/', taskRoutes);
app.use('/', noteRoutes);

mongoose.connect(dbUrl, 
    {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false
    } , (err) => {
    console.log('mongo db connection', err)
})

let server = http.listen(PORT, ()=> {
    console.log(`Server is listening on port ${PORT}`);
});

