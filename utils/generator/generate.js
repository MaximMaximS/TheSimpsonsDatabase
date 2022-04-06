const fs = require("fs"); // File system
const cheerio = require("cheerio").default; // Html parser
const config = require("./config.json"); // Config

async function fetchSite(url, alias) {
  if (config.fetch) {
    const fetch = (...args) =>
      import("node-fetch").then(({ default: fetch }) => fetch(...args));
    const response = await fetch(url);
    const result = await response.text();
    fs.writeFile(`./pages/${alias}.html`, result, (err) => {
      if (err) throw err;
    });
    return result;
  }
  return fs.readFileSync(`./pages/${alias}.html`);
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

async function fetchAll() {
  const root = await fetchSite(config.rootcs, "rootcs"); // Fetch episode list
  let $ = cheerio.load(root);
  // Each table

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
            new Promise((resolve) => {
              let $episode = $(episode);
              let overallId = parseInt($episode.find("th").text());
              let episodeObject = {
                _id: overallId,
                seasonId: seasonNum,
                inSeasonId: Number,
                names: {
                  cs: String,
                  en: String,
                },
                direction: String,
                screenplay: String,
                premieres: {
                  cs: String,
                  en: String,
                },
              };
              $episode.find("td").each((index, raw) => {
                let data = $(raw).text();

                switch (index) {
                  case 0:
                    episodeObject["inSeasonId"] = parseInt(data);
                    break;
                  case 1:
                    episodeObject["names"]["en"] = data.trim();
                    break;
                  case 2: {
                    // TODO: Add description link
                    /*
                  let element = $(raw).find("a").attr("href");
                  if (typeof element !== "undefined") {
                    descLinks.push({
                      _id: ovr,
                      link: "https://cs.wikipedia.org" + element,
                    });
                  }
                  */

                    let parse = data.trim().replaceAll(" (Prima)", "");
                    if (parse.includes(" (Česká televize) ")) {
                      parse = parse.split(" (Česká televize) ")[1];
                    }
                    episodeObject["names"]["cs"] = parse;
                    break;
                  }
                  case 3:
                    episodeObject["direction"] = data
                      .trim()
                      .replaceAll("ová", "")
                      .replaceAll("pomocná režie: ", "")
                      .replaceAll(" a ", ", ");

                    break;
                  case 4:
                    episodeObject["screenplay"] = data
                      .trim()
                      .replaceAll("ová", "")
                      .replaceAll("námět: ", "")
                      .replaceAll(" scénář: ", ", ")
                      .replaceAll(" a ", ", ");
                    break;
                  case 5:
                    episodeObject["premieres"]["en"] = convDate(data.trim());
                    break;
                  case 6:
                    episodeObject["premieres"]["cs"] = convDate(data.trim());
                    break;
                  case 7:
                    episodeObject["code"] = data.trim();
                    break;
                }
              });
              resolve(episodeObject);
            })
          );
        });
    }
  });
  let episodes = await Promise.all(tasks);
  console.log(episodes);
}

async function main() {
  console.log("Fetching...");
  await fetchAll();
}

main();
