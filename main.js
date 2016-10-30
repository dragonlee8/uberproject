#!/usr/bin/env node
// Copyright (c) 2016 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var fs = require('fs');
var path = require('path');
var express = require('express');
var mongoose = require('mongoose');
var assert = require('assert');
var amqp = require('amqp');
var geohash = require('ngeohash');
var _ = require('underscore');
var http = require('http');
var tryIt = require('tryit');
var config = require('config');

require('./tripLoc.js')();
var TripLocModel = mongoose.model('TripLoc');


// Ringpop libraries
var program = require('commander');
var RingPop = require('ringpop');
var TChannel = require('tchannel');
var hammock = require('hammock');

'use strict';

var id = 0;
const GEOLEVEL = config.get('GeoHashLevel');

function main(args) {
    program
        .version(require('./package.json').version)

        .usage('[options]')

        .option('-l, --listen <listen>',
            'Host and port on which server listens (also node\'s identity in cluster)')

        .option('-h, --hosts <hosts>',
            'Seed file of list of hosts to join')

        .option('--suspect-period <suspectPeriod>',
            'The lifetime of a suspect member in ms. After that the member becomes faulty.',
            parseInt10, 5000)

        .option('--faulty-period <faultyPeriod>',
            'The lifetime of a faulty member in ms. After that the member becomes a tombstone.',
            parseInt10, 24*60*60*1000) // 24hours

        .option('--tombstone-period <tombstonePeriod>',
            'The lifetime of a tombstone member in ms. After that the member is removed from the membership.',
            parseInt10, 5000)

        .option('--stats-file <stats-file>',
            'Enable stats emitting to a file. Stats-file can be a relative or absolute path. '+
            'Note: this flag is mutually exclusive with --stats-udp and you need to manually install "uber-statsd-client" to be able to emit stats')

        .option('--stats-udp <stats-udp>',
            'Enable stats emitting over udp. Destination is in the host-port format (e.g. localhost:8125 or 127.0.0.1:8125) ' +
            'Note: this flag is mutually exclusive with --stats-file and you need to manually install "uber-statsd-client" to be able to emit stats',
            /^(.+):(\d+)$/)

            .parse(args);

            var listen = program.listen;
            if (!listen) {
                console.error('Error: listen arg is required');
                program.outputHelp();
                process.exit(1);
            }

    var stats = createStatsClient(program);

    var tchannel = new TChannel({
    });

    var ringpop = new RingPop({
        app: 'ringpop',
        hostPort: listen,
        logger: createLogger('ringpop'),
        channel: tchannel.makeSubChannel({
            serviceName: 'ringpop',
            trace: false
        }),
        isCrossPlatform: true,
        useLatestHash32: false,
        stateTimeouts: {
            suspect: program.suspectPeriod,
            faulty: program.faultyPeriod,
            tombstone: program.tombstonePeriod,
        },
        statsd: stats
    });

    ringpop.setupChannel();

    process.once('SIGTERM', signalHandler(false));
    process.once('SIGINT', signalHandler(true));

    function signalHandler(interactive) {
        return function() {
            if (interactive) {
                console.error('triggered graceful shutdown. Press Ctrl+C again to force exit.');
                process.on('SIGINT', function forceExit() {
                    console.error('Force exiting...');
                    process.exit(1);
                });
            }
            ringpop.selfEvict(function afterSelfEvict(err) {
                if (err) {
                    console.error('Failure during selfEvict: ' + err);
                    process.exit(1);
                    return;
                }
                process.exit(0);
            });
        };
    }

    var listenParts = listen.split(':');
    var port = Number(listenParts[1]);
    var host = listenParts[0];
    tchannel.listen(port, host, onListening);

    function onListening() {
        ringpop.bootstrap(program.hosts, bootstrapCallback(ringpop, port));
        ringpop.on('request', forwardedCallback());
    }
}

function connectMongo(i)
{
    var dbConfig = config.get('Cluster.dbConfig');
    mongoose.connect(dbConfig.hosts[i]);
    db = mongoose.connection;

}



// After successfully bootstrapping, create the HTTP server.
function bootstrapCallback(ringpop, i) {
    return function onBootstrap(err) {
        if (err) {
            console.log('Error: Could not bootstrap ' + ringpop.whoami());
            process.exit(1);
        }

        console.log('Ringpop ' + ringpop.whoami() + ' has bootstrapped!');

        connectMongo(i-3000);
        db.on('error', console.error.bind(console, 'connection error:'));
        db.once('open', function() {
            console.log("Connected successfully to server");
            // After MongoDB connection established
            createHttpServers(ringpop, i);
            createMQListener(ringpop, i);
        });
    };
}

