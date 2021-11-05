const mongoose = require("mongoose");
const Schema = mongoose.Schema;

var SettingSchema = new Schema({
  _id: String,
  options: Array,
  default: Schema.Types.Mixed,
});

module.exports = mongoose.model("Setting", SettingSchema, "settings");
