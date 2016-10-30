'use strict';

var http = require('http');
var start = new Date();

if (process.argv.length < 6)
{
    console.log("Usage: node findTripsTest lat1 lng1 lat2 lng2");
    console.log("Example: node findTripsTest.js 37.9 -22.2 37.8 -22.3")
    return;
}

var lat1 = parseFloat(process.argv[2]);
var lng1 = parseFloat(process.argv[3]);
var lat2 = parseFloat(process.argv[4]);
var lng2 = parseFloat(process.argv[5]);

if (lat1 > 90 || lat1 < -90 || lat2 > 90 || lat2 < -90 || 
    lng1 > 180 || lng1 < -180 || lng2 > 180 || lng2 < -180 ||
    lat1 < lat2 || lng1 < lng2)
{
    console.log("Pleaes check input");
    return;
}

var options = {
  host: 'localhost',
  port: 6004,
  path: '/countTrips/'+lat1+'/'+lng1+'/'+lat2+'/'+ lng2,
  method: 'GET'
};

http.get(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
        console.log('BODY: ' + chunk);
    });
    console.log(' Request took:', new Date() - start, 'ms');
});                       
                          
                          
