require('dotenv').config();

const mongodb_host = process.env.REMOTE_MONGODB_HOST;
const mongodb_user = process.env.REMOTE_MONGODB_USER;
const mongodb_password = process.env.REMOTE_MONGODB_PASSWORD;

const MongoClient = require("mongodb").MongoClient;

var database = new MongoClient(`mongodb+srv://${mongodb_host}`, 
    {auth: 
        {username: mongodb_user, 
         password: mongodb_password}
    });
module.exports = database;