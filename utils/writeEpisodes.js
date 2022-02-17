/*
Script to write list of episodes to the database
*/

require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const eList = require("./data/list.json");
const Season = require("../models/season");
const Extra = require("../models/extra");

main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.URI);
  console.log("Connection Successful!");

  Season.deleteMany({}, (err) => {
    if (err) throw err;
    Season.insertMany(eList.seasons, (err2, seasons) => {
      if (err2) {
        throw err2;
      }
      console.info("%d seasons stored.", seasons.length);
      Extra.deleteMany({}, (err3) => {
        if (err3) throw err3;
        Extra.insertMany(eList.extras, (err4, extras) => {
          if (err4) {
            throw err4;
          }
          console.info("%d extras stored.", extras.length);

          process.exit(0);
        });
      });
    });
  });
}
