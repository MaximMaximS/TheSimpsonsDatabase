const mongoose = require("mongoose");
const Schema = mongoose.Schema;

var SettingSchema = new Schema({
  _id: String,
  options: Array,
  default: Number,
});

module.exports = mongoose.model("Setting", SettingSchema, "settings");
