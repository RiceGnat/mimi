const handlers = {};

function ParseCommand(str, user, userId, channelId) {
    // Separate command word and args
    var args = str.split(" ");
    var cmd = args[0];
    args = args.slice(1);

    var sender = {
        user: user,
        userId: userId,
        channelId: channelId
    }

    if (typeof handlers[cmd] === "function") {
        switch (cmd) {
            case "stream":
            case "track":
            case "untrack":
            case "mimi":
                handlers[cmd](args[0], sender);
                break;
            case "set":
                handlers[cmd](args[0], args[1], sender)
                break;
            default:
                handlers[cmd](sender);
        }
    }
}

function SetHandler(command, handler) {
    if (typeof handler !== "function")
        throw "Handler must be a function";
    handlers[command] = handler;
    return this;
}

module.exports = {
    parse: ParseCommand,
    on: SetHandler
}