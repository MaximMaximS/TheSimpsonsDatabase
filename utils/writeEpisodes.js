/*
Script to write list of episodes to the database
*/

require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const eList = require("./data/list.json");
const Episode = require("../models/episode");
const Extra = require("../models/extra");

main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.URI);
  console.log("Connection Successful!");

  Episode.deleteMany({}, (err) => {
    if (err) throw err;
    Episode.insertMany(eList.episodes, (err2, episodes) => {
      if (err2) {
        throw err2;
      }
      console.info("%d episodes stored.", episodes.length);
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
