# Geotemporal Exercise
A demo system for uber distributed system

## Requirements
This project requires that Mongodb, RabbitMQ be installed.

## System overview:
This system utilize ringpop to distribute the request and rabbitMQ to stream update messages. The sharding would be depending on the Geohash key of the trip location. I use two character GeoHash as shardkey so that on theory there can be at maximum 36*36 nodes on the consistent hashing ring. Each node has a mongodb as persistent storage.

The request to count the number of trips within the region would be served by RESTFUL interface hosted on node directly. If the search is across several geo cells, one request will be send to each cell and final result would be aggreated at the node which gets the request.


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


#

