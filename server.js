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
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const errors = require("passport-local-mongoose").errors;
const csrf = require("csurf");
const sanitize = require("mongo-sanitize");
const crypto = require("crypto");

main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.URI);
  //config
  const app = express();
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: process.env.MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.set("view engine", "html");
  app.set("views", "./views");
  app.use("/assets", express.static(path.join(__dirname, "assets")));
  app.use(limiter);
  app.use(helmet());
  let options = {
    name: "n015535",
    secret: process.env.SECRET,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: "strict",
  };
  const csrfProtection = csrf({ cookie: false });
  app.use(express.json());
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

  app.get("/search", csrfProtection, (req, res) => {
    return res.render("search", {
      username: getName(req.user),
      messages: {
        num: "Please type season and episode number.",
        name: "Please type episode name.",
      },
      searchData: {},
      csrfToken: req.csrfToken(),
    });
  });

  app.post("/search", csrfProtection, (req, res, next) => {
    // Switch actions of post request
    switch (req.body.action) {
      // If searching episode by number
      case "searchByNum":
        findByNumber(
          req.body.seasonByNum,
          req.body.episodeByNum,
          (err, episode) => {
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
              searchData["episodeIdByNum"] = episode.overallId;
              // If user logged in
              getSetting(req.user, "lang", (err2, lang) => {
                if (err2) {
                  return next(err2);
                }
                searchData["nameByNum"] = episode.names[lang];
                continueRender();
              });
            }
            function continueRender() {
              return res.render("search", {
                username: getName(req.user),
                messages: {
                  num: msg,
                  name: "Please type episode name.",
                },
                searchData: searchData,
                csrfToken: req.csrfToken(),
              });
            }
          }
        );
        break;
      case "detailsByNum": {
        let id = parseInt(req.body.episodeIdByNum) || 0;
        if (id) {
          return res.redirect(`/episode/?id=${id}`);
        }
        return res.render("search", {
          username: getName(req.user),
          messages: {
            num: "IdParseError",
            name: "Please type episode name.",
          },
          searchData: {},
          csrfToken: req.csrfToken(),
        });
      }
      case "searchByName":
        getSetting(req.user, "lang", (err, lang) => {
          if (err) return next(err);
          findByName(req.body.nameByName, lang, (err2, episodes) => {
            let msg = "Please select episode.";
            let searchData = { nameByName: req.body.nameByName, lang: lang };
            function continueRender() {
              return res.render("search", {
                username: getName(req.user),
                messages: {
                  num: "Please type season and episode number.",
                  name: msg,
                },
                searchData: searchData,
                csrfToken: req.csrfToken(),
              });
            }
            if (err2) {
              if (typeof err2 === "string") {
                msg = err2;
                return continueRender();
              }
              return next(err2);
            }
            searchData = {
              ...searchData,
              episodesByName: episodes,
            };
            return continueRender();
          });
        });

        break;
      case "detailsByName": {
        let id = parseInt(req.body.selectByName) || 0;
        if (id) {
          return res.redirect(`/episode/?id=${id}`);
        }
        return res.render("search", {
          username: getName(req.user),
          messages: {
            num: "Please type season and episode number.",
            name: "IdParseError",
          },
          searchData: {},
          csrfToken: req.csrfToken(),
        });
      }
      default:
        return res.render("search", {
          username: getName(req.user),
          messages: {
            num: "Please type season and episode number.",
            name: "Please type episode name.",
          },
          searchData: {
            seasonByNum: req.body.seasonByNum,
            episodeByNum: req.body.episodeByNum,
            nameByNum: req.body.nameByNum,
            nameByName: req.body.nameByName,
          },
          csrfToken: req.csrfToken(),
        });
    }
  });

  app.get("/episode", csrfProtection, (req, res, next) => {
    let id = parseInt(req.query.id) || 0; // Get episode id
    if (id) {
      // If exists
      findById(id, (err, episode) => {
        if (err) {
          return next(err);
        } else if (episode !== null) {
          getSetting(req.user, "lang", (err2, lang) => {
            if (err2) {
              return next(err2);
            }
            getWatched(req.user, id, (err3, result) => {
              if (err3) return next(err3);
              return res.render("episode", {
                username: getName(req.user),
                episodeData: episode,
                lang: lang,
                watched: result,
                idstring: `S${episode.seasonId.toLocaleString("en-US", {
                  minimumIntegerDigits: 2,
                  useGrouping: false,
                })}E${episode.inSeasonId.toLocaleString("en-US", {
                  minimumIntegerDigits: 2,
                  useGrouping: false,
                })}`,
                csrfToken: req.csrfToken(),
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

  app.post("/episode", csrfProtection, (req, res, next) => {
    let id = parseInt(req.body.episodeId) || 0;
    getWatched(req.user, id, (err, result) => {
      if (err) return next(err);
      let action = req.body.action;
      if (result !== null) {
        if (result && action === "markunwatched") {
          markEpisode(id, false, req.user, (err2) => {
            if (err2) return next(err2);
            return res.redirect(`/episode/?id=${id}`);
          });
        } else if (!result && action === "markwatched") {
          markEpisode(id, true, req.user, (err3) => {
            if (err3) return next(err3);
            return res.redirect(`/episode/?id=${id}`);
          });
        } else {
          return res.redirect(`/episode/?id=${id}`);
        }
      }
    });
  });

  app.get("/user", csrfProtection, (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }
    Setting.findById("lang", (err, languages) => {
      if (err) next(err);
      getUserData(req.user, (err2, userdata) => {
        if (err2) next(err2);
        let opts = {
          username: getName(req.user),
          userData: userdata,
          // userData: { lang: lang, watched: userdata.watched.length },
          message: "Personal settings and statistics",
          languages: languages.options,
          csrfToken: req.csrfToken(),
        };
        return res.render("user", opts);
      });
    });
  });

  app.post("/user", csrfProtection, (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.redirect("/login");
    }
    switch (req.body.action) {
      case "setlang":
        setSetting(req.user, "lang", req.body.language, (err) => {
          if (err) next(err);
        });
        break;
      case "setkey":
        generateKey(req.user, (err) => {
          if (err) return next(err);
        });
        break;
    }
    return res.redirect("/user");
  });

  app.get("/login", csrfProtection, (req, res) => {
    if (req.isAuthenticated()) {
      return res.redirect("/user");
    }
    return res.render("login", {
      username: getName(req.user),
      message: "Please log in",
      csrfToken: req.csrfToken(),
    });
  });

  app.get("/register", csrfProtection, (req, res) => {
    if (req.isAuthenticated()) {
      return res.redirect("/user");
    }
    return res.render("register", {
      username: getName(req.user),
      message: "Please register",
      csrfToken: req.csrfToken(),
    });
  });

  app.post("/register", csrfProtection, (req, res, next) => {
    if (req.isAuthenticated()) {
      return res.redirect("/user");
    }
    if (process.env.ENV === "PROD") {
      return res.render("register", {
        username: getName(req.user),
        message: "Registration is disabled",
        csrfToken: req.csrfToken(),
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
        User.findOne(
          { username: { $eq: sanitize(req.body.username) } },
          (err2, obj) => {
            if (err2) return next(err2);
            new UserData({
              _id: obj._id,
              settings: {},
              watched: [],
              apikey: "",
            }).save((err3) => {
              if (err2) return next(err3);
            });
          }
        );
        passport.authenticate("local")(req, res, () => res.redirect("/user"));
      }
    );
  });

  app.post("/login", csrfProtection, (req, res, next) => {
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
          csrfToken: req.csrfToken(),
        });
      }
      req.logIn(user, (err2) => {
        if (err2) {
          return next(err2);
        }
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/logout", (req, res) => {
    req.logout();
    return res.redirect("/login");
  });

  app.get("/api/episode/:id", (req, res) => {
    let id = parseInt(req.params.id) || 0; // Get episode id
    findById(id, (err, episode) => {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      } else if (episode !== null) {
        return res.json({ episode: episode });
      }
      return res.sendStatus(404);
    });
  });

  app.get("/api/id/:season/:episode", (req, res) => {
    findByNumber(req.params.season, req.params.episode, (err, episode) => {
      if (err) {
        if (typeof err === "string") {
          return res.sendStatus(404);
        }
        console.log(err);
        return res.sendStatus(500);
      }
      res.json({ id: episode.overallId });
    });
  });

  app.get("/api/search/:lang/:name", (req, res) => {
    findByName(req.params.name, req.params.lang, (err, episodes) => {
      if (err) {
        if (typeof err === "string") {
          return res.sendStatus(404);
        }
        console.log(err);
        return res.sendStatus(500);
      }
      let newEp = [];
      episodes.forEach((episode) => {
        newEp.push({ names: episode.names, overallId: episode.overallId });
      });
      res.json({ episodes: newEp });
    });
  });

  app.get("/api/watched/:id", (req, res) => {
    let key = req.query.api_key;
    if (typeof key === "undefined" || key === "") return res.sendStatus(401);
    let id = parseInt(req.params.id) || 0;
    findById(id, (err2, episode) => {
      if (err2) return res.sendStatus(500);
      if (episode === null) return res.sendStatus(404);
    });
    UserData.findOne({ apikey: { $eq: key } }, (err, userdata) => {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }
      if (userdata === null || userdata.apikey === "") {
        return res.sendStatus(401);
      }
      let watched = userdata.watched.includes(parseInt(req.params.id));
      return res.json({ watched: watched });
    });    
  });

  app.post("/api/watched/:id", (req, res) => {
    let key = req.query.api_key;
    if (typeof key === "undefined" || key === "") return res.sendStatus(401);
    let id = parseInt(req.params.id) || 0;
    findById(id, (err4, episode) => {
      if (err4) return res.sendStatus(500);
      if (episode === null) return res.sendStatus(404);
      let requested = req.body.watched;
      if (typeof requested !== "boolean") return res.sendStatus(400);

      UserData.findOne({ apikey: { $eq: key } }, (err, userdata) => {
        if (err) {
          console.log(err);
          return res.sendStatus(500);
        }
        if (userdata === null) {
          return res.sendStatus(401);
        }
        User.findById(userdata._id, (err2, user) => {
          if (err2) {
            console.log(err2);
            return res.sendStatus(500);
          }
          markEpisode(id, requested, user, (err3) => {
            if (err3) {
              console.log(err3);
              return res.sendStatus(500);
            }
          });
        });
      });
      return res.json({watched: requested});
    });
  });

  app.listen(process.env.PORT, (err) => {
    if (err) return console.log("Error in server setup");
    console.log(
      `The Simpsons Database now running on http://localhost:${process.env.PORT}`
    );
  });
}

function getSetting(user, settingName, callback) {
  getUserData(user, (err, userdata) => {
    if (err) return callback(err);
    if (userdata !== null) {
      let settingObj = userdata.settings[settingName]; // Get setting value

      if (typeof settingObj !== "undefined") {
        // Check if setting value exists
        return callback(null, settingObj, userdata); // Sucess: Return requires setting value
      }
      // Setting value missing
      return callback(new Error("Setting is missing!"), null); // Return error
    }
    Setting.findById(settingName, (err2, setting) => {
      if (err2) {
        return callback(err2);
      } else if (setting === null) {
        return callback(new Error("Setting configuration missing!"), null);
      }
      let obj = setting.options[setting.default];
      if (typeof obj !== "undefined") {
        return callback(null, obj.value);
      }
      return callback(new Error("Setting is undefined"), null);
    });
  });
}

function getUserData(user, callback) {
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
      return callback(null, userdata);
    });
  } else {
    return callback(null, null);
  }
}

function getWatched(user, episodeId, callback) {
  getUserData(user, (err, userdata) => {
    if (err) return callback(err);
    if (userdata === null) {
      return callback(null, null);
    }
    return callback(null, userdata.watched.includes(episodeId), userdata);
  });
}

function setSetting(user, settingName, settingValue, callback) {
  getSetting(user, settingName, (err, current) => {
    if (err) return callback(err);
    if (current === settingValue) {
      return callback(null);
    }
    UserData.updateOne(
      { _id: user._id },
      { settings: { [sanitize(settingName)]: settingValue } },
      (err2) => {
        if (err2) return callback(err2);
      }
    );
  });
}

function markEpisode(episodeId, markas, user, callback) {
  getWatched(user, episodeId, (err, isWatched, userdata) => {
    if (err) return callback(err);
    if (markas !== isWatched) {
      if (markas) {
        UserData.updateOne(
          { _id: userdata._id },
          { $push: { watched: episodeId } },
          (err2) => {
            return callback(err2);
          }
        );
      } else {
        UserData.updateOne(
          { _id: userdata._id },
          { $pullAll: { watched: [episodeId] } },
          (err2) => {
            return callback(err2);
          }
        );
      }
    }
  });
}

function getName(user) {
  return (user || {}).username || "";
}

function findByNumber(seasonN, episodeN, callback) {
  Season.findById(parseInt(seasonN) || 0, (err, season) => {
    // Find season
    if (err) {
      return callback(err); // Return error
    } else if (season === null) {
      // If season not found
      return callback("Season not found!", null); // Return error
    }
    // If season found
    let episode = season.episodes[(parseInt(episodeN) || 0) - 1]; // Get episode obejct
    if (typeof episode === "undefined") {
      // If episode obejct is undefined
      return callback("Episode not found!", null); // Return error
    }
    return callback(null, episode); // Success: Return episode object
  });
}

function findById(episodeId, callback) {
  Season.findOne(
    { episodes: { $elemMatch: { overallId: { $eq: sanitize(episodeId) } } } },
    (err, season) => {
      // Find season
      if (err) {
        return callback(err); // Return error
      }
      if (season !== null) {
        let episode = season.episodes.find(
          (cEpisode) => cEpisode.overallId === episodeId
        ); // Find episode
        // episode["noSeason"] = season.episodes.indexOf(episode);
        return callback(null, episode, season); // Return episode object
      }
      return callback(null, null); // Return null
    }
  );
}

function findByName(episodeName, lang, callback) {
  if (typeof episodeName === "string") {
    Season.find(
      {
        episodes: {
          $elemMatch: {
            [`names.${lang}`]: { $regex: episodeName, $options: "i" },
          },
        },
      },
      (err, seasons) => {
        // Find season
        if (err) {
          return callback(err); // Return error
        }
        if (seasons.length) {
          let episodes = [];
          seasons.forEach((season) => {
            season.episodes.forEach((episode) => {
              if (
                episode.names[lang]
                  .toLowerCase()
                  .includes(episodeName.toLowerCase())
              ) {
                episodes.push(episode);
              }
            });
          });
          return callback(null, episodes);
        }
        return callback("No episodes found!", null); // Return empty array
      }
    );
  } else {
    return callback(new Error("Name is not a string!"));
  }
}

function getKey(callback) {
  crypto.randomBytes(16, function (err, buffer) {
    if (err) return callback(err);
    return callback(null, buffer.toString("hex"));
  });
}

function loopNew(callback) {
  getKey((err, key) => {
    if (err) return callback(err);
    UserData.findOne({ apikey: key }, (err2, userSame) => {
      if (err2) return callback(err2);
      if (userSame === null) {
        return callback(null, key);
      }
      loopNew((err3, key2) => {
        if (err3) return callback(err3);
        return callback(null, key2);
      });
    });
  });
}

function generateKey(user, callback) {
  if (typeof user !== "undefined") {
    loopNew((err, key) => {
      if (err) return callback(err);
      UserData.updateOne({ _id: user._id }, { apikey: key }, (err2) => {
        if (err2) return callback(err2);
        return callback(null);
      });
    });
  } else {
    return callback(new Error("User is not defined"));
  }
}
