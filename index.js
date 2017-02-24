const YouTubeAPI = require('youtube-node');
const ytdl = require('ytdl-core');
let fs = require('fs');

/*
 * Takes a discord.js client and turns it into a music bot.
 *
 * @param client The discord.js client.
 * @param options (Optional) Options to configure the music bot. Acceptable options are:
 *                prefix: The prefix to use for the commands (default '!').
 *                global: Whether to use a global queue instead of a server-specific queue (default false).
 *                maxQueueSize: The maximum queue size (default 20).
 */
module.exports = function (client, options) {
	// Get all options.
	let PREFIX = (options && options.prefix) || '!';
	let GLOBAL = (options && options.global) || false;
	let MAX_QUEUE_SIZE = (options && options.maxQueueSize) || 20;
	let DEFAULT_VOLUME = (options && options.volume) || 50;
	let ALLOW_ALL_SKIP = (options && options.anyoneCanSkip) || false;
	let MUSIC_MANAGER = (options && options.musicManager) || {};
	let CLEAR_INVOKER = (options && options.clearInvoker) || false;
	let AUTO_JOIN = (options && options.autoJoin) || [];
	let MUSIC_CHANNELS = (options && options.musicChannels) || [];
	let ALLOW_SEARCH = (options && options.allowSearch) || true;

	// These are YouTube specific options
	// These are totally untested doc.
	let SAFE_SEARCH = (options && options.yt && options.yt.safeSearch) || 'none';
	let DEFINITION_SEARCH = (options && options.yt && options.yt.videoDefinition) || 'any';
	let DURATION_SEARCH = (options && options.yt && options.yt.videoDuration) || 'any';

	let YouTube = new YouTubeAPI();
	if (options && options.youtube) YouTube.setKey(options.youtube);
	else throw new Error("No YouTube API key provided.");

	// This will make sure these options are added to each request
	YouTube.addParam('type', 'video');
	YouTube.addParam('safeSearch', SAFE_SEARCH);
	YouTube.addParam('videoDefinition', DEFINITION_SEARCH);
	YouTube.addParam('videoDuration', DURATION_SEARCH);

	// Create an object of queues.
	let queues = {};

	client.on('ready', function() {
		if (AUTO_JOIN.length > 0) {
			for (let i = 0; i < AUTO_JOIN.length; i++) {
				// This is a cheaty way of doing it because half the time Discord.js's collections
				// show up as undefined with .get. ¯\_(ツ)_/¯
				let voiceChannel = client.channels.array().find(channel => channel.id === AUTO_JOIN[i]);
				if (voiceChannel) {
					voiceChannel.join();
				} else {
					console.log('Couldn\'t find: ' + AUTO_JOIN[i]);
				}
			}
		}
	});

	// Catch message events.
	client.on('message', msg => {
		const message = msg.content.trim();

		if (MUSIC_CHANNELS.length > 0 && MUSIC_CHANNELS.indexOf(msg.channel.id) == -1) {
			return ;
		}

		// Check if the message is a command.
		if (message.startsWith(PREFIX)) {
			// Get the command and suffix.
			const command = message.split(/[ \n]/)[0].substring(PREFIX.length).toLowerCase().trim();
			const suffix = message.substring(PREFIX.length + command.length).trim();

			// Process the commands.
			switch (command) {
				case 'play':
					return play(msg, suffix);
				case 'skip':
					return skip(msg, suffix);
				case 'queue':
					return queue(msg, suffix);
				case 'pause':
					return pause(msg, suffix);
				case 'resume':
					return resume(msg, suffix);
				case 'volume':
					return volume(msg, suffix);
			}
			if (CLEAR_INVOKER) {
				msg.delete();
			}
		}
	});

	/*
     * Async fetching of first search result or a YouTube video URL
	 * @param suffix Command suffix.
	 * @return Promise resolves a YouTube video ID
	 */
	function getYouTubeVideo(suffix) {
		return new Promise((resolve, reject) => {
			if (!suffix.toLowerCase().startsWith('https://www.youtube.com/watch?v=')) {
				if (!ALLOW_SEARCH) reject("Searching has been disabled.")
				YouTube.search(suffix, 1, (error, result) => {
					if (error) {
						reject(error.message);
					} else if (result.items.length == 0 || result.items[0].id.videoId === undefined) {
						reject("No results");
					} else {
						resolve(result.items[0].id.videoId);
					}
				});
			} else {
				resolve(suffix.replace("https://www.youtube.com/watch?v=", "").trim());
			}
		});
	}

	/*
	 * @param guild:string - The unique id of the guild
	 * @param rank:string - The name of the rank to fetch
	 * @return role:object - The role object
	 */
	function getRoleByName(guild, rank) {
		return client.guilds.get(guild).roles.find(role => String(role.name).toLowerCase() === String(rank).toLowerCase());
	}

	/*
     * Checks if a user is permitted to skip a track 
	 * @param msg:object - The Discord message object
	 * @param queue:array - The current queue
	 * @return canSkip:boolean - If the user can skip
	 * TODO: Make this better, kinda poorly written.
	 */
	function canSkip(msg, queue) {
		if (ALLOW_ALL_SKIP) return true;
		else if (queue[0].requester === msg.author.id) return true;
		else if (!(msg.guild.id in MUSIC_MANAGER)) return false;
		else if (msg.member.roles.has(getRoleByName(msg.guild.id, MUSIC_MANAGER[msg.guild.id]).id)) return true;
		else return false;
	}

	/*
	 * Gets a queue.
	 *
	 * @param server The server id.
	 */
	function getQueue(server) {
		// Check if global queues are enabled.
		if (GLOBAL) server = '_'; // Change to global queue.

		// Return the queue.
		if (!queues[server]) queues[server] = [];
		return queues[server];
	}

	/*
	 * Play command.
	 *
	 * @param msg Original message.
	 * @param suffix Command suffix.
	 */
	function play(msg, suffix) {
		// Make sure the user is in a voice channel.
		if (msg.member.voiceChannel === undefined) return msg.channel.sendMessage(wrap('You\'re not in a voice channel.'));

		// Make sure the suffix exists.
		if (!suffix) return msg.channel.sendMessage(wrap('No video specified!'));

		// Get the queue.
		const queue = getQueue(msg.guild.id);

		// Check if the queue has reached its maximum size.
		if (queue.length >= MAX_QUEUE_SIZE) {
			return msg.channel.sendMessage(wrap('Maximum queue size reached!'));
		}

		// Get the video information.
		msg.channel.sendMessage(wrap('Searching...')).then(response => {
			getYouTubeVideo(suffix).then((id) => {
				YouTube.getById(id, (error, result) => {
					if (error || result.items.length == 0) {
						return response.edit(wrap('Invalid video!'));
					}
					else {
						let info = {};

						info.title = result.items[0].snippet.title;

						info.url = "https://www.youtube.com/watch?v=" + id;
						info.requester = msg.author.id;

						// Queue the video.
						response.edit(wrap('Queued: ' + info.title)).then(() => {
							queue.push(info);

							// Play if only one element in the queue.
							if (queue.length === 1) executeQueue(msg, queue);
						}).catch(() => {
							
						});
					}
				});
			}).catch((error) => {
				return response.edit(wrap(error));
			});
		}).catch(() => {

		});
	}

	/*
	 * Skip command.
	 *
	 * @param msg Original message.
	 * @param suffix Command suffix.
	 */
	function skip(msg, suffix) {
		// Get the voice connection.
		const voiceConnection = client.voiceConnections.find(val => val.channel.guild.id == msg.guild.id);
		if (voiceConnection === null) return msg.channel.sendMessage(wrap('No music being played.'));

		// Get the queue.
		const queue = getQueue(msg.guild.id);

		if (!canSkip(msg, queue)) return msg.channel.sendMessage(wrap('You cannot skip this as you didn\'t queue it.')).then((response) => {
			response.delete(5000);
		});

		// Get the number to skip.
		let toSkip = 1; // Default 1.
		if (!isNaN(suffix) && parseInt(suffix) > 0) {
			toSkip = parseInt(suffix);
		}
		toSkip = Math.min(toSkip, queue.length);

		// Skip.
		queue.splice(0, toSkip - 1);

		// Resume and stop playing.
		const dispatcher = voiceConnection.player.dispatcher;
		if (voiceConnection.paused) dispatcher.resume();
		dispatcher.end();

		msg.channel.sendMessage(wrap('Skipped ' + toSkip + '!'));
	}

	/*
	 * Queue command.
	 *
	 * @param msg Original message.
	 * @param suffix Command suffix.
	 */
	function queue(msg, suffix) {
		// Get the queue.
		const queue = getQueue(msg.guild.id);

		// Get the queue text.
		const text = queue.map((video, index) => (
			(index + 1) + ': ' + video.title
		)).join('\n');

		// Get the status of the queue.
		let queueStatus = 'Stopped';
		const voiceConnection = client.voiceConnections.find(val => val.channel.guild.id == msg.guild.id);
		if (voiceConnection !== null) {
			const dispatcher = voiceConnection.player.dispatcher;
			queueStatus = dispatcher.paused ? 'Paused' : 'Playing';
		}

		// Send the queue and status.
		msg.channel.sendMessage(wrap('Queue (' + queueStatus + ' | ' + queue.length + '/' + MAX_QUEUE_SIZE + '):\n' + text));
	}

	/*
	 * Pause command.
	 *
	 * @param msg Original message.
	 * @param suffix Command suffix.
	 */
	function pause(msg, suffix) {
		// Get the voice connection.
		const voiceConnection = client.voiceConnections.find(val => val.channel.guild.id == msg.guild.id);
		if (voiceConnection === null) return msg.channel.sendMessage(wrap('No music being played.'));

		if (!msg.member.roles.has(getRoleByName(msg.guild.id, MUSIC_MANAGER[msg.guild.id]).id))
			return msg.channel.sendMessage(wrap('You are not authorized to use this.'));

		// Pause.
		msg.channel.sendMessage(wrap('Playback paused.'));
		const dispatcher = voiceConnection.player.dispatcher;
		if (!dispatcher.paused) dispatcher.pause();
	}

	/*
	 * Resume command.
	 *
	 * @param msg Original message.
	 * @param suffix Command suffix.
	 */
	function resume(msg, suffix) {
		// Get the voice connection.
		const voiceConnection = client.voiceConnections.find(val => val.channel.guild.id == msg.guild.id);
		if (voiceConnection === null) return msg.channel.sendMessage(wrap('No music being played.'));

		if (!msg.member.roles.has(getRoleByName(msg.guild.id, MUSIC_MANAGER[msg.guild.id]).id))
			return msg.channel.sendMessage(wrap('You are not authorized to use this.'));

		// Resume.
		msg.channel.sendMessage(wrap('Playback resumed.'));
		const dispatcher = voiceConnection.player.dispatcher;
		if (dispatcher.paused) dispatcher.resume();
	}

	/*
	 * Volume command.
	 *
	 * @param msg Original message.
	 * @param suffix Command suffix.
	 */
	function volume(msg, suffix) {
		// Get the voice connection.
		const voiceConnection = client.voiceConnections.find(val => val.channel.guild.id == msg.guild.id);
		if (voiceConnection === null) return msg.channel.sendMessage(wrap('No music being played.'));

		if (!msg.member.roles.has(getRoleByName(msg.guild.id, MUSIC_MANAGER[msg.guild.id]).id))
			return msg.channel.sendMessage(wrap('You are not authorized to use this.'));

		// Get the dispatcher
		const dispatcher = voiceConnection.player.dispatcher;

		if (suffix > 200 || suffix < 0) return msg.channel.sendMessage(wrap('Volume out of range!')).then((response) => {
			response.delete(5000);
		});

		msg.channel.sendMessage(wrap("Volume set to " + suffix));
		dispatcher.setVolume((suffix/100));
	}

	/*
	 * Execute the queue.
	 *
	 * @param msg Original message.
	 * @param queue The queue.
	 */
	function executeQueue(msg, queue) {
		// If the queue is empty, finish.
		if (queue.length === 0) {
			msg.channel.sendMessage(wrap('Playback finished.'));

			// Leave the voice channel.
			const voiceConnection = client.voiceConnections.find(val => val.channel.guild.id == msg.guild.id);
			if (AUTO_JOIN.indexOf(voiceConnection.channel.id) == -1) { 
				if (voiceConnection !== null) return voiceConnection.disconnect();
			} else {
				// Prevent further execution; standby
				return ;
			}
		}

		new Promise((resolve, reject) => {
			// Join the voice channel if not already in one.
			const voiceConnection = client.voiceConnections.find(val => val.channel.guild.id == msg.guild.id);
			if (voiceConnection === null) {
				// Check if the user is in a voice channel.
				if (msg.member.voiceChannel) {
					msg.member.voiceChannel.join().then(connection => {
						resolve(connection);
					}).catch((error) => {
						console.log(error);
					});
				} else {
					// Otherwise, clear the queue and do nothing.
					queue.splice(0, queue.length);
					reject();
				}
			} else {
				resolve(voiceConnection);
			}
		}).then(connection => {
			// Get the first item in the queue.
			const video = queue[0];

			console.log(video.url);

			// Play the video.
			msg.channel.sendMessage(wrap('Now Playing: ' + video.title)).then(() => {
				let dispatcher = connection.playStream(ytdl(video.url, {filter: 'audioonly'}), {seek: 0, volume: (DEFAULT_VOLUME/100)});

				connection.on('error', (error) => {
					// Skip to the next song.
					console.log(error);
					queue.shift();
					executeQueue(msg, queue);
				});

				dispatcher.on('error', (error) => {
					// Skip to the next song.
					console.log(error);
					queue.shift();
					executeQueue(msg, queue);
				});

				dispatcher.on('end', () => {
					// Wait a second.
					setTimeout(() => {
						// Remove the song from the queue.
						queue.shift();

						// Play the next song in the queue.
						executeQueue(msg, queue);
					}, 1000);
				});
			}).catch((error) => {
				console.log(error);
			});
		}).catch((error) => {
			console.log(error);
		});
	}
}

/*
 * Wrap text in a code block and escape grave characters.,
 * @param text The input text.
 * @return The wrapped text.
 */
function wrap(text) {
	return '```\n' + text.replace(/`/g, '`' + String.fromCharCode(8203)) + '\n```';
}