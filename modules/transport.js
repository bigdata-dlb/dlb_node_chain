var async = require('async'),
	util = require('util'),
	Router = require('../helpers/router.js'),
	utils = require('../helpers/utils.js'),
	extend = require('extend'),
	fs = require('fs'),
	path = require('path'),
	sandboxHelper = require('../helpers/sandbox.js');

// require('array.prototype.find'); // Old node fix

// private fields
var modules, library, self, privated = {}, shared = {};

// 以后节点很多的时候要想办法优化这个Transport模块，不分青红皂白地广播很可能造成广播风暴
// 至少也会严重浪费网络资源和节点的CUP处理时间

// Constructor
function Transport(cb, scope) {
	library = scope;
	self = this;
	self.__private = privated;
	privated.attachApi();
	privated.blockchainReady = false;
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
		"post /newTransaction": "newTransaction",
		"post /newBlock": "newBlock"
	});

	router.use(function (req, res) {
		res.status(500).send({success: false, error: "API endpoint not found"});
	});

	library.network.app.use('/api/transport', router);
	library.network.app.use(function (err, req, res, next) {
		if (!err) return next();
		library.logger.error(req.url, err.toString());
		res.status(500).send({success: false, error: err.toString()});
	});
};

Transport.prototype.sandboxApi = function (call, args, cb) {
	sandboxHelper.callMethod(shared, call, args, cb);
};

Transport.prototype.onBlockchainReady = function (scope) {
	privated.loaded = true;
	privated.blockchainReady = true;
}

// Events
Transport.prototype.onBind = function (scope) {
	modules = scope;
};

// 交易到了需要广播的时候，已经是在transactions模块里处理完全正确无误了，所以不需要再次检查校验
Transport.prototype.broadcastTransaction = function (txObj, cb) {
	library.logger.debug('执行到了Transport模块的broadcastTransaction函数');
	var peersArray = modules.peer.getPeersArray();
	async.eachSeries(peersArray, function(peer, cb) {
		library.logger.debug('将交易[type=' + txObj.type + ',hash=' + txObj.hash + ']发送给peer节点[host='
			+ peer.host + ',port=' + peer.port + ']');
		utils.httpPost(peer.host, peer.port, '/api/transport/newTransaction', txObj, function(resData) {
			library.logger.debug('Transport.prototype.broadcastTransaction -- resData: ' + resData);
			// cb();
		});
		cb();
	}, function(err) {
    	if (err) {
			library.logger.debug('Transport.prototype.broadcastTransaction -- err: ' + err);
		}
		cb();
	});
};

// 交易到了需要广播的时候，已经是在transactions模块里处理完全正确无误了，所以不需要再次检查校验
Transport.prototype.broadcastBlock = function (blockObj, cb) {
	library.logger.debug('执行到了Transport模块的broadcastBlock函数');
	var peersArray = modules.peer.getPeersArray();
	async.eachSeries(peersArray, function(peer, cb) {
		library.logger.debug('将块[height=' + blockObj.height + ',hash=' + blockObj.hash + ']发送给peer节点[host='
			+ peer.host + ',port=' + peer.port + ']');
		utils.httpPost(peer.host, peer.port, '/api/transport/newBlock', blockObj, function(resData) {
			library.logger.debug('Transport.prototype.broadcastBlock -- resData: ' + resData);
			// cb();
		});
		cb();
	}, function(err) {
    	if (err) {
			library.logger.debug('Transport.prototype.broadcastBlock -- err: ' + err);
		}
		library.logger.debug('Transport.prototype.broadcastBlock -- 新block全部广播完毕');
		cb();
	});
};

// Shared
shared.newTransaction = function (req, cb) {
	privated.active = true;
	var txObj = req.body;
	library.scheme.validate(txObj, {
		type: "object",
		properties: {
			type: {
				type: "integer"
			},
			timestamp: {
				type: "integer"
			},
			amount: {
				type: "integer"
			},
			senderPublicKey: {
				type: "string",
				format: "publicKey"
			},
			asset: {
				type: "object"
			},
			signature: {
				type: "string",
				format: "signature"
			},
			hash: {
				type: "string",
				format: "hash"
			},
			fee: {
				type: "integer"
			},
			blockHash: {
				type: "string",
				format: "hash"
			}
		},
		required: ['type', 'timestamp', 'amount', 'senderPublicKey', 'asset', 'signature', 'hash', 'fee']
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function(cb) {
			library.logger.debug('接收到从peer节点广播来的新交易：[type=' + txObj.type + ',hash=' + txObj.hash + ']');

			// 这里的检查只需交易对象形式合规，内容合规的检查留给各个交易类型的process和verify函数去做
			if (!utils.checkTxAssetMatchType(txObj.type, txObj.asset)) {
				return cb('Invalid transaction object, tx asset does not match type');
			}

			if (modules.transactions.checkTxExistInUnconfirmedList(txObj.hash)) {
				return cb('Transaction already exist in unconfirmed list');
			}

			library.mongoDb.getTransactionByTxHash(txObj, function(err, res) {
				if (err) {
					return cb(err);
				}

				if (res) {
					return cb('Transaction already exist in db');
				}
				modules.transactions.receiveTransactions([txObj], cb);
			});
		}, function(err, res) {
			privated.active = false;
			if (err) {
				library.logger.debug('处理从peer节点广播来的新交易：[type=' + txObj.type + ',hash=' + txObj.hash
					+ ']失败!，err=' + err);
				return cb(err);
			}
			library.logger.debug('处理从peer节点广播来的新交易：[type=' + txObj.type + ',hash=' + txObj.hash + ']成功');
			cb(null, {acknowledgement: 'OK'});
		});
		// cb(null, {acknowledgement: 'OK'});
	});
};

