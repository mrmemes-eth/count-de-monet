import { stringify } from "querystring";
import { writeFile, readFile } from "fs/promises";
import { Parser } from "json2csv";
import fetch from "node-fetch";

const config = JSON.parse(
  await readFile(new URL("./config.json", import.meta.url))
);

const genesisDate = new Date(config.genesisDate);
const skipFetch = process.argv.indexOf("--skip-fetch") > -1;

let allMessages = [];
let requests = 0;
let errors = 0;

const get = async (path, query = {}) => {
  const url = `https://discordapp.com/api/v9${path}?${stringify(query)}`;
  return await fetch(url, {
    headers: {
      Authorization: `Bot ${config.token}`,
      Accept: "application/json",
    },
  }).then((res) => res.json());
};

const getMessageBatchForChannel = async (channelId, overrides = null) => {
  const options = Object.assign({ limit: 100 }, overrides);
  return await get(`/channels/${channelId}/messages`, options)
    .then((messages) => {
      return messages;
    })
    .catch((err) => {
      console.log(err);
      errors++;
      return [];
    })
    .finally(() => {
      requests++;
    });
};

const getAllChannelMessages = async (channel) => {
  console.log("fetching messages for", channel.name, channel.id);
  let allChannelMessages = [];
  let channelMessageBatch = await getMessageBatchForChannel(channel.id);
  while (channelMessageBatch.length > 0) {
    try {
      allChannelMessages = allChannelMessages.concat(channelMessageBatch);
      const lastMessage = channelMessageBatch[channelMessageBatch.length - 1];
      // get the next batch of messages
      console.log(
        "fetched %s messages starting from: %s",
        channelMessageBatch.length,
        lastMessage.timestamp
      );
      channelMessageBatch = await getMessageBatchForChannel(channel.id, {
        before: lastMessage.id,
      }).catch((err) => {
        console.log(err);
        return [];
      });
    } catch (err) {
      console.log("Fatal error fetching messages:", err);
    }
  }
  console.log("finished fetching messages for %s", channel.name);
  return allChannelMessages;
};

const isGenesisMessage = (message) => {
  return new Date(message.timestamp) < genesisDate;
};

const keyMessageAttrs = (message) => {
  return {
    username: message.author.username,
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

    if (!skipFetch) {
      const textChannels = await get(`/guilds/${config.guildId}/channels`).then(
        (channels) => {
          return channels.filter(
            // channel types documented here:
            // https://discord.com/developers/docs/resources/channel#channel-object-channel-types
            // Proceeding under the assumption that we only want GUILD_TEXT or GUILD_PUBLIC_THREAD
            (channel) => channel.type === 0 || channel.type === 11
          );
        }
      );
      console.log("Text channel count:", textChannels.length);

      // iterate channels and retrieve all messages
      for (const channel of textChannels) {
        console.log("Fetching messages for", channel.name);
        const channelMessages = await getAllChannelMessages(channel);
        allMessages = allMessages.concat(channelMessages.map(keyMessageAttrs));
        console.log("Fetched %s messages total", channelMessages.length);
      }

      console.log(
        "Finished fetching %s messages in %s requests with %s errors",
        allMessages.length,
        requests,
        errors
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
    // write genesis messages to file
    const genesisMessages = allMessages.filter(isGenesisMessage);
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
