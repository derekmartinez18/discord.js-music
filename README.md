# Discord.js Music Plugin

This version is not yet stable, although has been mildly tested, it has not been that extensive. It's an update of the original by [ruiqimao](https://github.com/ruiqimao/discord.js-music) for [Discord.js](https://discord.js.org/)'s version v11.x, and adds a few extra sprinkles. It still requires tweaks and testing but yeah it's something.

It adds:
* volume control (1 - 200)
* a music manager by Discord role (multi-server compatible, customizable)
* (optionally) restricts `skip` to the person who added the request, and music managers
* restricts `resume`, `pause`, and `volume` to music managers
* optionally auto join selected music channels 
* optionally restrict command usage to specific text-channels

Things to do:
* ~~Turn `musicManager` into an object to contain and support multiple guilds.~~
* Make sure it really really works
* Get search working again
* Auto-pause when nobody is left in channel

Things left to test:
* Sharing queue across multiple servers 

Known Issues:  
* On Windows playback seems to be cut short if there's any hint of lag. Probably not a good idea to play Overwatch and host this at the same time on the same system.
* On Windows there seems to be a lot more occurrences of "Invalid Video". 

Installation:  
1. Download and extract anywhere  
2. Edit examples/musicBot to match your needed config  
3. In the root folder, run:
```bash
npm install
```


This is a music plugin for Discord.js. Using it is as easy as:
```javascript
const Client = require('discord.js').Client;
const music = require('./path/to/this/project');

const client = new Client();
music(client);

client.login('< bot token here >');
```

The module consists of a single function, which takes two arguments:
```javascript
/*
 * Initialize the music plugin.
 *
 * @param client The Discord.js client.
 * @param options (Optional) A
 */
music(client, options);
```

Options:
* `prefix` The prefix to use for the command (default '!').
* `global`  Whether to use the same queue for all servers, instead of server-specific queues (default false).
* `maxQueueSize` The maximum queue size (default 20)
* `volume` The volume to start playback at (default 50 [0.5])
* `anyOneCanSkip` Allow anyone to skip a track (if disabled, only the music managers + the person who added can skip). (default false).
* `clearInvoker` Have the bot remove messages which invoke, these are the one that start with the prefix provided. (default false)
* `autoJoin` An array containing voice channel ids to automatically join.
* `musicChannels` An array containing text channel ids where the bot can be used. Note: adding one will limit globally, so be sure to add one per-server.
* `allowSearch` If searching on YouTube should be allowed. (default true)
* `youtube` (REQUIRED) your YouTube API key. (We strongly recommend storing this in Auth)
* `yt` An object containing YouTube configuration options

YouTube Configuration Options: 
* `safeSearch` can be `none`, `moderate` or `strict`. Defines parental filters (default 'none')
* `videoDefinition` can be `any`, `standard` or `high`. Will define what quality of videos should be searched (default 'any')
* `videoDuration` can be `any`, `short`, `medium` or `long`.
```
any – Do not filter video search results based on their duration. This is the default value.
long – Only include videos longer than 20 minutes.
medium – Only include videos that are between four and 20 minutes long (inclusive).
short – Only include videos that are less than four minutes long.
```

How to add "Music Managers"
```javascript
musicManager: {
	'<server id>': '<role name>'
},
```

How to add auto join channels
```JavaScript
autoJoin: [
	'<channel id>' // My Server Name (for reference)
]
```

How to restrict bot to only be invoked from certain channels
```JavaScript
musicChannels: [
	'<channel id>' // My Server Name (for reference)
]
```

**How to get server id?**  
1. Goto server settings.  
2. Select 'Widget'.  
3. Copy the number in `SERVER ID`.  

**How to get channel ids?**  
1. Go to _user_ settings.  
2. Select 'Appearance'.  
3. Check the box "Developer Mode"  
4. Go to any server and right click the channel you want to get the ID of, and select 'Copy ID'

**What permissions do the roles need?**
- Nothing, this uses only the _name_ of the role rather than permissions.

The commands available are:
* `play <url>`: Play a video/music. It can take a URL from various services (YouTube, Vimeo, YouKu, etc). Search has been removed temporally until a workaround can be found.
* `skip [number]`: Skip some number of songs. Will skip 1 song if a number is not specified.
* `queue`: Display the current queue.
* `pause`: Pause music playback. (requires music manager)
* `resume`: Resume music playback. (requires music manager)
* `volume`: Adjust the playback volume between 1 and 200 (requires music manager)
