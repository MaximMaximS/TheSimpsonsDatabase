/*
Script to write list of episodes to the database
*/

require("dotenv").config();
const mongoose = require("mongoose");
const eList = require('./data/list.json');

mongoose.connect(`mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@simpsons-list.lkdxr.mongodb.net/data?retryWrites=true&w=majority`);
var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function() {
    console.log("Connection Successful!");

    var SeasonSchema = mongoose.Schema({
        _id: Number,
        episodes: Array
    });
    var Season = mongoose.model('Season', SeasonSchema, 'episodes');
    Season.collection.insertMany(eList.seasons, onInsert);

    function onInsert(err, docs) {
        if (err) {
            console.log(err);
        } else {
            console.info('%d stored.', docs.length);
        }
    }
});