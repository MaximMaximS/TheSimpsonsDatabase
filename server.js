/* eslint-disable no-inline-comments */
require("dotenv").config();
const express = require("express");
const passport = require("passport");
const path = require("path");
const mongoose = require("mongoose");
const session = require("cookie-session");
const User = require("./models/user");
const UserData = require("./models/userdata");
const Season = require("./models/season");
const Setting = require("./models/setting");
const RateLimit = require("express-rate-limit");
const helmet = require("helmet");
const errors = require("passport-local-mongoose").errors;

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
    let options = {
      name: "session",
      secret: process.env.SECRET,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "strict",
    };
    /*
    if (process.env.ENV === "PROD") {
      options["secure"] = true;
    }
    */
    app.use(session(options));
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
      return res.render("index", {
        username: getName(req.user),
      });
    });

    app.get("/search", (req, res) => {
      return res.render("search", {
        username: getName(req.user),
        messages: {
          num: "Please type season and episode number.",
          name: "Please type episode name and select one.",
        },
        searchData: {},
      });
    });

    app.post("/search", (req, res, next) => {
      // Switch actions of post request
      switch (req.body.action) {
        case "searchByNum": // If searching episode by number
          findByNumber(req, (err, episode) => {
            // Find episode
            let msg = "Episode found!";
            let searchData = {
              seasonByNum: req.body.seasonByNum,
              episodeByNum: req.body.episodeByNum,
            };
            if (err) {
              if (typeof err === "string") {
                msg = err;
                continueRender();
              } else {
                return next(err);
              }
            } else {
              // Episode found
              searchData["episodeId"] = episode.noOverall;
              if (typeof req.user !== "undefined") {
                // If user logged in
                getSetting(req.user, "lang", (err, lang) => {
                  if (err) {
                    return next(err);
                  }
                  searchData["nameByNum"] = episode.names[lang];
                  continueRender();
                });
              } else {
                searchData["nameByNum"] = episode.names["en"];
                continueRender();
              }
            }
            function continueRender() {
              return res.render("search", {
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
        case "details": {
          let id = parseInt(req.body.episodeId) || 0;
          if (id) {
            return res.redirect(`/episode?id=${id}`);
          }
          return res.render("search", {
            username: getName(req.user),
            messages: {
              num: "IdParseError",
              name: "Please type episode name and select one.",
            },
            searchData: {},
          });
        }
        default:
          return res.render("search", {
            username: getName(req.user),
            messages: {
              num: "Please type season and episode number.",
              name: "Please type episode name and select one.",
            },
            searchData: {
              seasonByNum: req.body.seasonByNum,
              episodeByNum: req.body.episodeByNum,
              nameByNum: req.body.nameByNum,
            },
          });
      }
    });

    app.get("/episode", (req, res, next) => {
      let id = parseInt(req.query.id) || 0; // Get episode id
      if (id) {
        // If exists
        findById(id, (err, episode) => {
          if (err) {
            return next(err);
          } else if (episode !== null) {
            getSetting(req.user, "lang", (err, lang) => {
              if (err) {
                return next(err);
              }
              getData(req.user, id, (err, _, result) => {
                if (err) return next(err);
                return res.render("episode", {
                  username: getName(req.user),
                  episodeData: episode,
                  lang: lang,
                  watched: result,
                });
              });
            });
          } else {
            return res.redirect("/search");
          }
        });
      } else {
        // If there is no id
        return res.redirect("/search");
      }
    });

    app.post("/episode", (req, res, next) => {
      let id = parseInt(req.body.episodeId) || 0;
      getData(req.user, id, (err, _, result) => {
        if (err) return next(err);
        let action = req.body.action;
        if (result !== null) {
          if (result && action === "markunwatched") {
            markEpisode(id, false, req.user, (err) => {
              if (err) return next(err);
              return res.redirect(`/episode?id=${id}`);
            });
          } else if (!result && action === "markwatched") {
            markEpisode(id, true, req.user, (err) => {
              if (err) return next(err);
              return res.redirect(`/episode?id=${id}`);
            });
          } else {
            return res.redirect(`/episode?id=${id}`);
          }
        }
      });
    });

    app.get("/user", (req, res) => {
      if (!req.isAuthenticated()) {
        return res.redirect("/login");
      }
      return res.render("user", {
        username: getName(req.user),
      });
    });

    app.get("/login", (req, res) => {
      if (req.isAuthenticated()) {
        return res.redirect("/user");
      }
      return res.render("login", {
        username: getName(req.user),
        message: "Please log in",
      });
    });

    app.get("/register", (req, res) => {
      if (req.isAuthenticated()) {
        return res.redirect("/user");
      }
      return res.render("register", {
        username: getName(req.user),
        message: "Please register",
      });
    });

    app.post("/register", (req, res, next) => {
      if (req.isAuthenticated()) {
        return res.redirect("/user");
      }
      if (process.env.ENV === "PROD") {
        return res.render("register", {
          username: getName(req.user),
          message: "Registration is disabled",
        });
      }
      User.register(
        new User({
          username: req.body.username,
        }),
        req.body.password,
        (err) => {
          if (err) {
            let msg;
            if (err instanceof errors.AuthenticationError) {
              msg = err.message;
            } else {
              next(err);
            }

            return res.render("register", {
              username: getName(req.user),
              message: msg,
            });
          }
          // Resgistration sucessfull
          User.findOne({ username: { $eq: req.body.username } }, (err, obj) => {
            if (err) return next(err);
            new UserData({
              _id: obj._id,
              settings: {},
              watched: [],
            }).save((err) => {
              if (err) return next(err);
            });
          });
          passport.authenticate("local")(req, res, () => res.redirect("/user"));
        }
      );
    });

    app.post("/login", (req, res, next) => {
      if (req.isAuthenticated()) {
        return res.redirect("/user");
      }
      passport.authenticate("local", (err, user) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.render("login", {
            username: getName(req.user),
            message: "Invalid login!",
          });
        }
        req.logIn(user, (err) => {
          if (err) {
            return next(err);
          }
          return res.redirect("/");
        });
      })(req, res, next);
    });

    app.get("/logout", (req, res) => {
      req.logout();
      return res.redirect("/login");
    });
    app.listen(process.env.PORT, (err) => {
      if (err) return console.log("Error in server setup");
      console.log(
        `The Simpsons Database now running on http://localhost:${process.env.PORT}`
      );
    });
  })
  .catch((err) => {
    console.log(err);
  });

function getSetting(user, settingName, callback) {
  if (typeof user !== "undefined") {
    // If user logged in
    UserData.findById(user._id, (err, userdata) => {
      // Find UserData of User
      if (err) {
        return callback(err); // Return error
      } else if (userdata === null) {
        // If UserData not found
        return callback(new Error("UserData missing!"), null); // Return error
      }
      // UserData found
      let settingValue = userdata.settings[settingName]; // Get setting value
      if (typeof settingValue !== "undefined") {
        // Check if setting value exists
        return callback(null, settingValue); // Sucess: Return requires setting value
      }
      // Setting value missing
      return callback(new Error("Setting is missing!"), null); // Return error
    });
  } else {
    // Logged out
    Setting.findById(settingName, (err, setting) => {
      if (err) {
        return callback(err);
      } else if (setting === null) {
        return callback(new Error("Setting configuration missing!"), null);
      }
      let val = setting.options[setting.default];
      if (typeof val !== "undefined") {
        return callback(null, val);
      }
      return callback(new Error("Setting is undefined"), null);
    });
  }
}

function getData(user, episodeId, callback) {
  if (typeof user !== "undefined") {
    // If user logged in
    UserData.findById(user._id, (err, userdata) => {
      // Find UserData of User
      if (err) {
        return callback(err); // Return error
      } else if (userdata === null) {
        // If UserData not found
        return callback(new Error("UserData missing!"), null); // Return error
      }
      // UserData found
      let watched = userdata.watched.includes(episodeId); // Get setting value
      return callback(null, userdata, watched);
    });
  } else {
    return callback(null, null);
  }
}

function markEpisode(episodeId, markas, user, callback) {
  getData(user, episodeId, (err, userdata, isWatched) => {
    if (err) return callback(err);
    if (markas !== isWatched) {
      if (markas) {
        UserData.updateOne(
          { _id: userdata._id },
          { $push: { watched: episodeId } },
          (err) => {
            return callback(err);
          }
        );
      } else {
        UserData.updateOne(
          { _id: userdata._id },
          { $pullAll: { watched: [episodeId] } },
          (err) => {
            return callback(err);
          }
        );
      }
    }
  });
}

function getName(user) {
  return (user || {}).username || "";
}

function findByNumber(req, callback) {
  Season.findById(parseInt(req.body.seasonByNum) || 0, (err, season) => {
    // Find season
    if (err) {
      return callback(err); // Return error
    } else if (season === null) {
      // If season not found
      return callback("Season not found!", null); // Return error
    }
    // If season found
    let episode = season.episodes[req.body.episodeByNum - 1]; // Get episode obejct
    if (typeof episode === "undefined") {
      // If episode obejct is undefined
      return callback("Episode not found!", null); // Return error
    }
    return callback(null, episode); // Success: Return episode object
  });
}

function findById(episodeId, callback) {
  Season.findOne(
    { episodes: { $elemMatch: { noOverall: episodeId } } },
    (err, season) => {
      // Find season
      if (err) {
        return callback(err); // Return error
      }
      if (season !== null) {
        let episode = season.episodes.find(
          (cEpisode) => cEpisode.noOverall === episodeId
        ); // Find episode
        return callback(null, episode); // Return episode object
      }
      return callback(null, null); // Return null
    }
  );
}
