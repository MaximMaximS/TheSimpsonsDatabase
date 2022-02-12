const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let UserDataSchema = new Schema({
  _id: { type: mongoose.ObjectId },
  settings: {
    lang: {
      type: String,
      default: "en",
    },
  },
  watched: { type: Array },
  apikey: { type: String },
});

module.exports = mongoose.model("UserData", UserDataSchema, "userdata");
