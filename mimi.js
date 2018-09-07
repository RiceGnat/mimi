const Discord = require("discord.io");
require("dotenv").load();

const cmd = require("./mimi-cmd");
const db = require("./mimi-db");
const format = require("./mimi-format");
const tracker = require("./tracker").new({
    interval: 1000,
    pollTime: 10000,
    batchSize: 20
});
const options = {};

const bot = new Discord.Client({
    token: process.env.BOT_TOKEN,
    autorun: true
});

bot.on("ready", function (evt) {
    console.log(`Connected as ${bot.username} (${bot.id})`);
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

    // Make sure Mimi is still in the channel
    if (bot.channels[channelId]) {
        // Check channel's notify settings
        if ((!limit || Date.now() - last >= limit) && (!stream.private || options[channelId]["notify-private"] === true)) {
            sendMessage({
                to: channelId,
                message: `<:mimiright:372499377773871115> ${stream.name} is now online!`,
                embed: format.stream(stream)
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
        console.log("Tracked streams loaded");
    })
]).then(() => {
    tracker.start();
}, error => {
    console.log("Loading failed");
    console.log(error);
});