require("dotenv").config();
const config = require("./config.json");
const express = require("express");
const passport = require("passport");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const User = require("./models/user");
const UserData = require("./models/userdata");
const Season = require("./models/season");
const Setting = require("./models/setting");
const flash = require("connect-flash");
const RateLimit = require("express-rate-limit");
const helmet = require("helmet");

function getSetting(user, settingName, callback) {
  if (typeof user !== "undefined") {
    // If user logged in
    UserData.findById(user._id, function (err, userdata) {
      // Find UserData of User
      if (err) {
        callback(err, null); // Return error
      } else if (userdata == null) {
        // If UserData not found
        callback(new Error("UserData missing!"), null); // Return error
      } else {
        // UserData found
        let settingValue = userdata.settings[settingName]; // Get setting value
        if (typeof settingValue !== "undefined") {
          // Check if setting value exists
          callback(null, settingValue); // Sucess: Return requires setting value
        } else {
          // Setting value missing
          callback(new Error("Setting is missing!"), null); // Return error
        }
      }
    });
  } else {
    // Logged out
    Setting.findById(settingName, function (err, setting) {
      if (err) {
        callback(err, null);
      } else if (setting == null) {
        callback(new Error("Setting configuration missing!"), null);
      } else {
        let val = setting.options[setting.default];
        if (typeof val != "undefined") {
          callback(null, val);
        } else {
          callback(new Error("Setting is undefined"), null);
        }
      }
    });
  }
}

function getName(user) {
  return (user || {}).username || "";
}

function findByNumber(req, callback) {
  Season.findById(parseInt(req.body.seasonByNum) || 0, function (err, season) {
    // Find season
    if (err) {
      callback(err, null); // Return error
    } else if (season == null) {
      // If season not found
      callback("Season not found!", null); // Return error
    } else {
      // If season found
      let episode = season.episodes[req.body.episodeByNum - 1]; // Get episode obejct
      if (typeof episode == "undefined") {
        // If episode obejct is undefined
        callback("Episode not found!", null); // Return error
      } else {
        callback(null, episode); // Success: Return episode object
      }
    }
  });
}

function findById(id, callback) {
  Season.findOne(
    { episodes: { $elemMatch: { noOverall: id } } },
    function (err, season) {
      // Find season
      if (err) {
        callback(err, null); // Return error
      } else {
        if (season != null) {
          let episode = season.episodes.find(
            (cEpisode) => cEpisode.noOverall == id
          ); // Find episode
          callback(null, episode); // Return episode object
        } else {
          callback(null, null); // Return null
        }
      }
    }
  );
}

mongoose
  .connect(
    `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@simpsons-list.lkdxr.mongodb.net/data?retryWrites=true&w=majority`
  )
  .then(() => {
    //config
    const app = express();
    const limiter = new RateLimit({
      windowMs: 1 * 60 * 1000,
      max: 15,
    });
    app.set("view engine", "html");
    app.set("views", "./views");
    app.use("/assets", express.static(path.join(__dirname, "assets")));
    app.use(limiter);
    app.use(helmet());
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

    app.get("/", (req, res) => {
      res.render("index", {
        username: getName(req.user),
      });
    });

    app.get("/search", (req, res) => {
      res.render("search", {
        username: getName(req.user),
        messages: {
          num: "Please type season and episode number.",
          name: "Please type episode name and select one.",
        },
        searchData: {},
      });
    });

    app.post("/search", (req, res, next) => {
      switch (
        req.body.action // Switch actions of post request
      ) {
        case "searchByNum": // If searching episode by number
          findByNumber(req, function (err, episode) {
            // Find episode
            let msg = "Episode found!";
            let searchData = {
              seasonByNum: req.body.seasonByNum,
              episodeByNum: req.body.episodeByNum,
            };
            if (err) {
              if (typeof err == "string") {
                msg = err;
                continueRender();
              } else {
                next(err);
              }
            } else {
              // Episode found
              searchData["episodeId"] = episode.noOverall;
              if (typeof req.user !== "undefined") {
                // If user logged in
                getSetting(req.user, "lang", function (err, lang) {
                  if (err) {
                    next(err);
                  } else {
                    searchData["nameByNum"] = episode.names[lang];
                    continueRender();
                  }
                });
              } else {
                searchData["nameByNum"] = episode.names["en"];
                continueRender();
              }
            }
            function continueRender() {
              res.render("search", {
                username: getName(req.user),
                messages: {
                  num: msg,
                  name: "Please type episode name and select one.",
                },
                searchData: searchData,
              });
            }
          });
          break;
        case "details":
          var id = parseInt(req.body.episodeId) || 0;
          if (id) {
            res.redirect(`/episode?id=${id}`);
          } else {
            res.render("search", {
              username: getName(req.user),
              messages: {
                num: "IdParseError",
                name: "Please type episode name and select one.",
              },
              searchData: {},
            });
          }
          break;
        default:
          res.render("search", {
            username: getName(req.user),
            messages: {
              num: "Please type season and episode number.",
              name: "Please type episode name and select one.",
            },
            searchData: {
              seasonByNum: req.body.seasonByNum,
              episodeByNum: req.body.episodeByNum,
              nameByNum: req.body.nameByNum,
              /*
              seasonByName: req.body.seasonByName,
              episodeByName: req.body.episodeByName,
              nameByName: req.body.nameByName,
              */
            },
          });
          break;
      }
    });

    app.get("/episode", (req, res, next) => {
      let id = parseInt(req.query.id) || 0; // Get episode id
      if (id) {
        // If exists
        findById(id, function (err, episode) {
          if (err) {
            next(err);
          } else if (episode != null) {
            getSetting(req.user, "lang", function (err, lang) {
              if (err) {
                next(err);
              } else {
                res.render("episode", {
                  username: getName(req.user),
                  episodeData: episode,
                  lang: lang,
                });
              }
            });
          } else {
            res.redirect("/search");
          }
        });
      } else {
        // If there is no id
        res.redirect("/search");
      }
    });

    app.get("/user", (req, res) => {
      if (!req.isAuthenticated()) {
        return res.redirect("/login");
      }
      res.render("user", {
        username: getName(req.user),
      });
    });

    app.get("/login", (req, res) => {
      if (req.isAuthenticated()) {
        return res.redirect("/user");
      }
      res.render("login", {
        username: getName(req.user),
        message: "Please log in",
      });
    });

    app.get("/register", (req, res) => {
      if (req.isAuthenticated()) {
        return res.redirect("/user");
      }
      res.render("register", {
        username: getName(req.user),
        message: "Please register",
      });
    });

    app.post("/register", function (req, res) {
      if (req.isAuthenticated()) {
        return res.redirect("/user");
      }
      User.register(
        new User({
          username: req.body.username,
        }),
        req.body.password,
        function (err) {
          if (err) {
            if (err.name == "UserExistsError") {
              req.flash("message", "This username is taken!");
            } else {
              req.flash("message", `Unexpected message: ${err.name}`);
            }

            res.render("register", {
              username: getName(req.user),
              message: req.flash("message"),
            });
          }
          // Resgistration sucessfull
          User.findOne(
            { username: { $eq: req.body.username } },
            function (err, obj) {
              if (err) req.flash("message", err);
              new UserData({
                _id: obj._id,
                settings: {},
                watched: [],
              }).save(function (err) {
                if (err) req.flash("message", err);
              });
            }
          );
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
      passport.authenticate("local", function (err, user) {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.render("login", {
            username: getName(req.user),
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
        `The Simpsons Database now running on http://localhost:${config.port}`
      );
    });
  });
