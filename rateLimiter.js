var config = require('config');

var capacity = config.get('RequestLimit');
var rate = 1000;
var lastTime = new Date().getTime();
var left = capacity;

// Currently this module can only keep tracking of one request
module.exports = function() {
    left += (new Date().getTime() - lastTime) * capacity / rate;
    if (left > capacity)
        left = capacity;

    if (left < 1)
        return false;
    
    left--;
    return true
}


