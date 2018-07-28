const Discord = require("discord.io");
const Picarto = require("./picarto.js");
const http = require("https");
const mysql = require("mysql");
const auth = require("./auth.json");
const config = require("./package.json").config;

var streamTracker = {};
var options = {};

// Bot setup
var bot = new Discord.Client({
    token: process.env.BOT_TOKEN || auth.token,
    autorun: true
});

bot.on("ready", function (evt) {
    console.log(`Connected as ${bot.username} (${bot.id})`);
});

bot.on("message", function (user, userID, channelID, message, evt) {
    if (message.substring(0, 1) == "!") {
        var args = message.substring(1).split(" ");
        var cmd = args[0];

        args = args.splice(1);
        switch (cmd) {
            case "stream":
                Picarto.GetStreamInfo(args[0], (stream) => {
                    bot.sendMessage({
                        to: channelID,
                        message: !stream ? "<:mimiconfused:372499377807425566> Stream not found" : null,
                        embed: stream ? BuildEmbed(stream) : null
                    }, messageCallback);
                });
                break;
            case "track":
                Picarto.GetStreamInfo(args[0], (stream) => {
                    if (stream) {
                        TrackStream(stream.name, channelID, (error) => {
                            var message;
                            if (error && error.code == "ER_DUP_ENTRY") {
                                message = `<:mimiscratch:372499377928798208> Already tracking ${stream.name} in this channel`;
                            }
                            else if (error) {
                                console.log("Error trying to track stream");
                                console.log(error);
                                message = "<:mimiconfused:372499377807425566> Couldn't track stream";
                            }
                            else {
                                AddToStreamTracker(stream.name, channelID);
                                console.log(`User ${user} tracked ${stream.name} in channel ${getFullChannelName(channelID)}`);
                                message = `<:mimigreetings:372499377501241355> Now tracking ${stream.name}`;
                            }
                            bot.sendMessage({
                                to: channelID,
                                message: message
                            }, messageCallback)
                        });
                    }
                    else {
                        bot.sendMessage({
                            to: channelID,
                            message: "<:mimiconfused:372499377807425566> Stream not found",
                        }, messageCallback);
                    }
                });
                break;
            case "untrack":
                UntrackStream(args[0], channelID);
                RemoveFromStreamTracker(args[0], channelID);
                bot.sendMessage({
                    to: channelID,
                    message: "<:mimisad:372499377752768522> Stream untracked",
                }, messageCallback);
                break;
            case "tracking":
                GetTrackedStreamsByChannel(channelID, (error, results, fields) => {
                    if (results) {
                        var output = [];
                        function buildOut() {
                            return (stream) => {
                                if (stream) output.push(stream.name + (stream.online ? " **(online)**" : " *(offline)*"));
                                else output.push(null);
                                if (output.length == results.length) {
                                    bot.sendMessage({
                                        to: channelID,
                                        embed: { description: output.join("\n") }
                                    }, messageCallback);
                                }
                            }
                        }
                        results.forEach((row, index) => {
                            Picarto.GetStreamInfo(row.stream_name, buildOut());
                        });
                    }
                });
                break;
            case "set":
                if (args[0]) {
                    var key = args[0].toLowerCase();
                    var value = args[1];
                    SetOption(channelID, key, value, (error) => {
                        var message;
                        if (error) {
                            message = "<:mimiscratch:372499377928798208> " + error;
                        }
                        else {
                            message = "<:mimivictory:372499377639522325> Option saved";
                            console.log(`User ${user} set option ${key} to ${value} in channel ${getFullChannelName(channelID)}`);
                        }
                        bot.sendMessage({
                            to: channelID,
                            message: message,
                        }, messageCallback);
                    });
                }
                break;
            case "mimi":
                Picarto.GetEmote(args[0], function (data) {
                    bot.uploadFile({
                        to: channelID,
                        file: Buffer.concat(data),
                        filename: `${args[0]}.png`
                    }, messageCallback);
                });
                break;
            case "help":
                bot.sendMessage({
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
                }, messageCallback);
                break;
        }
    }
});

bot.on("disconnect", function (errMsg, code) {
    console.log(`Mimi disconnected (${code}: ${errMsg})`);
    console.log("Reconnecting...");
    bot.connect();
});

function messageCallback(error, response) {
    if (error) {
        console.log("Error sending message");
        console.log(error);
        console.log(response);
    }
}

function getChannelName(channelID) {
    try {
        return bot.channels[channelID].name;
    }
    catch (ex) {
        return "";
    }
}

function getServerNameForChannel(channelID) {
    try {
        return bot.servers[bot.channels[channelID].guild_id].name;
    }
    catch (ex) {
        return "";
    }
}

function getFullChannelName(channelID) {
    return getServerNameForChannel(channelID) + "/" + getChannelName(channelID);
}

