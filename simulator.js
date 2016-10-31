#!/usr/bin/env node

/**
 * TAXI Coding Challenge: Geotemporal Systems
 * @author: Thomas Hunter <me@thomashunter.name>
 *
 * This program emits sample data.
 * I wrote it hastily so that I could get to the real project,
 * so please don't consider this a reflection of my skill!
 */
var net = require('net');
var amqp = require('amqp');
var assert = require('assert');
var async = require('async');


const TIMEOUT = 100;
var connection = amqp.createConnection();

// add this for better debuging
connection.on('error', function(e) {
	console.log("Error from amqp: ", e);
	process.exit(1)
});

var trips = [];

// Announces some data to all connected clients
var send = function(exchange, message) {
	exchange.publish('', JSON.stringify(message), {}, function(errored, err) {
		assert.ok(errored);
		error = err;

		setTimeout(function() {
			assert.equal(error.message, 'Can not publish: exchange is not open');
		}, TIMEOUT);
	});
};

var max_trip_id = 0;

// How frequently we want to transmit update locations in ms
var update_interval = 1000;

var average_concurrent_trips = 500;

// cars would be moving in this area
// Set an unrealize range for easy verify the data
// In reality, the range should be much smaller
var spawn = {
  ne: {
	lat:  30,
	lng:  30,
  },
  sw: {
	lat:   -30,
	lng:   -30,
  }
};

console.log(". Starting simulation...");

connection.addListener('ready', function () {
	console.log("connected to " + connection.serverProperties.product);

	var exchange = connection.exchange('tripUpdate');
	console.log('Exchange ' + exchange.name + ' is open');

	var create_trip = function() {
		max_trip_id++;
        console.log("createTrip " + max_trip_id);

		var trip = {
			tripId: max_trip_id,
			lat: (spawn.ne.lat - spawn.sw.lat) * Math.random() + spawn.sw.lat,
			lng: (spawn.ne.lng - spawn.sw.lng) * Math.random() + spawn.sw.lng,
            active: true
		};
		trips.push(trip);

		send(exchange, {
			event: 'begin',
			tripId: trip.tripId,
			lat: trip.lat,
			lng: trip.lng,
			timestamp: (new Date).getTime()
		});
	};

	for (var i = 1; i <= average_concurrent_trips; i++) {
		create_trip(exchange);
	}


	function tick() {
		// Move each car randomly
        var cb = function ()
        {}
        async.each(trips, function(trip, cb) {
            if (!trip.active)
            {
                return;
            }
			var endtoss = Math.random();

            // I set in every tick, the trip has 0.02 chance to end. Since the there is 1 tick/sec, 
            // the average trip length would be 50 secs, it's apart from reality, but good for testing purpose
			if (endtoss < 0.02) { // Trip Ends
                send(exchange, {
                    event: 'end',
                    tripId: trip.tripId,
                    lat: trip.lat,
                    lng: trip.lng,
                    timestamp: (new Date).getTime()
                });

                trip.active = false;
			} else { // Trip Upadate
				trip.lat += Math.random() * 0.02 - 0.01;
				trip.lng += Math.random() * 0.02 - 0.01;
                send(exchange, {
                    event: 'update',
                    tripId: trip.tripId,
                    lat: trip.lat,
                    lng: trip.lng,
                    timestamp: (new Date).getTime()
                });
			}
            cb();
        }, function(err) {
            console.log("end");
            if( err ) {
                console.log('A trip failed to process');
            } else {
                // Occasionally create new trips and attempt to catch up to the average
                if (Math.random() < 0.75) {
                    for (var i = 0; i < (average_concurrent_trips + 5 - trips.length); i++) {
                        if (Math.random() < 0.65) {
                            create_trip();
                        }
                    }
                }
            }
        });

		console.log("Concurrent Trips: " + trips.length);
	};

	setInterval(tick, update_interval);

});
