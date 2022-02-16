const cheerio = require("cheerio").default;
const fs = require("fs");

const czNames = [
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

function convDate(dateIn) {
  // 23. září 1994
  let date = dateIn;
  czNames.forEach((name, index) => {
    date = date.replace(`. ${name} `, `-${enNames[index]}-`);
  });
  return date;
}

async function fetchSite(fetch, link) {
  const response = await fetch(link);
  return response.text();
}

async function getDescription(link, fetch /*, id*/) {
  if (typeof link === "undefined" || !link) {
    return null;
  }
  /*
  DEBUG CODE
  let html;
  try {
    html = fs.readFileSync(`./data/debug/results/${id - 1}.html`);
  } catch (e) {
    console.log(e);
    return null;
  }
  */
  const html = await fetchSite(fetch, link);
  let $ = cheerio.load(html);
  let element = $("h2:contains('Děj')");
  if (typeof element.get(0) === "undefined") {
    element = $("h2:contains('Zápletka')");
  }
  if (typeof element.get(0) === "undefined") return null;
  let next = element.next();
  let bio = "";
  while (next.get(0).tagName !== "h2") {
    let tg = next.get(0).tagName;
    if (tg !== "div") {
      if (tg === "h3") {
        if (bio !== "") bio += "\n";
        bio +=
          next
            .text()
            .trim()
            .replaceAll("\n", "")
            .replace(/ *\[[^\]]*]/g, "") + "\n";
      } else if (tg === "p") {
        bio +=
          next
            .text()
            .trim()
            .replaceAll("\n", "")
            .replace(/ *\[[^\]]*]/g, "") + " ";
      }
    }

    next = next.next();
  }
  if (bio === "") {
    console.log(link);
    return null;
  }
  return bio;
}

async function main() {
  const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
  const updateLog = (await import("log-update")).default;
  updateLog("Fetching site…");
  const html = await fetchSite(
    fetch,
    "https://cs.wikipedia.org/wiki/Seznam_d%C3%ADl%C5%AF_seri%C3%A1lu_Simpsonovi"
  );
  let $ = cheerio.load(html);
  let seasons = [];
  let descLinks = [];
  $("table.wikitable").each((_, table) => {
    let id = $(table).attr("id") || "";
    if (id.includes("se-rada")) {
      let num = parseInt(id.replace("se-rada", ""));
      if (num > 0) {
        let episodes = [];
        $($(table).find("tbody"))
          .find("tr[class='se-dil bezsouhrnu']")
          .each((_, elem) => {
            let ovr = parseInt($(elem).find("th").text());
            updateLog(`Processing episodes… (${ovr})`);
            let episode = {
              overallId: ovr,
              seasonId: num,
              inSeasonId: Number,
              names: {},
              direction: String,
              screenplay: String,
              premieres: {},
            };
            $(elem)
              .find("td")
              .each((idx, raw) => {
                let data = $(raw).text();

                switch (idx) {
                  case 0:
                    episode["inSeasonId"] = parseInt(data);
                    break;
                  case 1:
                    episode["names"]["en"] = data.trim();
                    break;
                  case 2: {
                    let element = $(raw).find("a").attr("href");
                    if (typeof element !== "undefined") {
                      descLinks.push({
                        _id: ovr,
                        link: "https://cs.wikipedia.org" + element,
                      });
                    }

                    let parse = data.trim().replaceAll(" (Prima)", "");
                    if (parse.includes(" (Česká televize) ")) {
                      parse = parse.split(" (Česká televize) ")[1];
                    }
                    episode["names"]["cs"] = parse;
                    break;
                  }
                  case 3:
                    episode["direction"] = data
                      .trim()
                      .replaceAll("ová", "")
                      .replaceAll("pomocná režie: ", "")
                      .replaceAll(" a ", ", ");

                    break;
                  case 4:
                    episode["screenplay"] = data
                      .trim()
                      .replaceAll("ová", "")
                      .replaceAll("námět: ", "")
                      .replaceAll(" scénář: ", ", ")
                      .replaceAll(" a ", ", ");
                    break;
                  case 5:
                    episode["premieres"]["en"] = convDate(data.trim());
                    break;
                  case 6:
                    episode["premieres"]["cs"] = convDate(data.trim());
                    break;
                  case 7:
                    episode["code"] = data.trim();
                    break;
                }
              });
            episodes.push(episode);
          });

        seasons.push({ _id: num, episodes: episodes });
      }
    }
  });
  // Because why not
  seasons[7].episodes[23].names["cs"] = "Simpsonovi";

  const processDescriptions = async (array) => {
    let result = [];
    for (const item of array) {
      updateLog(
        `Processing descriptions… (${array.indexOf(item)}/${array.length})`
      );
      let desc = await getDescription(item.link, fetch /*, item._id*/);
      if (desc === null) continue;
      result.push({
        _id: item._id,
        description: desc,
      });
    }
    return result;
  };

  const extras = await processDescriptions(descLinks);
  fs.writeFileSync(
    "./data/list.json",
    JSON.stringify({ seasons: seasons, extras: extras }, null, 4),
    "utf8"
  );
  updateLog("Done!");
  process.exit(0);
}

main();
