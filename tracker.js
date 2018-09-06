const picarto = require("./picarto");
const db = require("./mimi-db");

class StreamTracker {
    constructor(options) {
        this.options = Object.assign({
            interval: 1000
        }, options);
        const tracker = {};
        
        this.track = (streamName, key, handler) => {
            /* Picarto stream names are case insensitive, but stream names are stored
             * in the database with caps intact based on how the user set it. MySQL
             * value comparison is case insensitive by default so everything should
             * be fine as long as we transform everything to lowercase. The in-memory
             * tracker object will use lowercase stream names.
             */
            const name = streamName.toLowerCase();
    
            if (typeof handler !== "function")
                throw "Handler must be a function";
    
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
    
            if (typeof handler !== "function")
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
            const names = Object.keys(tracker) 
            const name = names[i];

            // Check stream
            return picarto.getStreamInfo(name)
            .then(stream => {
                // Notify on positive latch
                if (!tracker[name].online && stream.online) {
                    console.log(`${stream.name} has gone online`);
        
                    // Go through all tracker subscriptions for the stream
                    Object.keys(tracker[name].subs).forEach(key => {
                        // Call handler
                        if (tracker[name].subs[key].handler(stream, key, tracker[name].subs[key].last))
                            // If the handler returns true, update last
                            tracker[name].subs[key].last = Date.now();
                    });
                }
                tracker[name].online = stream.online;
            }, error => {
                console.log(`Stream request for ${name} failed: ${error}`);
                delete tracker[name];
                i--;
                console.log(`Removed ${name} from the tracker`);
            })
            .then(() => {
                // Wait for the interval and check next stream
                if (i < names.length - 1)
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve(check(i + 1));
                        }, this.options.interval);
                    });
            });
        }
        
        var timer = null;

        const poll = () => {
            check(0)
            .then(() => {
                timer = setTimeout(() => {
                    poll();
                }, this.options.interval);
            });
        }


        this.start = () => {
            if (timer === null) {
                timer = 0;
                poll();
            }
        }
        
        this.stop = () => {
            if (timer !== null) {
                clearInterval(timer);
                timer = null;
            }
        }
    }
}

module.exports.new = (options) => {
    return new StreamTracker(options);
}