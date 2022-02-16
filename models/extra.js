const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let ExtraSchema = new Schema({
  _id: Number,
  descriptions: Object,
});

module.exports = mongoose.model("Extra", ExtraSchema, "extras");