// In this example, forwarded requests are immediately ended. Fill in with
// your own application logic.
function forwardedCallback() {
    return function onRequest(req, res) {
        if (req.url == 'tripUpdate')
        {
            updateTripInfo(JSON.parse(req._readableState.buffer.tail.data.toString()));
            res._events.close();
        }
        else
        {
            //console.log(req);
            let url = req.url;
            let tokens= url.split("/");

            findTrips({lat1:tokens[2], lng1: tokens[3], lat2:tokens[4], lng2: tokens[5]}, function (tripSet){
                res.end(Array.from(tripSet));
            });
        }
    }
}

function findTrips(payload, res)
{
    TripLocModel.findTrips(payload.lat1, payload.lng1, payload.lat2, payload.lng2, res);
}

function updateTripInfo(payload)
{
    var cb = function(err){
        if (err){
            console.log("Failed to insert Trip update, Error: " + err);
        }
    };

    TripLocModel.insert(payload, cb);
}


// These HTTP servers will act as the front-end
// for the Ringpop cluster.
function createHttpServers(ringpop, port) {
    var http = express();
    var httpPort = port * 2; // HTTP will need its own port

    console.log("create http");
    // Define a single HTTP endpoint that 'handles' or forwards
    http.get('/countTrips/:lat1/:lng1/:lat2/:lng2', function onReq(req, res) {
        var lat1 = req.params.lat1;
        var lng1 = req.params.lng1;
        var lat2 = req.params.lat2;
        var lng2 = req.params.lng2;

        //Get all hashstringes between [lat1, lng1] and [lat2, lng2]. 
        var getHashes = geohash.bboxes (lat2, lng2, lat1, lng1, precision=GEOLEVEL);

        // maintain a unique destination, 
        var destins = {};

        // Find unique sharding keys
        // Most of time, the search should fall into one geo block, which returns one key
        getHashes.forEach(function(geoHash){
            var shardKey = geoHash;
            var destination = ringpop.lookup(shardKey);
            destins[destination] = shardKey;
        });

        var tripSet = new Set();

        // We will send the same request to all node, since each node only stores trips info
        // in its own block, it will only return the trip set that within the block 
        // Finally, we will aggregate the uniuqe set

        // Since we are distributing this resquest to several nodes, we need to wait for all 
        // nodes response come back before returning to the client, here we keep a count
        var numResults = Object.keys(destins).length;

        for (destination in destins) {
            let callback = function(err, ret, arg2, arg3) {
                // aggregate the unique tripIDs here

                let retTrips = ret.body.toString();
                
                for (let tripid in retTrips)
                {
                    tripSet.add(tripid);
                
                }

                numResults--;
                if (numResults == 0 )
                {
                    res.send({retCode: 0, result: tripSet.size});
                }
            };
            let resp = allocResponse({}, callback);

            key = destins[destination];
            if (ringpop.handleOrProxy(key, req, resp)) {
                findTrips(req.params, function(tripSet){
                    for (let tripid of tripSet)
                    {
                        tripSet.add(tripid);
                    }

                    numResults --;
                    console.log(numResults);
                    if (numResults == 0 )
                    {
                        res.send({retCode: 0, result: tripSet.size});
                    }
                });
            } else {
                var destination = ringpop.lookup(key);
                console.log('Ringpop ' + ringpop.whoami() +
                    ' forwarded ' + key + " " + destination);
            }
        }
    });

    http.listen(httpPort, function onListen() {
        console.log('HTTP is listening on ' + httpPort);
    });

}

function allocRequest(opts) {
    var req = hammock.Request(opts);

    if ('json' in opts && opts.json !== true) {
        req.headers['content-type'] = 'application/json';
    }

    if ('json' in opts && opts.json !== true) {
        req.write(JSON.stringify(opts.json));
        req.end();
    } else {
        req.end();
    }

    return req;
}

function allocResponse(opts, cb) {
    return hammock.Response(onResponse);

    function onResponse(err, resp) {
        if (err) {
            return cb(err);
        }

        if ('json' in opts) {
            tryIt(function parse() {
                resp.body = JSON.parse(resp.body);
            });
        }

        cb(null, resp);
    }
}


