const mongoose = require("mongoose");
const Schema = mongoose.Schema;

var SeasonSchema = new Schema({
  _id: Number,
  episodes: Array,
});

module.exports = mongoose.model("Season", SeasonSchema, "seasons");
