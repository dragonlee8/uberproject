// This test the mongodb wrapper findTrips API
require('../../tripLoc.js')();
var mongoose = require('mongoose');
var assert = require('assert');
var TripLocModel = mongoose.model('TripLoc');


function callback(tripSet){
}

function callback(err){
    assert.doesNotThrow(function noThrow() {
        if (err){
            console.log("Failed to insert Trip update, Error: " + err);
        }
        else
        {
            console.log("Passed! Successfully inserted a record")
            process.exit();
        }
    }, null, 'does not throw');
}

           
mongoose.connect("mongodb://localhost:27017/test");
db = mongoose.connection;

TripLocModel.insert({
    event: 'update',
    tripId: 1,
    lat: 45,
    lng: 100,
    timestamp: (new Date).getTime()
}, callback);

