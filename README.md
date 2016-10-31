# Geotemporal Exercise
A demo system for uber distributed system

## Requirements
This project requires that Mongodb, RabbitMQ be installed.

## System overview:
This system utilize ringpop to distribute the request and rabbitMQ to stream update messages. The request to count the number of trips within the region would be served by RESTFUL interface hosted on node directly.  



## Installation
Run the following command to get all the needed package installed:
```
npm install
```
The config is defaut to bring up 
