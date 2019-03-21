var async = require('async'),
	util = require('util'),
	// ip = require('ip'),
	Router = require('../helpers/router.js'),
	utils = require('../helpers/utils.js'),
	extend = require('extend'),
	fs = require('fs'),
	path = require('path'),
	sandboxHelper = require('../helpers/sandbox.js');
	// peerList = require('../peers-array.json');

// require('array.prototype.find'); // Old node fix

// private fields
var modules, library, self, privated = {}, shared = {};

// Constructor
function Peer(cb, scope) {
	library = scope;
	self = this;
	self.__private = privated;
	privated.attachApi();
	privated.peerList = [];		//peerList;

	setImmediate(cb, null, self);
}

// private methods
privated.attachApi = function () {
	var router = new Router();

	router.use(function (req, res, next) {
		if (modules && privated.loaded) return next();
		res.status(500).send({success: false, error: "Blockchain is loading"});
	});

	router.map(shared, {
		"post /exchangePeers": "exchangePeers"
	});

	router.use(function (req, res) {
		res.status(500).send({success: false, error: "API endpoint not found"});
	});

	library.network.app.use('/api/peers', router);
	library.network.app.use(function (err, req, res, next) {
		if (!err) return next();
		library.logger.error(req.url, err.toString());
		res.status(500).send({success: false, error: err.toString()});
	});
};

Peer.prototype.getPeersArray = function() {
	return privated.peerList;
}

Peer.prototype.sandboxApi = function (call, args, cb) {
	sandboxHelper.callMethod(shared, call, args, cb);
};

// Events
Peer.prototype.onBind = function (scope) {
	modules = scope;
}

// Events
Peer.prototype.onBlockchainReady = function (scope) {
	privated.loaded = true;
	if (library.config.peers.peerList.length <= 0) {
		return;
	}

	for (i in library.config.peers.peerList) {
		var peerItem = {host: library.config.peers.peerList[i].host, port: library.config.peers.peerList[i].port};
		privated.peerList.push(peerItem);
	}
	
	var peer = privated.peerList[0];
	var peerMyself = library.config.peers.myself;
	library.logger.debug('将自身节点信息[host=' + peerMyself.host + ',port=' + peerMyself.port + ']发送给peer[host='
		+ peer.host + ',port=' + peer.port);
	utils.httpPost(peer.host, peer.port, '/api/peers/exchangePeers', {peerList: [peerMyself]}, function(resData) {
		library.logger.debug('Peer.prototype.onBlockchainReady -- resData: ' + resData);
		var response = JSON.parse(resData);
		if (response.success === true && utils.isPeerList(response.peerList)) {
			privated.peerList = utils.mergePeersNoDuplicate(privated.peerList, response.peerList, peerMyself);
			// utils.writeObj2JsonFile('../peers-array.json', privated.peerList);
			// library.bus.message('peerReady');
			library.logger.debug('Peer.prototype.onBlockchainReady -- peerList: ' + JSON.stringify(privated.peerList));
		} else {
			library.logger.debug('Peer.prototype.onBlockchainReady -- Invalid peer list from peer node');
		}
	});
};

// 暂时先不考虑节点信息广播，配置项里设为不广播就可以了
privated.broadcastPeers = function() {
	var receivedPeerList = [];
	async.eachSeries(privated.peerList, function(peer, cb) {
		utils.httpPost(peer, privated.peerList, function(resData) {
			library.scheme.validate(resData, {
				type: "string",
				format: "peerList"
			}, function (err) {
				if (!err) {
					receivedPeerList = utils.mergePeersArrayNoDuplicate(receivedPeerList, JSON.parse(resData));
				}
				cb();
			});
		});
	}, function(err) {
    	if (err) {
			console.log(err);
		}

		privated.peerList = utils.mergePeersArrayNoDuplicate(privated.peerList, receivedPeerList);
		utils.writeObj2JsonFile('../peers-array.json', privated.peerList);

		secondsOfRound = constants.delegatesNum * constants.slots.interval; // 一个round有多少秒
		setTimeout(this.broadcastPeers, Math.floor(Math.random() * (secondsOfRound - 5)) * 1000);
	});
}

Peer.prototype.onPeerReady = function () {
	if (library.config.peers.broadcast) {	// 由配置文件决定是否全网广播peer列表，节点的所有者可以手动修改配置文件
		secondsOfRound = constants.delegatesNum * constants.slots.interval; // 一个round有多少秒
		setTimeout(this.broadcastPeers, Math.floor(Math.random() * (secondsOfRound - 5)) * 1000);
	}
};

// Shared
shared.exchangePeers = function (req, cb) {
	privated.active = true;
	var body = req.body;
	library.scheme.validate(body, {
		type: "object",
		properties: {
			peerList: {
				type: "array",
				format: "peerList"
			}
		}
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function(cb) {
			library.logger.debug('接收到交换节点信息: ' + JSON.stringify(body));
			var peerMyself = library.config.peers.myself;
			privated.peerList = utils.mergePeersNoDuplicate(privated.peerList, body.peerList, peerMyself);
			// utils.writeObj2JsonFile('../peers-array.json', privated.peerList);
			cb();
		}, function(err, res) {
			privated.active = false;
			cb(null, {peerList: privated.peerList});
		});
	});
};

Peer.prototype.cleanup = function (cb) {
	privated.loaded = false;
	setTimeout(function checkActive() {
		if (privated.active) {
			setTimeout(checkActive, 50);
		} else {
			cb();
		}
	}, 50);
};

// Export
module.exports = Peer;
