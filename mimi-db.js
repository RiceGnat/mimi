const mysql = require("mysql");

require("dotenv").load();
const db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DBHOSTNAME,
    port: process.env.DBPORT,
    user: process.env.DBUSER,
    password: process.env.DBPASSWORD,
    database: process.env.DBNAME,
});

function queryPromise(query, args) {
    return new Promise((resolve, reject) => {
        db.query(query, args, function (error, results, fields) {
            if (error) reject(error);
            resolve(results, fields);
          });
    });
}

function GetTrackedStreams() {
    return queryPromise("select stream_name, discord_channel from stream_tracking");
}

function GetTrackedStreamsByChannel(channelID) {
    return queryPromise(`select stream_name from stream_tracking where discord_channel="${channelID}"`);
}

function TrackStream(streamName, channelID) {
    return queryPromise(`insert into stream_tracking (stream_name, discord_channel) values ("${streamName}", "${channelID}")`);
}

function UntrackStream(streamName, channelID) {
    return queryPromise(`delete from stream_tracking where stream_name="${streamName}" and discord_channel="${channelID}"`);
}

function GetOptions() {
    return queryPromise(`select discord_channel, json from options;`);
}

function SaveOptions(channelID, options) {
    const optionStr = JSON.stringify(options);
    return queryPromise(`insert into options (discord_channel, json) values ("${channelID}", ?) on duplicate key update json=?;`, [optionStr, optionStr]);
}

module.exports = {
    getTrackedStreams: GetTrackedStreams,
    getTrackedStreamsByChannel: GetTrackedStreamsByChannel,
    trackStream: TrackStream,
    untrackStream: UntrackStream,
    getOptions: GetOptions,
    saveOptions: SaveOptions
}