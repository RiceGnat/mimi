// Picarto API calls

const http = require("https");
const endpoint = "https://api.picarto.tv/v1/";

function GetStreamInfo(name, callback) {
    var req = http.get(`${endpoint}channel/name/${name}`, (res) => {
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
            console.log(`Stream request for ${name} failed`);
            callback(null);
        }
    });
    req.end();
}

function GetEmote(name, callback) {
    var req = http.get(`https://picarto.tv/images/chat/emoticons/${name}.png`, (res) => {
        if (res.statusCode == 200) {
            var data = [];
            res.on("data", (chunk) => {
                data.push(chunk);
            }).on("end", () => {
                bot.uploadFile({
                    to: channelID,
                    file: Buffer.concat(data),
                    filename: `${name}.png`
                }, callback);
            });
        }
    });
    req.end();
}

module.exports.GetStreamInfo = GetStreamInfo;
module.exports.GetEmote = GetEmote;