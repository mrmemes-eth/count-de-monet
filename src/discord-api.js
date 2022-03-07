import 'dotenv/config'
import { stringify } from "querystring";
import { readFile } from "fs/promises";
import fetch from "node-fetch";

const token = process.env.TOKEN;

export let requests = 0;
export let errors = 0;

const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(resolve, ms, value));

export const get = async (path, query = {}) => {
  const url = `https://discordapp.com/api/v9${path}?${stringify(query)}`;
  return await fetch(url, {
    headers: {
      Authorization: `Bot ${token}`,
      Accept: "application/json",
    },
  })
    .then((res) => {
      if (res.headers.get("x-ratelimit-remaining") === "0") {
        const retryAfter =
          parseFloat(res.headers.get("x-ratelimit-reset-after")) * 1000;
        console.log("Rate limit hit, waiting %sms", retryAfter);
        return delay(retryAfter, res);
      } else {
        return res;
      }
    })
    .then((res) => res.json())
    .catch((err) => {
      console.log("Error:", err);
      errors++;
    });
};

export const getChannel = async (channelId) => {
  return await get(`/channels/${channelId}`)
    .then((channel) => {
      return channel;
    })
    .catch((err) => {
      console.log(err);
      return null;
    });
};

export const getGuildChannels = async (guildId) => {
  return await get(`/guilds/${guildId}/channels`).then((channels) => {
    return channels.filter(
      // channel types documented here:
      // https://discord.com/developers/docs/resources/channel#channel-object-channel-types
      // Exclude voice channels
      (channel) => channel.type !== 2
    );
  });
};

export const getChannelThreads = async (channelId) => {
  const archivedThreads = await get(
    `/channels/${channelId}/threads/archived/public`
  )
    .then((res) => res.threads || [])
    .catch((err) => console.log(err));
  const activeThreads = await get(`/channels/${channelId}/threads/active`)
    .then((res) => res.threads || [])
    .catch((err) => console.log(err));
  console.log(
    "Fetched %s archived threads and %s active threads in",
    archivedThreads.length,
    activeThreads.length,
    channelId
  );
  return archivedThreads.concat(activeThreads);
};

export const getGuildChannelsAndThreads = async (guildId) => {
  const channels = await getGuildChannels(guildId);
  console.log("Fetched %s channels", channels.length);
  const threads = await Promise.all(
    channels.map((channel) => getChannelThreads(channel.id))
  );
  return channels.concat(threads.reduce((acc, val) => acc.concat(val), []));
};

export const getMessageBatchForChannel = async (
  channelId,
  overrides = null
) => {
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

export const getAllChannelMessages = async (channel, overrides = null) => {
  console.log("fetching messages for", channel.name, channel.id);
  let allChannelMessages = [];
  let channelMessageBatch = await getMessageBatchForChannel(
    channel.id,
    overrides
  );
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
