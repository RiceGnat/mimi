const db = require("./mimi-db");
const format = require("./mimi-format");
const picarto = require("./picarto");
const commands = {};

function ParseCommand(str, sender) {
    // Separate command word and args
    var args = str.split(" ");
    var cmd = args[0];
    args = args.slice(1);

    return Promise.resolve(commands[cmd].handler(sender, ...args));
}

function cmd(name, format, desc, category, handler, sub) {
    if (typeof handler !== "function")
        throw "Handler must be a function";

    const command = {
        name: name,
        format: format,
        description: desc,
        handler: handler,
        subcommands: []
    };

    if (sub) {
        commands[category].subcommands[name] = command;
    }
    else {
        command.category = category;
        commands[name] = command;
    }
}

function subcmd(name, format, desc, parent, handler) {
    cmd(name, format, desc, parent, handler, true);
}

function cmdHelp(command, parent) {
    var format = [];
    if (parent) format.push(parent);
    format.push(command.name);
    if (command.format) format.push(command.format);
    return `\`${parent ? "\t" : ""}!${format.join(" ")}\`\t${command.description}`;
}

cmd("stream",
    "<name>",
    "Look up a stream",
    "Streams",
    (sender, name) => 
        picarto.getStreamInfo(name)
        .then(stream => ({
            embed: format.stream(stream)
        }), error => ({
            message: "<:mimiconfused:372499377807425566> Stream not found"
        }))
        .then(msg => Object.assign({
            to: sender.channelId
        }, msg)));

cmd("track",
    "<name>",
    "Track a stream in this channel",
    "Streams",
    (sender, name) => 
        sender.tracker.track(name, sender.channelId)
        .then(stream => {
            console.log(`User ${sender.user} tracked ${stream.name} in channel ${format.channelName(sender.channelId, sender.bot)}`);
            return `<:mimigreetings:372499377501241355> Now tracking ${stream.name}`
        }, error => {
            if (error.isDuplicate)
                return `<:mimiscratch:372499377928798208> Already tracking ${error.stream.name} in this channel`;
            
            console.log("Error trying to track stream");
            console.log(error);
            return "<:mimiconfused:372499377807425566> Couldn't track stream";
        })
        .then(msg => ({
            to: sender.channelId,
            message: msg
        })));
        
cmd("untrack",
    "<name>",
    "Untrack a stream for this channel",
    "Streams",
    (sender, name) => 
        sender.tracker.untrack(name, sender.channelId)
        .then(results => 
            results.affectedRows > 0 ?
            "<:mimisad:372499377752768522> Stream untracked"
            : "<:mimiwondering:372499377807425546> Stream isn't being tracked..."
        , error =>
            `<:mimiconfused:372499377807425566> Something went wrong`
        )
        .then(msg => ({
            to: sender.channelId,
            message: msg
        })));
        
cmd("tracking",
    "",
    "Show a list of streams tracked in this channel",
    "Streams",
    (sender) => 
        db.getTrackedStreamsByChannel(sender.channelId)
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
                to: sender.channelId,
                embed: { description: msg }
            }))
        ));

cmd("set",
    "<option> <value>",
    "Set options (per channel)",
    "Control",
    (sender, key, value) =>
        new Promise((resolve, reject) => {
            const options = sender.options;
            const channelId = sender.channelId;

            if (!options[channelId]) options[channelId] = {};
            try {
                if (!commands["set"].subcommands[key]) throw "Unrecognized option";
                options[channelId][key] = commands["set"].subcommands[key].handler(sender, value);
            }
            catch (ex) {
                return reject(ex);
            }

            resolve(db.saveOptions(channelId, options[channelId]));
        })
        .then(() => {
            console.log(`User ${sender.user} set option ${key} to ${value} in channel ${format.channelName(sender.channelId, sender.bot)}`);
            return "<:mimivictory:372499377639522325> Option saved";
        }, error => `<:mimiscratch:372499377928798208> ${error}`)
        .then(msg => ({
            to: sender.channelId,
            message: msg
        })));

subcmd("notify-limit",
       "<time>[s|m|h]",
       "Limit repeat notifications",
       "set",
       (sender, value) => {
            if (!value) throw "Specify a time (eg 30s, 15m, 1h)";
            var match = value.toLowerCase().match(/^(\d+)([hms]{0,1})$/);
            if (!match) throw "Invalid time specified";
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
            return duration;
       });

subcmd("notify-private",
       "on|off",
       "Private stream notifications",
       "set",
       (sender, value) => {
            if (value.toLowerCase() === "on") return true;
            else if (value.toLowerCase() === "off") return false;
            else throw "Specify on/off";
       });

cmd("mimi",
    "<emote>",
    "Mimi emotes from Picarto chat",
    "Emotes",
    (sender, name) => 
        picarto.getEmote(name)
        .then(data => {
            sender.bot.uploadFile({
                to: sender.channelId,
                file: data,
                filename: `${name}.png`
            });
        }));

cmd("help",
    "[<command>]",
    "Get usage and bot info",
    "Help",
    (sender, name) => {
        if (!name) {
            var fields = {};
            Object.values(commands).forEach(command => {
                if (!fields[command.category]) fields[command.category] = [];

                fields[command.category].push(cmdHelp(command));
                const subcommands = Object.values(command.subcommands);
                if (subcommands.length > 0) {
                    subcommands.forEach(subcommand => {
                        fields[command.category].push(`${cmdHelp(subcommand, command.name)}`);
                    })
                }
            });
            return {
                to: sender.channelId,
                embed: {
                    title: "<:mimigreetings:372499377501241355> Mimi",
                    description: "Picarto bot for stream tracking. For more information, see [GitHub](https://github.com/RiceGnat/mimi/).",
                    fields: Object.entries(fields).map(([key, value]) => ({
                        name: key,
                        value: value.join("\n")
                    })),
                    footer: { text: `Developed by RiceGnat#9420` }
                }
            }
        }
        else return { 
                to: sender.channelId,
                message: cmdHelp(commands[name])
            };
    });

console.log("Commands registered");

module.exports = {
    parse: ParseCommand
}