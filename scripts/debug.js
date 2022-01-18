#!/usr/bin/env node

import { getAllChannelMessages, getChannel } from "../src/discord-api.js";

(async () => {
  const testChannel = await getChannel("<channel-id>");
  console.log("channel:", testChannel.name);

  await getAllChannelMessages(testChannel, {
    before: "<message-id>",
  }).then((messages) => {
    console.log("message count", messages.length);
    const lastMessage = messages[messages.length - 1];
    console.log("last message id", lastMessage.id);
  });

  console.log("finished:", new Date());
})();
