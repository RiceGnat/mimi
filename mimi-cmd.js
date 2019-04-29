const db = require("./mimi-db");
const format = require("./mimi-format");
const picarto = require("./picarto");

function setup(cmd) {

    cmd.add("stream",
        "<name>",
        "Look up a stream",
        "Streams",
        (context, name) => 
            picarto.getStreamInfo(name)
            .then(stream => ({
                embed: format.stream(stream)
            }), error => ({
                message: "<:mimiconfused:372499377807425566> Stream not found"
            })));

    cmd.add("track",
        "<name>",
        "Track a stream in this channel",
        "Streams",
        (context, name) => 
            context.tracker.track(name, context.sender.channelId)
            .then(stream => {
                console.log(`User ${context.sender.user} tracked ${stream.name} in channel ${format.channelName(context.sender.channelId, context.bot)}`);
                return `<:mimigreetings:372499377501241355> Now tracking ${stream.name}`
            }, error => {
                if (error.isDuplicate)
                    return `<:mimiscratch:372499377928798208> Already tracking ${error.stream.name} in this channel`;
                
                console.log("Error trying to track stream");
                console.log(error);
                return "<:mimiconfused:372499377807425566> Couldn't track stream";
            })
            .then(msg => ({
                message: msg
            })));
            
    cmd.add("untrack",
        "<name>",
        "Untrack a stream for this channel",
        "Streams",
        (context, name) => 
            context.tracker.untrack(name, context.sender.channelId)
            .then(results => {
                if (results.affectedRows > 0) {
                    console.log(`User ${context.sender.user} untracked ${stream.name} in channel ${format.channelName(context.sender.channelId, context.bot)}`);
                    return "<:mimisad:372499377752768522> Stream untracked";
                }
                else return "<:mimiwondering:372499377807425546> Stream isn't being tracked...";
            }, error =>
                `<:mimiconfused:372499377807425566> Something went wrong`
            )
            .then(msg => ({
                message: msg
            })));
            
    cmd.add("tracking",
        "",
        "Show a list of streams tracked in this channel",
        "Streams",
        (context) => 
            db.getTrackedStreamsByChannel(context.sender.channelId)
            .then(results => 
                Promise.all(results.map(row =>
                    picarto.getStreamInfo(row.stream_name)
                    .catch(error => row.stream_name)
                )).then(results => 
                    results.map(stream => 
                        stream.name ?
                        `${stream.name} ${stream.online ? `[**(online)**](https://picarto.tv/${stream.name})` : "*(offline)*"}`
                        : stream
                    ).sort().join("\n")
                ).then(msg => ({
                    embed: { description: msg }
                }))
            ));

    cmd.add("set",
        "<option> <value>",
        "Set options (per channel)",
        "Control",
        (context, key, value) =>
            new Promise((resolve, reject) => {
                const options = context.options;
                const channelId = context.sender.channelId;

                if (!options[channelId]) options[channelId] = {};
                try {
                    if (!cmd.list["set"].subcommands[key]) throw "Unrecognized option";
                    options[channelId][key] = cmd.list["set"].subcommands[key].handler(context, value);
                }
                catch (ex) {
                    return reject(ex);
                }

                resolve(db.saveOptions(channelId, options[channelId]));
            })
            .then(() => {
                console.log(`User ${context.sender.user} set option ${key} to ${value} in channel ${format.channelName(context.sender.channelId, context.bot)}`);
                return "<:mimivictory:372499377639522325> Option saved";
            }, error => `<:mimiscratch:372499377928798208> ${error}`)
            .then(msg => ({
                message: msg
            })));

    cmd.addsub("notify-limit",
        "<time>[s|m|h]",
        "Limit repeat notifications",
        "set",
        (context, value) => {
                if (!value) throw "Specify a time (eg 30s, 15m, 1h)";
                let match = value.toLowerCase().match(/^(\d+)([hms]{0,1})$/);
                if (!match) throw "Invalid time specified";
                let duration = match[1];
                let unit = match[2];
                if (!unit) unit = "s";
                switch (unit) {
                    case "h":
                        duration *= 60;
                    case "m":
                        duration *= 60;
                    case "s":
                        duration *= 1000;
                }
                return duration;
        });

    cmd.addsub("notify-private",
        "on|off",
        "Private stream notifications",
        "set",
        (context, value) => {
                if (value.toLowerCase() === "on") return true;
                else if (value.toLowerCase() === "off") return false;
                else throw "Specify on/off";
        });

    cmd.addsub("notify-nsfw-preview",
        "on|off",
        "NSFW stream notification previews",
        "set",
        (context, value) => {
                if (value.toLowerCase() === "on") return true;
                else if (value.toLowerCase() === "off") return false;
                else throw "Specify on/off";
        });

    cmd.add("mimi",
        "<emote>",
        "Mimi emotes from Picarto chat",
        "Emotes",
        (context, name) => 
            picarto.getEmote(name)
            .then(data => {
                context.bot.uploadFile({
                    file: data,
                    filename: `${name}.png`
                });
            }));

    cmd.help({
        title: `<:mimigreetings:372499377501241355> Mimi v${require("./package.json").version}`,
        description: "Picarto bot for stream tracking. For more information, see [GitHub](https://github.com/RiceGnat/mimi/).",
        footer: { text: `Developed by RiceGnat#9420` }
    });
}

module.exports = {
    setup: setup
};