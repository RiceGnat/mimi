var Discord = require("discord.io");
var http = require("https");
var mysql = require("mysql");
var auth = process.env.BOT_TOKEN ? null : require("./auth.json");

// Bot setup
var bot = new Discord.Client({
    token: process.env.BOT_TOKEN || auth.token,
    autorun: true
});

bot.on("ready", function (evt) {
    console.log("Connected");
    console.log("Logged in as: ");
    console.log(bot.username + " - (" + bot.id + ")");
});

bot.on("message", function (user, userID, channelID, message, evt) {
    if (message.substring(0, 1) == "!") {
        var args = message.substring(1).split(" ");
        var cmd = args[0];

        args = args.splice(1);
        switch (cmd) {
            case "stream":
                GetStreamInfo(args[0], (stream) => {
                    bot.sendMessage({
                        to: channelID,
                        message: !stream ? "<:mimiconfused:372499377807425566> Stream not found" : null,
                        embed: stream ? BuildEmbed(stream) : null
                    });
                });
                break;
            case "track":
                GetStreamInfo(args[0], (stream) => {
                    if (stream) {
                        TrackStream(args[0], channelID, (error) => {
                            var message;
                            if (error && error.code == "ER_DUP_ENTRY") {
                                message = `<:mimiscratch:372499377928798208> Already tracking ${stream.name} in this channel`;
                            }
                            else if (error) {
                                console.log(error);
                                message = "<:mimiconfused:372499377807425566> Couldn't track stream";
                            }
                            else {
                                AddToStreamTracker(stream.name, channelID);
                                message = `<:mimigreetings:372499377501241355> Now tracking ${stream.name}`;
                            }
                            bot.sendMessage({
                                to: channelID,
                                message: message
                            })
                        });
                    }
                    else {
                        bot.sendMessage({
                            to: channelID,
                            message: "<:mimiconfused:372499377807425566> Stream not found",
                        });
                    }
                });
                break;
            case "untrack":
                UntrackStream(args[0], channelID);
                RemoveFromStreamTracker(args[0], channelID);
                bot.sendMessage({
                    to: channelID,
                    message: "<:mimisad:372499377752768522> Stream untracked",
                });
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
                                    });
                                }
                            }
                        }
                        results.forEach((row, index) => {
                            GetStreamInfo(row.stream_name, buildOut());
                        });
                    }
                });
                break;
            case "mimi":
                var req = http.get(`https://picarto.tv/images/chat/emoticons/${args[0]}.png`, (res) => {
                    if (res.statusCode == 200) {
                        var data = [];
                        res.on("data", (chunk) => {
                            data.push(chunk);
                        }).on("end", () => {
                            bot.uploadFile({
                                to: channelID,
                                file: Buffer.concat(data),
                                filename: `${args[0]}.png`
                            });
                        });
                    }
                });
                req.end();
                break;
        }
    }
});

bot.on("disconnect", function (errMsg, code) {
    console.log(`Mimi disconnected (${code}: ${errMsg})`);
    console.log("Reconnecting...");
    bot.connect();
});

// Picarto API calls
function GetStreamInfo(name, callback) {
    var req = http.get(`https://api.picarto.tv/v1/channel/name/${name}`, (res) => {
        if (res.statusCode == 200) {
            var data = "";
            res.on("data", (chunk) => {
                data += chunk;
            }).on("end", () => {
                var stream = JSON.parse(data);
                callback(stream);
            });
        }
        else {
            console.log(`Stream request for ${name} failed.`);
            callback(null);
        }
    });
    req.end();
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
        thumbnail: { url: `https://picarto.tv/user_data/usrimg/${stream.name.toLowerCase()}/dsdefault.jpg` },
        image: stream.online ? { url: `https://thumb-us1.picarto.tv/thumbnail/${stream.name}.jpg` } : null,
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

// Stream tracking
var streamTracker = {};

function AddToStreamTracker(streamName, channelID) {
    if (!streamTracker[streamName])
        streamTracker[streamName] = { channels: [], online: false };
    if (streamTracker[streamName].channels.indexOf(channelID) == -1)
        streamTracker[streamName].channels.push(channelID);
}

function RemoveFromStreamTracker(streamName, channelID) {
    if (streamTracker[streamName]) {
        delete streamTracker[streamName].channels[channelID];
        if (Object.keys(streamTracker[streamName].channels).length == 0)
            delete streamTracker[streamName];
    }
}

function LoadTrackedStreams() {
    GetTrackedStreams((error, results, fields) => {
        if (results) {
            results.forEach((row, index) => {
                AddToStreamTracker(row.stream_name, row.discord_channel);
            });
        }
    });
}

function PollTrackedStreams() {
    Object.keys(streamTracker).forEach((streamName, index) => {
        GetStreamInfo(streamName, (stream) => {
            if (!stream) {
                streamTracker[streamName].online = false;
            }
            else {
                if (!streamTracker[streamName].online && stream.online) {
                    streamTracker[streamName].channels.forEach((channelID, index) => {
                        bot.sendMessage({
                            to: channelID,
                            message: `<:mimiright:372499377773871115> ${stream.name} is now online!`,
                            embed: BuildEmbed(stream)
                        });
                    });
                }
                streamTracker[streamName].online = stream.online;
            }
        });
    });
    setTimeout(PollTrackedStreams, 10000);
}

LoadTrackedStreams();
PollTrackedStreams();