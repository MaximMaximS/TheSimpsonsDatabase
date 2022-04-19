require("dotenv").config({ path: "../.env" });
const fs = require("fs"); // File system
const cheerio = require("cheerio").default; // Html parser

async function fetchSite(url, alias) {
  if (process.env.FETCH !== "true") {
    try {
      return fs.readFileSync(`./data/pages/${alias}.html`);
    } catch (err) {
      console.log(`File ${alias} not found, fetching...`);
    }
  }
  const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    console.log(err);
    process.exit();
  }
  const result = await response.text();
  fs.writeFileSync(`./data/pages/${alias}.html`, result, (err) => {
    if (err) throw err;
  });
  return result;
}

const csNames = [
  "ledna",
  "února",
  "března",
  "dubna",
  "května",
  "června",
  "července",
  "srpna",
  "září",
  "října",
  "listopadu",
  "prosince",
];
const enNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function convDate(date) {
  // 23. září 1994
  csNames.forEach((name, index) => {
    date = date.replace(`. ${name} `, `-${enNames[index]}-`);
  });
  return date;
}

async function runProcess() {
  const root = await fetchSite(
    "https://cs.wikipedia.org/wiki/Seznam_d%C3%ADl%C5%AF_seri%C3%A1lu_Simpsonovi",
    "rootcs"
  ); // Fetch episode list
  let $ = cheerio.load(root);
  // Each table
  console.log("Processing...");
  let tasks = [];
  $("table.wikitable").each((_i, table) => {
    let $table = $(table);
    // Get number of season
    const seasonNum = parseInt(
      ($table.attr("id") || "").replaceAll("se-rada", "")
    );

    if (seasonNum) {
      $table
        .find("tbody")
        .find("tr[class='se-dil bezsouhrnu']")
        // Each episode
        .each((_episodeId, episode) => {
          tasks.push(
            new Promise((resolve, reject) => {
              let rejected = false;
              let $episode = $(episode);
              let overallId = parseInt($episode.find("th").text());
              if (!overallId) {
                reject("ID not found");
                rejected = true;
                return;
              }
              let root = {
                extraLinks: {
                  cs: "",
                  en: "",
                },
                extras: {
                  _id: overallId,
                  descriptions: { cs: "N/A", en: "N/A" },
                },
              };
              let episodeObject = {
                _id: overallId,
                seasonId: seasonNum,
                inSeasonId: Number,
                names: { en: "", cs: "" },
                direction: "",
                screenplay: "",
                premieres: { en: "", cs: "" },
              };
              // Each column of data
              $episode.find("td").each((index, raw) => {
                let $raw = $(raw);
                let data = $raw.text();

                switch (index) {
                  case 0: {
                    let input = parseInt(data);
                    if (!input) {
                      reject("inSeasonId not found");
                      rejected = true;
                      return;
                    }
                    episodeObject["inSeasonId"] = input;
                    break;
                  }
                  case 1: {
                    let input = data.trim().replaceAll(" ", " ");
                    if (!input) {
                      reject("English name not found");
                      rejected = true;
                      return;
                    }
                    episodeObject["names"]["en"] = input;
                    break;
                  }
                  case 2: {
                    let element = $raw.find("a").attr("href");

                    if (!element) {
                      rejected = true;
                      reject("Czech name/link not found");
                      return;
                    }
                    root["extraLinks"]["cs"] =
                      "https://cs.wikipedia.org" + element;

                    let parse = data
                      .trim()
                      .replaceAll(" ", " ")
                      .replaceAll(" (Prima)", "");
                    if (parse.includes(" (Česká televize) ")) {
                      parse = parse.split(" (Česká televize) ")[1];
                    }
                    episodeObject["names"]["cs"] = parse;
                    break;
                  }
                  case 3: {
                    let input = data
                      .trim()
                      .replaceAll(" ", " ")
                      .replaceAll("ová", "")
                      .replaceAll("pomocná režie: ", "")
                      .replaceAll(" a ", ", ");
                    if (!input) {
                      input = "N/A";
                    }
                    episodeObject["direction"] = input;

                    break;
                  }
                  case 4: {
                    let input = data
                      .trim()
                      .replaceAll(" ", " ")
                      .replaceAll("ová", "")
                      .replaceAll("námět: ", "")
                      .replaceAll(" scénář: ", ", ")
                      .replaceAll(" a ", ", ");
                    if (!input) {
                      input = "N/A";
                    }
                    episodeObject["screenplay"] = input;
                    break;
                  }
                  case 5: {
                    let input = convDate(data.trim().replaceAll(" ", " "));
                    if (!input) {
                      input = "N/A";
                    }
                    episodeObject["premieres"]["en"] = input;
                    break;
                  }
                  case 6: {
                    let input = convDate(data.trim().replaceAll(" ", " "));
                    if (!input) {
                      input = "N/A";
                    }
                    episodeObject["premieres"]["cs"] = input;
                    break;
                  }
                  /*
                  case 7:
                    episodeObject["code"] = data.trim();
                    break;
                    */
                }
              });
              if (!rejected) {
                fetchSite(root["extraLinks"]["cs"], overallId).then((html) => {
                  let $ = cheerio.load(html);
                  let element = $("h2:contains('Děj')");
                  if (typeof element.get(0) === "undefined") {
                    element = $("h2:contains('Zápletka')");
                  }
                  let bio = "";
                  if (typeof element.get(0) !== "undefined") {
                    let next = element.next();

                    while (next.get(0).tagName !== "h2") {
                      let tg = next.get(0).tagName;
                      if (tg !== "div") {
                        if (tg === "h3") {
                          if (bio !== "") bio += "\n";
                          bio +=
                            next
                              .text()
                              .trim()
                              .replaceAll(" ", " ")
                              .replaceAll("\n", "")
                              .replace(/ *\[[^\]]*]/g, "") + "\n";
                        } else if (tg === "p") {
                          bio +=
                            next
                              .text()
                              .trim()
                              .replaceAll(" ", " ")
                              .replaceAll("\n", "")
                              .replace(/ *\[[^\]]*]/g, "") + " ";
                        }
                      }

                      next = next.next();
                    }
                  }

                  if (bio !== "") {
                    root.extras.descriptions.cs = bio;
                  }

                  root["episode"] = episodeObject;
                  resolve(root);
                });
              } else {
                reject("Other error");
              }
            })
          );
        });
    }
  });
  let rawEpisodes = await Promise.allSettled(tasks);
  console.log("Done!");
  let episodes = [];
  let extras = [];
  rawEpisodes.forEach((episode, index) => {
    if (episode.status === "rejected") {
      console.log(`Rejected ${index + 1} because ${episode.reason}`);
      return;
    }
    episodes.push(episode.value.episode);
    extras.push(episode.value.extras);
  });
  episodes[176].names["cs"] = "Simpsonovi";
  console.log("Writing to file...");
  fs.writeFileSync(
    "./data/list.json",
    JSON.stringify({ episodes: episodes, extras: extras }, null, 2)
  );
}

async function main() {
  console.log("Starting...");
  await runProcess();
}

main();
