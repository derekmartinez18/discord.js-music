const Client = require('discord.js').Client;
const Auth = require('./auth.json');

const music = require('../');

// Create a new client.
const client = new Client();

/**
 * I've included some default options, and some modified ones. These are ones I run on my own
 * version of the bot, feel free to customize this to fit your own needs.
 */
music(client, {
	prefix: '-',     // Prefix of '-'.
	global: false,   // Server-specific queues.
	maxQueueSize: 10, // Maximum queue size of 10.
	musicManager: { // List of servers and their music manager roles
		'<server id>': 'Music Manager'
	},
	volume: 100, // Set's default volume to 100%
	anyoneCanSkip: false, // Only the person who added a track, plus music managers, can skip
	clearInvoker: true, // If permissions applicable, allow the bot to delete the messages that invoke it (start with prefix)
	youtube: Auth.youtube, // Our secure token
	allowSearch: true,
	yt: {
		safeSearch: 'none', // We don't care about swears, no parental filter
		videoDefinition: 'high', // We don't don't like shitty sounding music, I decided to set mine to high. Recommended: any
		videoDuration: 'medium' // We don't want incredibly short stuff, or anything that is impossibly long. 
	},
	autoJoin: [
		'<my music voice channel id>' // Server name
	],
	musicChannels: [
		'<my music text channel id>' // Server name
	]
});

// Login.
client.login(Auth.token);
