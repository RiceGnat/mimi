const Discord = require("discord.io");
require("dotenv").load();

const cmd = require("./mimi-cmd");
const db = require("./mimi-db");
const format = require("./mimi-format");
const picarto = require("./picarto");
const tracker = require("./tracker").new({
    interval: 50
});
const options = {};

// Bot setup
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
        cmd.parse(message.substring(1), user, userId, channelId);
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

function notifyOnline(stream, channelId, last) {
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
}

cmd.on("stream", (name, sender) => {
    picarto.getStreamInfo(name)
    .then(stream => ({
        embed: format.stream(stream)
    }), error => ({
        message: "<:mimiconfused:372499377807425566> Stream not found"
    }))
    .then(msg => {
        sendMessage(Object.assign({
            to: sender.channelId
        }, msg));
    });
}).on("track", (name, sender) => {
    tracker.track(name, sender.channelId, notifyOnline)
    .then(stream => {
        console.log(`User ${sender.user} tracked ${stream.name} in channel ${format.channelName(sender.channelId, bot)}`);
        return `<:mimigreetings:372499377501241355> Now tracking ${stream.name}`
    }, error => {
        if (error.isDuplicate)
            return `<:mimiscratch:372499377928798208> Already tracking ${error.stream.name} in this channel`;
        
        console.log("Error trying to track stream");
        console.log(error);
        return "<:mimiconfused:372499377807425566> Couldn't track stream";
    })
    .then(msg => {
        sendMessage({
            to: sender.channelId,
            message: msg
        });
    });
}).on("untrack", (name, sender) => {
    tracker.untrack(name, sender.channelId)
    .then(results => 
        results.affectedRows > 0 ?
        "<:mimisad:372499377752768522> Stream untracked"
        : "<:mimiwondering:372499377807425546> Stream isn't being tracked..."
    , error =>
        `<:mimiconfused:372499377807425566> Something went wrong`
    )
    .then(msg => {
        sendMessage({
            to: sender.channelId,
            message: msg
        });
    });
}).on("tracking", sender => {
    db.getTrackedStreamsByChannel(sender.channelId)
    .then(results => {
        Promise.all(results.map(row =>
            picarto.getStreamInfo(row.stream_name)
            .catch(error => row.stream_name)
        )).then(results => 
            results.map(stream => 
                stream.name ?
                `${stream.name} ${stream.online ? `[**(online)**](https://picarto.tv/${stream.name})` : "*(offline)*"}`
                : stream
            ).sort().join("\n")
        ).then(msg => {
            sendMessage({
                to: sender.channelId,
                embed: { description: msg }
            });
        })
    })
}).on("set", (key, value, sender) => {
    setOption(sender.channelId, key, value)
    .then(() => {
        console.log(`User ${sender.user} set option ${key} to ${value} in channel ${format.channelName(sender.channelId, bot)}`);
        return "<:mimivictory:372499377639522325> Option saved";
    }, error => `<:mimiscratch:372499377928798208> ${error}`)
    .then(msg => {
        sendMessage({
            to: sender.channelId,
            message: msg
        });
    });
}).on("mimi", (name, sender) => {
    picarto.getEmote(name)
    .then(data => {
        bot.uploadFile({
            to: sender.channelId,
            file: data,
            filename: `${name}.png`
        });
    });
}).on("help", sender => {
    sendMessage({
        to: channelID,
        embed: {
            title: "<:mimigreetings:372499377501241355> Mimi",
            description: "Picarto bot for stream tracking. For more information, see [GitHub](https://github.com/RiceGnat/mimi/).",
            fields: [
                {
                    name: "Streams",
                    value: [
                        "`!stream <name>`\tLook up a stream",
                        "`!track <name>`\tTrack a stream in this channel",
                        "`!untrack <name>`\tUntrack a stream for this channel",
                        "`!tracking`\tShow a list of streams tracked in this channel"].join("\n")
                },
                {
                    name: "Control",
                    value: [
                        "`!set <option> <value>`\tSet options (per channel)",
                        "\t`!set notify-limit <time>[s|m|h]`\tLimit repeat notifications",
                        "\t`!set notify-private on|off`\tPrivate stream notifications"].join("\n")
                },
                {
                    name: "Emotes",
                    value: [
                        "`!mimi (emote)`\tMimi emotes from Picarto chat"].join("\n")
                }
            ],
            footer: { text: `Developed by RiceGnat#9420`}
        }
    });
});

function setOption(channelId, key, value) {
    return new Promise((resolve, reject) => {
        if (!options[channelId]) options[channelId] = {};

        switch (key) {
            case "notify-limit":
                if (!value) return reject("Specify a time (eg 30s, 15m, 1h)");
                var match = value.toLowerCase().match(/^(\d+)([hms]{0,1})$/);
                if (!match) return reject("Invalid time specified");
                var duration = match[1];
                var unit = match[2];
                if (!unit) unit = "s";
                switch (unit) {
                    case "h":
                        duration *= 60;
                    case "m":
                        duration *= 60;
                    case "s":
                        duration *= 1000;
                }
                options[channelId][key] = duration;
                break;
            case "notify-private":
                if (value.toLowerCase() === "on") options[channelId][key] = true;
                else if (value.toLowerCase() === "off") options[channelId][key] = false;
                else return reject("Specify on/off");
                break;
            default:
                return reject("Unrecognized option");
        }
        resolve(db.saveOptions(channelId, options[channelId]));
    });
}

Promise.all([
    db.getOptions()
    .then(results => {
        results.forEach(row => {
            options[row.discord_channel] = JSON.parse(row.json.toString());
        })
        console.log("Loaded options.")
    }),
    db.getTrackedStreams()
    .then(results => {
        results.forEach(row => {
            tracker.subscribe(row.stream_name, row.discord_channel, notifyOnline);
        })
        console.log("Loaded tracked streams.")
    })
]).then(() =>
    tracker.start()
);