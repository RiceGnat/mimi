const request = require("request");

const headers = {
    "Accept": "application/vnd.sketch-v1+json",
    "Accept-Language": "en-US,en;q=0.5",
}

function GetStreamInfo(name) {
    return new Promise((resolve, reject) => {
        // Find user first
        request.get({
            url: `https://sketch.pixiv.net/api/users/@${name}.json`,
            headers: {
                ...headers,
                "X-Requested-With": `https://sketch.pixiv.net/@${name}`,
                "Referer": `https://sketch.pixiv.net/@${name}`
            },
            json: true
        }, (err, resp, body) => {
            if (err || resp.statusCode !== 200 || !body.data.id) return reject(err ? err : resp.statusCode);
            resolve(body.data);
        });
    })
    .then(user => {
        return new Promise((resolve, reject) => {
            // Then try to find a stream
            request.get({
                url: `https://sketch.pixiv.net/api/lives/users/@${name}.json`,
                headers: {
                    ...headers,
                    "X-Requested-With": `https://sketch.pixiv.net/@${name}`,
                    "Referer": `https://sketch.pixiv.net/@${name}`
                },
                json: true
            }, (err, resp, body) => {
                if (err || resp.statusCode !== 200 || !body.data.id) return resolve({ user });
                resolve(body.data);
            });
        })
    });
}

function GetOnline() {
    return new Promise((resolve, reject) => {
        request.get({
            url: `https://sketch.pixiv.net/api/lives.json`,
            headers: {
                ...headers,
                "X-Requested-With": "https://sketch.pixiv.net/lives",
                "Referer": "https://sketch.pixiv.net/lives"
            },
            json: true
        },(err, resp, body) => {
            if (err || resp.statusCode !== 200) return reject(err ? err : resp.statusCode);
            resolve(body.data.lives.map(stream => ({ name: stream.user.unique_name })));
        });
    });
}

function BuildEmbed(stream, hideThumb) {
    // let multistreamers = [];
    // stream.multistream.forEach((element, index) => {
    //     if (element.name != stream.name) {
    //         multistreamers.push(element.name + (element.online ? " **(online)**" : " *(offline)*") + (element.adult ? " :underage:" : ""));
    //     }
    // });
    let fields = [
        {
            name: "Status",
            value: stream.is_broadcasting ? "Online" : "Offline",
            inline: true
        }
    ];
    // if (stream.multistream.length > 0) {
    //     fields.push({
    //         name: "Multistream",
    //         value: multistreamers.join("\n")
    //     });
    // }
    return {
        title: stream.user.name,
        url: stream.id ? GetStreamUrl(stream) : `https://sketch.pixiv.net/@${stream.user.unique_name}`,
        description: stream.description ? `**${stream.name}**\n\n${stream.description}` : undefined,
        fields: fields,
        thumbnail: { url: stream.user.icon.photo.original.url },
        image: stream.is_broadcasting && !hideThumb ? { url: `${stream.thumbnail.w1280.url}?${Date.now()}` } : null,
    };
}

function MessageParams(stream) {
    return {
        name: stream.user.name,
        adult: stream.is_r18,
        online: stream.is_broadcasting,
        url: GetStreamUrl(stream)
    }
}

function GetStreamUrl(stream) {
    return `https://sketch.pixiv.net/@${stream.user.unique_name}/lives/${stream.id}`;
}

module.exports = {
    getStreamInfo: GetStreamInfo,
    getOnline: GetOnline,
    embed: BuildEmbed,
    props: MessageParams,
    url: GetStreamUrl
};