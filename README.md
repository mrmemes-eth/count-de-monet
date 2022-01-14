# count-de-monet

![bearnaise, not having it](https://i.ytimg.com/vi/u4FmmF1N57U/maxresdefault.jpg)

> Count de Monet: Bearnaise, do we have any of those delicious raisins left?  
> Bearnaise: You ate yours. These are mine.  
> Count de Monet: Au contraire, they are mine! I paid for them! Hand them over!  
> Bearnaise: (mockingly) 'I paid for them! They're mine!'  
> Count de Monet: Don't be saucy with me, Bearnaise.  

This is a really simple bot for discord that counts messages that occurred before a date. You'll need to add a `config.json` file with this shape:

```json
{
  "token": "<discord-bot-token>",
  "guildId": "<discord-guild-id>",
  "genesisDate": "2021-11-01"
}
```

The simplest way to do that would be to copy the example config into place and then edit its values:

```shell
cp src/config{.example,}.json
```

Once you have the configuration edited, do an initial run with:

```shell
node src/index.js
```

While iterating on the output transformation, I added a flag to skip fetching the data every time. Once you have a `data/all-messages.json` file in place, you can skip the API interaction like so:

```shell
node src/index.js --skip-fetch
```
