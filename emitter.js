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


var connection = amqp.createConnection();

// add this for better debuging
connection.on('error', function(e) {
	console.log("Error from amqp: ", e);
	process.exit(1)
});


var first_client_has_connected = false;

// Big ol' array of all concurrent trips
var trips = [];

// Array of all clients (service.js) connected to this server
var clients = [];

// Announces some data to all connected clients
var announce = function(exchange, message) {
	console.log()
	exchange.publish('', JSON.stringify(message), {}, function(errored, err) {
		assert.ok(errored);
		error = err;

		setTimeout(function() {
			assert.equal(error.message, 'Can not publish: exchange is not open');
		}, 1000);
	});
};

var max_trip_id = 0;

// How frequently we want to transmit update locations in ms
var update_interval = 2 * 1000;

// How many trips should be happening at the same time
var average_concurrent_trips = 1;

// What is the bounding box for spawning cars in
var spawn = {
  ne: {
	lat:   37.814039,
	lng: -22.359200,
  },
  sw: {
	lat:   37.704382,
	lng: -22.514381,
  }
};

console.log(". Starting simulation...");

connection.addListener('ready', function () {
	console.log("connected to " + connection.serverProperties.product);

	var exchange = connection.exchange('tripUpdate');
	console.log('Exchange ' + exchange.name + ' is open');

	var create_trip = function() {
		max_trip_id++;

		var trip = {
			tripId: max_trip_id,
			lat: (spawn.ne.lat - spawn.sw.lat) * Math.random() + spawn.sw.lat,
			lng: (spawn.ne.lng - spawn.sw.lng) * Math.random() + spawn.sw.lng,
		};
		trips.push(trip);

		announce(exchange, {
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
		var i = 0;

		console.log("ticker");
		trips.forEach(function(trip) {
			var action_threshold = Math.random();
			console.log(action_threshold);

			if (action_threshold < 0.01) { // Trip Ends
				setTimeout(function() {
					announce(exchange, {
						event: 'end',
						tripId: trip.tripId,
						lat: trip.lat,
						lng: trip.lng,
						fare: Math.floor(Math.random() * 20) + 10,
						timestamp: (new Date).getTime()
					});
				}, i);

				trips.splice(trips.indexOf(trip), 1);

			} else { // Car Drives
				trip.lat += Math.random() * 0.01 - 0.005;
				trip.lng += Math.random() * 0.01 - 0.005;
				setTimeout(function() {
					announce(exchange, {
						event: 'update',
						tripId: trip.tripId,
						lat: trip.lat,
						lng: trip.lng,
						timestamp: (new Date).getTime()
					});
				}, i);
			}

			i += 1.8; // slightly less than 2ms, which would be a continuous broadcast and could have race conditions
		});

		// Occasionally create new trips and attempt to catch up to the average
		if (Math.random() < 0.75) {
			for (var i = 0; i < (average_concurrent_trips + 5 - trips.length); i++) {
				if (Math.random() < 0.65) {
					create_trip();
				}
			}
		}

		console.log("Concurrent Trips: " + trips.length);
	};

	setInterval(tick, update_interval);

});
