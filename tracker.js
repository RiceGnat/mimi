const picarto = require("./api/picarto");
const pixiv = require("./api/pixiv");
const db = require("./mimi-db");
require("dotenv").load();

class StreamTracker {
    constructor(options) {
        this.options = Object.assign({
            interval: 100,
            pollTime: 5000,
        }, options);

        console.log("Tracker options set:");
        console.log(`  Request interval: ${this.options.interval}ms`);
        console.log(`  Minimum polling loop time: ${this.options.pollTime}ms`);

        const tracker = {
            picarto: {
                api: picarto,
                tracked: {}
            },
            pixiv: {
                api: pixiv,
                tracked: {}
            }
        };

        let defaultHandler;

        this.setDefaultHandler = handler => {
            if (typeof handler !== "function")
                throw "Handler must be a function";

            defaultHandler = handler;
        }

        this.track = (streamName, source, key, handler) => {
            /* Picarto stream names are case insensitive, but stream names are stored
             * in the database with caps intact based on how the user set it. MySQL
             * value comparison is case insensitive by default so everything should
             * be fine as long as we transform everything to lowercase. The in-memory
             * tracker object will use lowercase stream names.
             */
            const name = streamName.toLowerCase();

            // Check that the stream exists
            return tracker[source].api.getStreamInfo(name)
                // Save record in database
                .then(stream =>
                    db.trackStream(name, source, key)
                        .then(() => {
                            // Add stream and/or subscription to tracker
                            this.subscribe(name, source, key, handler);
                            return stream;
                        },
                            error => {
                                throw {
                                    isDuplicate: error.code == "ER_DUP_ENTRY",
                                    stream: stream
                                }
                            })
                )
        }

        this.subscribe = (streamName, source, key, handler) => {
            const name = streamName.toLowerCase();

            if (handler && typeof handler !== "function")
                throw "Handler must be a function";

            // Create entry in tracker if it doesn't exist yet
            if (!tracker[source].tracked[name])
                tracker[source].tracked[name] = {
                    subs: {},
                    online: false
                };

            // Register subscription to tracker
            tracker[source].tracked[name].subs[key] = {
                handler: handler,
                last: 0
            }
        }

        this.untrack = (streamName, source, key) => {
            /* In order to allow client removal of dead streams, we won't check
             * the stream name with Picarto before removing the entries.
             */
            const name = streamName.toLowerCase();

            // No need to check DB before removing from tracker
            if (tracker[source].tracked[name]) {
                // Delete subscription
                delete tracker[source].tracked[name].subs[key];

                // If no subs left, remove channel from tracker
                if (Object.keys(tracker[source].tracked[name].subs).length == 0)
                    delete tracker[source].tracked[name];
            }

            // Remove record from DB
            return db.untrackStream(name, source, key);
        }

        const fetch = () => {
            return Promise.all(
                Object.keys(tracker).map(source => tracker[source].api.getOnline()
                    .then(online => {
                        // Remap array to lookup
                        const lookup = {};
                        online.forEach(stream => lookup[stream.name.toLowerCase()] = stream);
                        return lookup;
                    }, () => ({}))
                    .then(online => Object.keys(tracker[source].tracked).forEach(name => {
                        const tracked = tracker[source].tracked[name];
                        const stream = online[name];

                        // Notify on positive latch
                        if (!tracked.online && stream) {
                            console.log(`${stream.name} has gone online`);

                            // Get full stream info
                            tracker[source].api.getStreamInfo(name)
                                .then(stream =>
                                    // Go through all tracker subscriptions for the stream
                                    Object.keys(tracked.subs).forEach(key => {
                                        // Extract basic properties for message
                                        const props = {
                                            ...tracker[source].api.props(stream),
                                            source,
                                            channelId: key,
                                            last: tracked.subs[key].last
                                        };

                                        // Call specific handler if it exists, else call default handler
                                        const updateLast = tracked.subs[key].handler ?
                                            tracked.subs[key].handler(stream, props)
                                            : defaultHandler(stream, props);

                                        // If the handler returns true, update last timestamp
                                        if (updateLast)
                                            tracked.subs[key].last = Date.now();
                                    })
                                );
                        }

                        // Record current online status
                        tracked.online = online[name] !== undefined;
                    }))
                )
            );
        }

        let timer = null;

        const poll = () => {
            const tic = Date.now();
            fetch()
                .then(() => {
                    const toc = Date.now();
                    const wait = Math.max(this.options.pollTime - (toc - tic), this.options.interval);
                    if (process.env.NODE_ENV === "dev")
                        console.log(`Polling loop completed in ${(toc - tic) / 1000}s; waiting for ${wait / 1000}s`);
                    timer = setTimeout(() => {
                        poll();
                    }, Math.max(this.options.pollTime - (toc - tic), this.options.interval));
                });
        }


        this.start = () => {
            if (timer === null) {
                console.log("Stream tracker started");
                timer = 0;
                poll();
            }
        }

        this.stop = () => {
            if (timer !== null) {
                console.log("Stream tracker stopped");
                clearInterval(timer);
                timer = null;
            }
        }
    }
}

module.exports.new = (options) => {
    return new StreamTracker(options);
}