function BuildEmbed(stream) {
    var last = new Date(stream.last_live);
    var multistreamers = [];
    stream.multistream.forEach((element, index) => {
        if (element.name != stream.name) {
            multistreamers.push(element.name + (element.online ? " **(online)**" : " *(offline)*") + (element.adult ? " :underage:" : ""));
        }
    });
    var fields = [
        {
            name: "Status",
            value: stream.online ? "Online" : "Offline",
            inline: true
        },
        {
            name: "Category",
            value: stream.category,
            inline: true
        }
    ];
    if (stream.multistream.length > 0) {
        fields.push({
            name: "Multistream",
            value: multistreamers.join("\n")
        });
    }
    return {
        title: stream.name,
        url: `http://picarto.tv/${stream.name}`,
        description: stream.title + "\t" + (stream.gaming ? " :video_game:" : "") + (stream.adult ? " :underage:" : "") + (stream.commissions ? " :paintbrush:" : "") + (stream.private ? " :lock:" : ""),
        fields: fields,
        thumbnail: { url: stream.avatar },
        image: stream.online ? { url: `${stream.thumbnails.web}?${Date.now()}` } : null,
        footer: !stream.online && last.valueOf() != 0 ? { text: `Last online on ${last.toDateString()}` } : null
    };
}

// Database connection
var db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DBHOSTNAME || auth.dbHost,
    port: process.env.DBPORT || auth.dbPort,
    user: process.env.DBUSER || auth.dbUser,
    password: process.env.DBPASSWORD || auth.dbPassword,
    database: process.env.DBNAME || auth.dbName,
})

function GetTrackedStreams(callback) {
    db.query("select stream_name, discord_channel from stream_tracking", callback);
}

function GetTrackedStreamsByChannel(channelID, callback) {
    db.query(`select stream_name from stream_tracking where discord_channel="${channelID}"`, callback);
}

function TrackStream(streamName, channelID, callback) {
    db.query(`insert into stream_tracking (stream_name, discord_channel) values ("${streamName}", "${channelID}")`, callback);
}

function UntrackStream(streamName, channelID) {
    db.query(`delete from stream_tracking where stream_name="${streamName}" and discord_channel="${channelID}"`);
}

function GetOptions(callback) {
    db.query(`select discord_channel, json from options;`, callback);
}

function SaveOptions(channelID) {
    var optionStr = JSON.stringify(options[channelID]);
    db.query(`insert into options (discord_channel, json) values ("${channelID}", ?) on duplicate key update json=?;`, [optionStr, optionStr])
}

// Stream tracking
function AddToStreamTracker(streamName, channelID) {
    var name = streamName.toLowerCase();
    if (!streamTracker[name])
        streamTracker[name] = { channels: [], online: false, last: {} };
    if (streamTracker[name].channels.indexOf(channelID) == -1) {
        streamTracker[name].channels.push(channelID);
        streamTracker[name].last[channelID] = 0;
    }
}

function RemoveFromStreamTracker(streamName, channelID) {
    var name = streamName.toLowerCase();
    if (streamTracker[name]) {
        var index = streamTracker[name].channels.indexOf(channelID);
        if (index > -1)
            streamTracker[name].channels.splice(index, 1);
        if (Object.keys(streamTracker[name].channels).length == 0)
            delete streamTracker[name];
    }
}

function PollTrackedStreams() {
    Object.keys(streamTracker).forEach((streamName, index) => {
        var name = streamName.toLowerCase();
        Picarto.GetStreamInfo(streamName, (stream) => {
            if (!stream) {
                //streamTracker[name].online = false;
            }
            else {
                if (!streamTracker[name].online && stream.online) {
                    console.log(`${stream.name} has gone online`);

                    streamTracker[name].channels.forEach((channelID, index) => {
                        var last = streamTracker[name].last[channelID];
                        var limit = options[channelID] ? options[channelID]["notify-limit"] : 0;

                        if ((!limit || Date.now() - last >= limit) && (!stream.private || options[channelID]["notify-private"] === true)) {
                            bot.sendMessage({
                                to: channelID,
                                message: `<:mimiright:372499377773871115> ${stream.name} is now online!`,
                                embed: BuildEmbed(stream)
                            }, messageCallback);
                            streamTracker[name].last[channelID] = Date.now();
                        }
                        else {
                            console.log(`Notification to channel ${getFullChannelName(channelID)} squelched`);
                        }
                    });
                }
                streamTracker[name].online = stream.online;
            }
        });
    });
    setTimeout(PollTrackedStreams, 5000);
}

// Bot control
function SetOption(channelID, key, value, callback) {
    switch (key) {
        case "notify-limit":
            if (!value) return callback("Specify a time (eg 30s, 15m, 1h)");
            var match = value.toLowerCase().match(/^(\d+)([hms]{0,1})$/);
            if (!match) return callback("Invalid time specified");
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
            if (!options[channelID]) options[channelID] = {};
            options[channelID][key] = duration;
            SaveOptions(channelID);
            break;
        case "notify-private":
            if (value.toLowerCase() === "on") options[channelID][key] = true;
            else if (value.toLowerCase() === "off") options[channelID][key] = false;
            else return callback("Specify on/off");
            break;
        default:
            return callback("Unrecognized option");
    }
    callback();
}

// Loadup
function LoadOptions() {
    GetOptions((error, results, fields) => {
        if (results) {
            results.forEach((row, index) => {
                options[row.discord_channel] = JSON.parse(row.json.toString());
            });
            console.log("Loaded options");
            LoadTrackedStreams();
        }
    });
}

function LoadTrackedStreams() {
    GetTrackedStreams((error, results, fields) => {
        if (results) {
            results.forEach((row, index) => {
                AddToStreamTracker(row.stream_name, row.discord_channel);
            });
            console.log("Loaded tracked streams");
            PollTrackedStreams();
        }
    });
}

LoadOptions();