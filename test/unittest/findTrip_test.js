// This test the mongodb wrapper findTrips API
require('../../tripLoc.js')();
var mongoose = require('mongoose');
var assert = require('assert');
var TripLocModel = mongoose.model('TripLoc');


function callback(tripSet){
    assert.doesNotThrow(function noThrow() {
        console.log("Passed! Return: " + Array.from(tripSet).length);
        process.exit();
    }, null, 'does not throw');
}
           
mongoose.connect("mongodb://localhost:27017/test");
db = mongoose.connection;

TripLocModel.findTrips(90, 100, -90, -100, callback);

