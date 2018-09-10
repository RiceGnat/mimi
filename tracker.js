const picarto = require("./picarto");
const db = require("./mimi-db");
require("dotenv").load();

class StreamTracker {
    constructor(options) {
        this.options = Object.assign({
            interval: 100,
            pollTime: 5000,
            batchSize: 1
        }, options);
        
        console.log("Tracker options set:");
        console.log(`  Request interval: ${this.options.interval}ms`);
        console.log(`  Minimum polling loop time: ${this.options.pollTime}ms`);
        console.log(`  Request batch size: ${this.options.batchSize}`);

        const tracker = {};
        var defaultHandler;

        this.setDefaultHandler = handler => {
            if (typeof handler !== "function")
                throw "Handler must be a function";

            defaultHandler = handler;
        }
        
        this.track = (streamName, key, handler) => {
            /* Picarto stream names are case insensitive, but stream names are stored
             * in the database with caps intact based on how the user set it. MySQL
             * value comparison is case insensitive by default so everything should
             * be fine as long as we transform everything to lowercase. The in-memory
             * tracker object will use lowercase stream names.
             */
            const name = streamName.toLowerCase();
    
            // Check that the stream exists
            return picarto.getStreamInfo(name)
            // Save record in database
            .then(stream => 
                db.trackStream(stream.name, key)
                .then(() => {
                    // Add stream and/or subscription to tracker
                    this.subscribe(name, key, handler);
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

        this.subscribe = (streamName, key, handler) => {
            const name = streamName.toLowerCase();
    
            if (handler && typeof handler !== "function")
                throw "Handler must be a function";

            // Create entry in tracker if it doesn't exist yet
            if (!tracker[name])
            tracker[name] = {
                subs: {},
                online: false
            };

            // Register subscription to tracker
            tracker[name].subs[key] = {
                handler: handler,
                last: 0
            }
        }

        this.untrack = (streamName, key) => {
            /* In order to allow client removal of dead streams, we won't check
             * the stream name with Picarto before removing the entries.
             */
            const name = streamName.toLowerCase();
    
            // No need to check DB before removing from tracker
            if (tracker[name]) {
                // Delete subscription
                delete tracker[name].subs[key];
    
                // If no subs left, remove channel from tracker
                if (Object.keys(tracker[name].subs).length == 0)
                    delete tracker[name];
            }
    
            // Remove record from DB
            return db.untrackStream(name, key);
        }

        const check = (i) => {
            const names = Object.keys(tracker) ;
            const size = this.options.batchSize ? this.options.batchSize : Object.keys(tracker).length;
            const batch = names.slice(i, i + size);

            return Promise.all(batch.map(name =>
                // Check stream
                picarto.getStreamInfo(name)
                .then(stream => {
                    // Notify on positive latch
                    if (!tracker[name].online && stream.online) {
                        console.log(`${stream.name} has gone online`);
            
                        // Go through all tracker subscriptions for the stream
                        Object.keys(tracker[name].subs).forEach(key => {
                            // Call specific handler if it exists, else call default handler
                            const updateLast = tracker[name].subs[key].handler ?
                                tracker[name].subs[key].handler(stream, key, tracker[name].subs[key].last)
                                : defaultHandler(stream, key, tracker[name].subs[key].last);
                            
                            // If the handler returns true, update last
                            if (updateLast)
                                tracker[name].subs[key].last = Date.now();
                        });
                    }
                    tracker[name].online = stream.online;
                }, error => {
                    console.log(`Stream request for ${name} failed: ${error}`);
                    if (error === 404) {
                        delete tracker[name];
                        i--;
                        console.log(`Removed ${name} from the tracker`);
                    }
                })
            ))
            .then(() => {
                // Wait for the interval and check next stream
                if (i < names.length - size)
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve(check(i + size));
                        }, this.options.interval);
                    });
            });
        }
        
        var timer = null;

        const poll = () => {
            const tic = Date.now();
            check(0)
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