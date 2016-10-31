# Geotemporal Exercise
A demo system for uber distributed system

## Requirements
This project requires that Mongodb, RabbitMQ be installed.

## System overview:
![Alt text](/project.jpg?raw=true "Optional Title")
This system utilize ringpop to distribute the request and rabbitMQ to stream update messages. The sharding would be depending on the Geohash key of the trip location. I use two character GeoHash as shardkey so that on theory there can be at maximum 36*36 nodes on the consistent hashing ring. Each node has a mongodb as persistent storage.

The request to count the number of trips within the region would be served by RESTFUL interface hosted on node directly. If the search is across several geo cells, one request will be send to each cell and final result would be aggreated at the node which gets the request. A rate limiter was in place to prevent extremely high volume request send to server. 

MongoDB provides good geospatial support with its 2dsphere index and geo query API. Also since the system is much more heavily weighted on write than read, MongoDB is very fast in adding the record. Also Mongodb provides good caching service, when the data set is smaller than the memory, the entire database is running in memory. So it's a very good fit.

## Installation
Run the following command to get all the needed package installed:
```
npm install
```
The config is default to bring up 5 nodes on the localhost, but you can also change the number of nodes by modifying procsToStart variable inside tick-cluster.js. The backend mongodb URL change be modified in config/default.json
```
default.json
{
  "Cluster": {
    "dbConfig": {
      "hosts": ["mongodb://localhost:27017/test", 
          "mongodb://localhost:27017/test", 
          "mongodb://localhost:27017/test", 
          "mongodb://localhost:27017/test", 
          "mongodb://localhost:27017/test", 
          "mongodb://localhost:27017/test"]
    }
  },
  "GeoHashLevel": 2
}
```

## Usage
### Start node cluster
Start the node cluster by running:
```
./tick-cluster.js --interpreter node main.js 
```

### Trip simulation:
I wrote a trip simulator by continuous feeding json object to rabbitMQ, once every second for 500 trips. The number of trips and update frequency can also be modified in simulator.js. The reason to use rabbitMQ is its speed and scaling ability. Currently I use one rabbitMQ channel to connect all the driver and nodes, more rabbitMQ channels can be added easily if needed.  

Run simulator with:
```
./simulator.js 
```
### Get Number of Trips in a region:
You can get the number of trip results by sending REST request to http server
```
curl localhost:6000/countTrips/<lat1>/<lng1>/<lat2>/<lng2>
For Example:
curl localhost:6000/countTrips/11/11/10/10
```
topRight [lat1, lng1]  
lowLeft [lat2, lng2]


## Test
### Integration Test:
Test for getting Number of region can also be done by running the test test/integration/findTriptest.js
```
node findTripsTest.js 37.9 -22.2 37.8 -22.3
```
The request time in the print out

### Unit Test
There are several unit test in test/unittest

Run
```
node findTrip_test.js
node insertTrip_test.js
```

# Benchmark
The average response time of the trip count request is around 100ms on the Debian system in my macbook VMware. I believe the query time can be largely reduced if run on real server.

# TODO:
* Add different configuration for dev and prod environment. 
* Use Google S2 to replace MongoDB to achieve better performance
* I didn't have time to finish the Chef script. To add chef scrip to auto deployment and config number of nodes
