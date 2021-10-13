require("dotenv").config();
const config = require("./config.json");
const express = require("express");
const passport = require("passport");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const User = require("./models/user");
const flash = require("connect-flash");

function getName(req) {
  var username = "";
  try {
    username = req.user.username;
  } catch (err) {
    username = "";
  }
  return username;
}

mongoose
  .connect(
    `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@simpsons-list.lkdxr.mongodb.net/data?retryWrites=true&w=majority`
  )
  .then(() => {
    //config
    const app = express();

    app.set("view engine", "html");
    app.set("views", "./views");
    app.use("/assets", express.static(path.join(__dirname, "assets")));
    app.use(
      session({
        secret: process.env.SECRET,
        resave: true,
        saveUninitialized: true,
      })
    );
    app.use(flash());
    app.use(passport.initialize());
    app.use(passport.session());
    passport.use(User.createStrategy());
    passport.serializeUser(User.serializeUser());
    passport.deserializeUser(User.deserializeUser());

    app.engine(".html", require("ejs").__express);

    app.use(
      express.urlencoded({
        extended: true,
      })
    );

    // var User = mongoose.model("Users", UserSchema);
    /*
                UserSchema.register({ username: "pepa" }, "haxor", function(err, user) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log("hpos");
                    }
                });
                
            UserSchema.authenticate("pepa", "hax5or", function(err, result) {
                if (err) console.log(err);
                console.log("pepe");
            });
            */

    app.get("/", (req, res) => {
      res.render("index", {
        username: getName(req),
      });
    });

    app.get("/search", (req, res) => {
      res.render("search", {
        username: getName(req),
        season: 1,
        episode: 1,
        nameCzech: "",
        seenBy: "",
        seeners: [],
      });
    });

    app.get("/user", (req, res) => {
      if (!req.isAuthenticated()) {
        return res.redirect("/login");
      }
      res.render("user", {
        username: getName(req),
      });
    });

    app.get("/login", (req, res) => {
      if (req.isAuthenticated()) {
        return res.redirect("/user");
      }
      res.render("login", {
        username: getName(req),
        message: "Please log in",
      });
    });

    app.get("/register", (req, res) => {
      if (req.isAuthenticated()) {
        return res.redirect("/user");
      }
      res.render("register", {
        username: getName(req),
        message: "Please register",
      });
    });

    app.post("/register", function (req, res, next) {
      if (req.isAuthenticated()) {
        return res.redirect("/user");
      }
      User.register(
        new User({
          username: req.body.username,
        }),
        req.body.password,
        function (err, user) {
          if (err) {
            if (err.name == "UserExistsError") {
              req.flash("message", "This username is taken!");
            } else {
              req.flash("message", `Unexpected message: ${err.name}`);
            }

            res.render("register", {
              username: getName(req),
              message: req.flash("message"),
            });
            return;
          }

          passport.authenticate("local")(req, res, function () {
            res.redirect("/user");
          });
        }
      );
    });

    app.post("/login", function (req, res, next) {
      if (req.isAuthenticated()) {
        return res.redirect("/user");
      }
      passport.authenticate("local", function (err, user, info) {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.render("login", {
            username: getName(req),
            message: "Invalid login!",
          });
        }
        req.logIn(user, function (err) {
          if (err) {
            return next(err);
          }
          return res.redirect("/");
        });
      })(req, res, next);
    });

    app.get("/logout", function (req, res) {
      req.logout();
      res.redirect("/login");
    });
    app.listen(config.port, function (err) {
      if (err) console.log("Error in server setup");
      console.log(
        `The Simpsons Database now running on localhost:${config.port}`
      );
    });
  });
