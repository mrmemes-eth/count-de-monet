#!/usr/bin/env node

import { writeFile, readFile } from "fs/promises";
import { Parser } from "json2csv";
import Yargs from "yargs";
import { getAllChannelMessages } from "../src/discord-api.js";

const argv = Yargs(process.argv.slice(2)).argv;

const keyMessageAttrs = (message) => {
  return {
    username: message.author.username,
    timestamp: message.timestamp,
    content: message.content,
  };
};

(async () => {
  const recentMessages = await getAllChannelMessages({
    name: "channel",
    id: argv.channelId,
  });
  const csv = new Parser().parse(recentMessages.map(keyMessageAttrs));
  const csvPath = `./data/${argv.channelId}-messages.csv`;
  writeFile(csvPath, csv)
    .catch((err) => {
      console.log("Error writing file", err);
    })
    .then(() => {
      console.log("Wrote user stats to", csvPath);
    });
})();
