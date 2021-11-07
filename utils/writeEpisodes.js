/*
Script to write list of episodes to the database
*/

require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const eList = require("./data/list.json");
const Season = require("../models/season");

mongoose.connect(
  `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@simpsons-list.lkdxr.mongodb.net/data?retryWrites=true&w=majority`
);
var db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));

db.once("open", () => {
  console.log("Connection Successful!");

  Season.insertMany(eList.seasons, onInsert);

  function onInsert(err, docs) {
    if (err) {
      console.log(err);
      process.exit(1);
    } else {
      console.info("%d stored.", docs.length);
      process.exit(0);
    }
  }
});
