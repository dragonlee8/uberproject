// import the necessary modules
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;


// create an export function to encapsulate the model creation
module.exports = function() {
    // define schema

    var TripLocSchema = mongoose.Schema({
        event: String,
        tripid: Number,
        timestamp: Number,
        loc: {
            type: {
                type: 'String',
                default: 'Point'
            },
            coordinates: {
                type: [Number],
                index: '2dSphere'
            }
        },
    });

    // define a static
    TripLocSchema.statics.insert= function(payload, cb) {
        var trip = new this({event: payload.event, tripid: payload.tripId, 
            timestamp: payload.timestamp, 
            loc : {type: 'Point', coordinates: [payload.lat, payload.lng]}}); 

        trip.save(cb);
    };

    // define a static
    TripLocSchema.statics.findTrips = function(lat1, lng1, lat2, lng2, res) {

        var topRight = [lat1, lng1]
        var bottomLeft = [lat2, lng2]

        var query = this.where('loc').within().box(bottomLeft, topRight);

        var tripSet = new Set();
        // execute the query at a later time
        query.distinct('tripid').exec(function (err, trips) {
            for (i in trips)
            {
                //console.log(trips[i]);
                tripSet.add(trips[i]);
            }
            res(tripSet);
        });
    };

    // Register 
    mongoose.model('TripLoc', TripLocSchema);  
};
