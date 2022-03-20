const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let EpisodeSchema = new Schema({
  _id: Number,
  seasonId: Number,
  inSeasonId: Number,
  names: {
    cs: String,
    en: String,
  },
  direction: String,
  screenplay: String,
  premieres: {
    cs: String,
    en: String,
  },
});

module.exports = mongoose.model("Episode", EpisodeSchema, "episodes");