// Shared
shared.newBlock = function (req, cb) {
	privated.active = true;
	var blockObj = req.body;
	library.scheme.validate(blockObj, {
		type: "object",
		properties: {
			version: {
				type: "integer"
			},
			timestamp: {
				type: "integer"
			},
			numberOfTransactions: {
				type: "integer"
			},
			payloadLength: {
				type: "integer"
			},
			totalAmount: {
				type: "integer"
			},
			totalFee: {
				type: "integer"
			},
			reward: {
				type: "integer"
			},
			payloadHash: {
				type: "string",
				format: "hash"
			},
			generatorPublicKey: {
				type: "string",
				format: "publicKey"
			},
			previousBlockHash: {
				type: "string",
				format: "hash"
			},
			blockSignature: {
				type: "string",
				format: "signature"
			},
			height: {
				type: "integer"
			},
			hash: {
				type: "string",
				format: "hash"
			},
			txHashArray: {
				type: "array",
				format: "hashArray"
			},
			txArray: {
				type: "array"
			}
		},
		required: ['version', 'timestamp', 'numberOfTransactions', 'payloadLength', 'totalAmount', 'totalFee',
			'reward', 'payloadHash', 'generatorPublicKey', 'previousBlockHash', 'blockSignature', 'height',
			'hash', 'txHashArray']
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function(cb) {
			library.logger.debug('接收到从peer节点广播来的新块：[height=' + blockObj.height + ',hash=' + blockObj.hash + ']');
			library.mongoDb.getBlockFromDb(blockObj, function(err, res) {
				if (err) {
					return cb(err);
				}

				if (res) {
					return cb('Block already exist in db');
				}

				library.logger.debug('shared.newBlock --- come here 111!');

				var unconfirmedTransactions = modules.transactions.getUnconfirmedTransactionList();
				var txHashNonExist = [];
				for (i in blockObj.txHashArray) {
					var existInBlockTxArray = false;
					var existInUnconfirmedList = false;
					if (blockObj.txArray && util.isArray(blockObj.txArray)) {
						for (k in blockObj.txArray) {
							if (blockObj.txHashArray[i] == blockObj.txArray[k].hash) {
								existInBlockTxArray = true;
								break;
							}
						}
					}

					if (!existInBlockTxArray) {
						for (j in unconfirmedTransactions) {
							if (blockObj.txHashArray[i] == unconfirmedTransactions[j].hash) {
								existInUnconfirmedList = true;
								break;
							}
						}
					}
				
					if (!existInBlockTxArray && !existInUnconfirmedList) {
						txHashNonExist.push(blockObj.txHashArray[i]);
					}
				}

				if (txHashNonExist.length > 0) {
					library.logger.info('shared.newBlock --- come here 222!');
					// process.exit(-1);
					// // var peerIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
					// // var peerPort = parseInt(req.headers.port);
					
					setImmediate(function() {
						library.sequence.add(function(cb2) {
							var peer = library.config.peers.peerList[0];
							var queryObj = {hash: blockObj.hash, height: blockObj.height, txHashArray: txHashNonExist};
							var url = '/api/blocks/getBlockAsync?' + require('querystring').stringify(queryObj);
							utils.httpGet(peer.host, peer.port, url, function(resData) {
								library.logger.info('shared.newBlock --- come here 888!:' + resData);
								var dataObj = JSON.parse(resData);
								if (dataObj.success === true) {
									var blockObj2 = dataObj.block;
									modules.blocks.processBlock(blockObj2, true, cb2);
								} else {
									cb2('getBlockAsync from peer fail: blockHeight=' + blockObj.height);
								}
							});
						}, function(err, res) {
							if (err) {
								library.logger.error(err)
							}
						});
					});

					cb('Request the same block with some non_exist tx');
				} else {
					library.logger.debug('shared.newBlock --- come here 333!: block: ' + JSON.stringify(blockObj));
					modules.blocks.processBlock(blockObj, true, cb);
				}
			});
		}, function(err, res) {
			privated.active = false;
			if (err) {
				library.logger.debug('处理从peer节点广播来的新块：[height=' + blockObj.height + ',hash=' + blockObj.hash
					+ ']失败!，err=' + err);
				return cb(err);
			}
			library.logger.debug('处理从peer节点广播来的新块：[height=' + blockObj.height + ',hash=' + blockObj.hash + ']成功');
			cb(null, {acknowledgement: 'OK'});
		});
		// cb(null, {acknowledgement: 'OK'});
	});
};

Transport.prototype.cleanup = function (cb) {
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
module.exports = Transport;