// Create Rabbit MQ listener to record driver's location
function createMQListener(ringpop, port) {
    // Connect with Rabbit MQ on local machine
    var RMQconn = amqp.createConnection();

    console.log("create Rabbit MQ connection");

    // subscribe to queue to get driver's location
    RMQconn.on('ready', function() {
        console.log("RabbitMQ connection ready");
        var exchange = RMQconn.exchange('tripUpdate');
        RMQconn.queue('tripUpdate-queue', function(q) {
            console.log("queue ready");
            q.bind(exchange, '');
            q.subscribe(function (message, headers, deliveryInfo, messageObject) {
                var tripUpdate = JSON.parse(message.data.toString());

                var longitude = tripUpdate.lng;
                var latitude = tripUpdate.lat;

                var geoHashKey = geohash.encode(latitude, longitude, precision=GEOLEVEL)
                // I use the first two keys of the geohash as sharding key,
                // in theory we can have at max 36*36 machines distribute the work
                var shardKey = geoHashKey;

                var req = allocRequest({url: 'tripUpdate', json: tripUpdate});

                var callback = function(err, res, arg2, arg3) {
                    console.log('normal res:', {err: err, res: res, arg2: arg2, arg3: arg3 });
                };

                var resp = allocResponse({}, callback);

                if (ringpop.handleOrProxy(shardKey, req, resp)) {
                    updateTripInfo(tripUpdate);
                } else {
                    var destination = ringpop.lookup(shardKey);
                }

            });
        });
    });
}

function createStatsClient(program) {
    if (!program.statsUdp && !program.statsFile) {
        return null;
    }
    if (program.statsUdp && program.statsFile) {
        console.error("--stats-udp and --stats-file are mutually exclusive.");
        console.error("Please specify only one of the two options!");
        process.exit(1);
    }

    var opts = null;
    if (program.statsUdp) {
        var matchesHostPort = program.statsUdp.match(/^(.+):(\d+)$/);
        opts = {
            host: matchesHostPort[1],
            port: parseInt(matchesHostPort[2])
        };
    } else if (program.statsFile) {
        var file = path.resolve(program.statsFile);
        opts = {
            // passing in our own 'socket' implementation here so we can write to file instead.
            // note: this is non-public api and could change without warning.
            _ephemeralSocket: new FileStatsLogger(file)
        };
    }

    var createStatsdClient;

    // Wrap the require in a try/catch so we're don't have to add uber-statsd-client
    // as a dependency but fail gracefully when not available.
    try {
        createStatsdClient = require('uber-statsd-client');
    } catch (e) {
        if (e.code !== "MODULE_NOT_FOUND") {
            throw e;
        }

        console.error("To be able to emit stats you need to have uber-statsd-client installed.");
        console.error("Please run \"npm install uber-statsd-client\" and try again!");
        process.exit(1);
    }

    return createStatsdClient(opts);
}

function FileStatsLogger(file) {
    if (!(this instanceof FileStatsLogger)) {
        return new FileStatsLogger(file);
    }

    this.file = file;
    this.stream = null;
    this.ensureStream();
}

FileStatsLogger.prototype.ensureStream = function ensureStream() {
    if (this.stream) {
        return;
    }
    this.stream = fs.createWriteStream(this.file, {flags: 'a'});
};

FileStatsLogger.prototype.close = function close() {
    if (this.stream) {
        this.stream.end();
        this.stream = null;
    }
};

FileStatsLogger.prototype._writeToSocket = function _writeToSocket(data, cb) {
    this.ensureStream();
    this.stream.write(new Date().toISOString() + ': ' + data + '\n', cb);
};

FileStatsLogger.prototype.send = FileStatsLogger.prototype._writeToSocket;

function parseInt10(str) {
    return parseInt(str, 10);
}

function createLogger(name) {
    return {
        trace: function noop() {},
        debug: enrich('debug', 'log'),
        info: enrich('info', 'log'),
        warn: enrich('warn', 'error'),
        error: enrich('error', 'error')
    };

    function enrich(level, method) {
        return function log() {
            var args = [].slice.call(arguments);
            args[0] = name + ' ' + level + ' ' + args[0];
            console[method].apply(console, args);
        };
    }
}

if (require.main === module) {
    main(process.argv);
}
module.exports = main;
