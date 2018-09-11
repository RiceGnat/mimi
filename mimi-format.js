function BuildEmbed(stream, hideThumb) {
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
        image: stream.online && !hideThumb ? { url: `${stream.thumbnails.web}?${Date.now()}` } : null,
        footer: !stream.online && last.valueOf() != 0 ? { text: `Last online on ${last.toDateString()}` } : null
    };
}

function getFullChannelName(channelId, bot) {
    try {
        return `${bot.servers[bot.channels[channelId].guild_id].name}/${bot.channels[channelId].name}`;
    }
    catch (ex) {
        return channelId;
    }
}

module.exports = {
    stream: BuildEmbed,
    channelName: getFullChannelName
}