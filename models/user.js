const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

var UserSchema = new Schema();

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);
