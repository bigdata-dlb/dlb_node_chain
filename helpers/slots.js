var constants = require('./constants.js');
var utils = require('../helpers/utils.js');
/**
 * Get time from Ebookcoin epoch.
 * @param {number|undefined} time Time in unix seconds
 * @returns {number}
 */

 var bigBangTick;

function beginEpochTime() {
    // var d = new Date(Date.UTC(2016, 5, 20, 0, 0, 0, 0)); //Testnet starts from 2016.6.20

    return bigBangTick;
}

function getEpochTime(time) {
    if (time === undefined) {
        time = (new Date()).getTime();
    }
    var d = beginEpochTime();
    // var t = d.getTime();
    return Math.floor((time - d) / 1000);
}

module.exports = {
    // bigBang: function() {
    //     bigBangTick = new Date().getTime();
    // },

    getStartTime: function() {
        return bigBangTick;
    },

    setStartTime: function(time) {
        if (utils.isInteger(time) && time > 0) {
            bigBangTick = time;
        }
    },

    getTime: function(time) {
        return getEpochTime(time);
    },

    getRealTime: function(epochTime) {
        if (epochTime === undefined) {
            epochTime = this.getTime();
        }
        var d = beginEpochTime();
        // var t = Math.floor(d.getTime() / 1000) * 1000;
        var t = Math.floor(d / 1000) * 1000;
        return t + epochTime * 1000;
    },

    setFakeSlotNumber: function(slot) {
        // fakeSlotNumber = slot;
        var current = (new Date()).getTime();   // 当前时间毫秒数
        var startTick = current - constants.slots.interval * slot * 1000;
        bigBangTick = startTick - 500;  // 减500毫秒显得逼真一点
    },

    getSlotNumber: function(epochTime) {
        if (epochTime === undefined) {
            epochTime = this.getTime();
        }
        return Math.floor(epochTime / constants.slots.interval);
    },

    getSlotTime: function(slot) {
        return slot * constants.slots.interval;
    },

    // getNextSlot: function() {
    //     var slot = this.getSlotNumber();

    //     return slot + 1;
    // },

    // getLastSlot: function(nextSlot) {
    //     return nextSlot + constants.delegates;
    // }
}
