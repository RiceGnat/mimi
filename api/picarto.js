const request = require("request");
const host = "https://api.picarto.tv/v1";

function GetStreamInfo(name) {
    return new Promise((resolve, reject) => {
        request.get({
            url: `${host}/channel/name/${name}`,
            json: true
        }, (err, resp, body) => {
            if (err || resp.statusCode !== 200) return reject(err ? err : resp.statusCode);
            resolve(body);
        });
    });
}

function GetEmote(name) {
    return new Promise((resolve, reject) => {
        request.get({
            url: `https://picarto.tv/images/chat/emoticons/${name}.png`,
            encoding: null
        },(err, resp, body) => {
            if (err || resp.statusCode !== 200) return reject(err ? err : resp.statusCode);
            resolve(body);
        });
    });
}

function GetOnline() {
    return new Promise((resolve, reject) => {
        request.get({
            url: `${host}/online?adult=true&gaming=true`,
            json: true
        },(err, resp, body) => {
            if (err || resp.statusCode !== 200) return reject(err ? err : resp.statusCode);
            resolve(body);
        });
    })
}

function BuildEmbed(stream, hideThumb) {
    let last = new Date(stream.last_live);
    let multistreamers = [];
    stream.multistream.forEach((element, index) => {
        if (element.name != stream.name) {
            multistreamers.push(element.name + (element.online ? " **(online)**" : " *(offline)*") + (element.adult ? " :underage:" : ""));
        }
    });
    let fields = [
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

module.exports = {
    getStreamInfo: GetStreamInfo,
    getEmote: GetEmote,
    getOnline: GetOnline,
    embed: BuildEmbed,
    props: stream => stream
};