const Discord = require("discord.io");
const cmd = require("./mimi-cmd");
const db = require("./mimi-db");
const format = require("./mimi-format");
const tracker = require("./tracker").new({
    interval: 50,
    pollTime: 5000,
    batchSize: 20
});

require("dotenv").load();

const options = {};

const bot = new Discord.Client({
    token: process.env.BOT_TOKEN,
    autorun: true
});

bot.on("ready", function (evt) {
    console.log(`Connected to Discord as ${bot.username} (${bot.id})`);
    console.log("in the following servers:")
    Object.values(bot.servers).forEach(server => console.log(`  ${server.name}`));
});

bot.on("disconnect", function (errMsg, code) {
    console.log(`Mimi disconnected (${code}: ${errMsg})`);
    console.log("Reconnecting...");
    bot.connect();
});

bot.on("message", function (user, userId, channelId, message, evt) {
    if (message.substring(0, 1) == "!") {
        cmd.parse(message.substring(1), {
            user: user,
            userId: userId,
            channelId: channelId,
            tracker: tracker,
            bot: bot,
            options: options
        })
        .then(msg => {
            if (msg) bot.sendMessage(msg);
        }, error => {
            console.log(error);
        });
    }
});

function sendMessage(msg) {
    bot.sendMessage(msg, (error, response) => {
        if (error) {
            console.log("Error sending message");
            console.log(error);
            console.log(response);
        }
    });
}

tracker.setDefaultHandler((stream, channelId, last) => {
    const limit = options[channelId] ? options[channelId]["notify-limit"] : 0;
    const showPrivate = options[channelId] ? options[channelId]["notify-private"] : false;
    const hideNsfw = options[channelId] ? options[channelId]["notify-nsfw-preview"] === false : false;

    // Make sure Mimi is still in the channel
    if (bot.channels[channelId]) {
        // Check channel's notify settings
        if ((!limit || Date.now() - last >= limit) &&
            (!stream.private || showPrivate)) {
            sendMessage({
                to: channelId,
                message: `<:mimiright:372499377773871115> ${stream.name} is now online!`,
                embed: format.stream(stream, stream.adult && hideNsfw)
            });
            return true;
        }
        else {
            console.log(`Notification to channel ${format.channelName(channelId, bot)} squelched`);
        }
    }
    console.log(`Mimi is not in channel ${channelId}`);
    return false;
});

Promise.all([
    db.getOptions()
    .then(results => {
        results.forEach(row => {
            options[row.discord_channel] = JSON.parse(row.json.toString());
        })
        console.log("Options loaded");
    }),
    db.getTrackedStreams()
    .then(results => {
        results.forEach(row => {
            tracker.subscribe(row.stream_name, row.discord_channel);
        })
        const streams = [...new Set(results.map(row => row.stream_name))];
        const channels = [...new Set(results.map(row => row.discord_channel))];
        console.log("Tracked streams loaded:");
        console.log(`  ${streams.length} streams tracked in ${channels.length} channels`);
    })
]).then(() => {
    tracker.start();
}, error => {
    console.log("Loading failed");
    console.log(error);
});