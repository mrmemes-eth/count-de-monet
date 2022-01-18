#!/usr/bin/env node

import { writeFile, readFile } from "fs/promises";
import { Parser } from "json2csv";
import Yargs from "yargs";
import * as Discord from "../src/discord-api.js";

const argv = Yargs(process.argv.slice(2)).argv;
console.log(argv.skipFetch);

const genesisDate = new Date(Discord.config.genesisDate);
let allMessages = [];

const isGenesisMessage = (message) => {
  return new Date(message.timestamp) < genesisDate;
};

const keyMessageAttrs = (message) => {
  return {
    username: message.author.username,
    bot: message.author.bot || false,
    timestamp: message.timestamp,
    content: message.content,
    wordCount: message.content.split(" ").length,
  };
};

const aggregateUserStats = (acc, message) => {
  const user = acc[message.username] || { messageCount: 0, totalWordCount: 0 };
  const messageCount = user.messageCount + 1;
  const totalWordCount = user.totalWordCount + message.wordCount;
  const averageWordCount = Math.floor(totalWordCount / messageCount).toFixed(0);
  acc[message.username] = {
    messageCount,
    totalWordCount,
    averageWordCount,
  };
  return acc;
};

(async () => {
  try {
    console.log("Started fetching message history...");

    if (!argv.skipFetch) {
      const textChannels = await Discord.getGuildChannels(
        Discord.config.guildId
      );
      console.log("Text channel count:", textChannels.length);

      // iterate channels and retrieve all messages
      for (const channel of textChannels) {
        console.log("Fetching messages for", channel.name);
        const channelMessages = await Discord.getAllChannelMessages(channel);
        allMessages = allMessages.concat(channelMessages.map(keyMessageAttrs));
        console.log("Fetched %s messages total", channelMessages.length);
      }

      console.log(
        "Finished fetching %s messages in %s requests with %s errors",
        allMessages.length,
        Discord.requests,
        Discord.errors
      );

      // write all messages to file
      const allMessagesPath = "./data/all-messages.json";
      writeFile(allMessagesPath, JSON.stringify(allMessages, null, 2))
        .catch((err) => {
          console.log("Failed to write all messages to file:", err);
        })
        .then(() => {
          console.log("Wrote all messages to", allMessagesPath);
        });
    } else {
      allMessages = JSON.parse(await readFile("./data/all-messages.json"));
    }

    console.log("Aggregating genesis messages");
    // write genesis messages (not from bot and before genesis date) to file
    const genesisMessages = allMessages
      .filter(isGenesisMessage)
      .filter((m) => !m.bot);
    console.log(
      "There were %s messages before the genesis date of",
      genesisMessages.length,
      genesisDate
    );
    const genesisMessagesPath = "./data/genesis-messages.json";
    writeFile(genesisMessagesPath, JSON.stringify(genesisMessages, null, 2))
      .catch((err) => {
        console.log("Failed to write genesis messages to file:", err);
      })
      .then(() => {
        console.log("Wrote genesis messages to", genesisMessagesPath);
      });

    // write the aggregated stats to a JSON file
    const userStats = genesisMessages.reduce(aggregateUserStats, {});
    const userStatsPath = "./data/user-stats.json";
    writeFile(userStatsPath, JSON.stringify(userStats, null, 2))
      .catch((err) => {
        console.log("Error writing file", err);
      })
      .then(() => {
        console.log("Wrote user stats to", userStatsPath);
      });

    // write the aggregated stats to a CSV file
    const csvCompatibleStats = Object.keys(userStats).map((username) => {
      return {
        username,
        messageCount: userStats[username].messageCount,
        totalWordCount: userStats[username].totalWordCount,
        averageWordCount: userStats[username].averageWordCount,
      };
    });
    const json2csv = new Parser();
    const csv = json2csv.parse(csvCompatibleStats);
    const csvPath = "./data/user-stats.csv";
    writeFile(csvPath, csv)
      .catch((err) => {
        console.log("Error writing file", err);
      })
      .then(() => {
        console.log("Wrote user stats to", csvPath);
      });
  } catch (error) {
    console.error("Fatal error encountered:", error);
  }
})();
