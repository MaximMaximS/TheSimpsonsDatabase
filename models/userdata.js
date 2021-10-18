const mongoose = require("mongoose");
const Schema = mongoose.Schema;

var UserDataSchema = new Schema({
  _id: mongoose.ObjectId,
  settings: Array,
  watched: Array,
});

module.exports = mongoose.model("UserData", UserDataSchema, "userdata");
