/*
Generate JSON list of all episodes from txt file
kinda sketchy and only works on copypasted czech wikipedia page
*/

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

const table = fs.readFileSync("./data/read.txt", "utf8");

let currentObj = {
  seasons: [],
};
let seasons = table.split("\n-split-\r\n");
seasons.forEach((season, seasonNo) => {
  let lines = season.split("\n");
  let episodes = [];
  lines.forEach((episode, episodeNo) => {
    if (episode !== "") {
      let info = episode.split("\t");
      let old = info;
      info = old.map((s) => s.trim());
      let episodeObject;
      try {
        episodeObject = {
          overallId: Number(info[0]),
          seasonId: seasonNo + 1,
          inSeasonId: episodeNo + 1,
          names: {
            en: info[2],
            cs: info[3],
          },
          direction: info[4],
          screenplay: info[5],
          premieres: {
            en: convDate(info[6]),
            cs: convDate(info[7]),
          },
          code: info[8].replace("\r", ""),
        };
      } catch (err) {
        console.log(err);
        console.log(episode);
      }

      episodes.push(episodeObject);
    }
  });
  currentObj.seasons.push({
    _id: Number(seasonNo + 1),

    episodes: episodes,
  });
});

fs.writeFileSync(
  "./data/list.json",
  JSON.stringify(currentObj, null, 4),
  "utf8"
);
console.log("Done...");
