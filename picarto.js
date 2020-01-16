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

module.exports = {
    getStreamInfo: GetStreamInfo,
    getEmote: GetEmote,
    getOnline: GetOnline
};