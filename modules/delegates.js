var crypto = require('crypto');
var	extend = require('extend');
var	ed = require('ed25519');
var	async = require('async');
var fs = require('fs');
var	Router = require('../helpers/router.js');
var	slots = require('../helpers/slots.js');
var	util = require('util');
var	constants = require('../helpers/constants.js');
var	TransactionTypes = require('../helpers/transaction-types.js');
var	sandboxHelper = require('../helpers/sandbox.js');
var utils = require('../helpers/utils.js');
var ByteBuffer = require("bytebuffer");

var modules, library, self, privated = {}, shared = {};

privated.loaded = false;
privated.currentSlot = -1;
privated.specialAccounts = [];

// 暂存delegate的secret，供blocks模块组块使用。滚动刷新内容，最多保存3个slot
// 以对象{publicKey: 'XXX', secret: 'xxx', slotNum: xxx}为列表元素
privated.delegateSecretList = [];

// 貌似这里的applyDelegate取值false的话会有点问题，就是别的账号投票给它的votes退不回来了
// 当时设计的时候没有想到这一点，暂时只能这样了，以后再考虑怎么优化一下
function Delegate() {
	this.create = function (param, trs) {
		trs.amount = 0;
		trs.asset.applyDelegate = param.applyDelegate;
		return trs;
	};

	this.calculateFee = function (trs) {
		return 10;		// * constants.fixedPoint;
	};

	this.verify = function (trs, cb) {
		setImmediate(cb, null, trs);
	};

	this.process = function (trs, cb) {
		if (trs.amount !== 0) {
			return setImmediate(cb, "Invalid transaction amount");
		}

		// VOTE和DELEGATE两种交易类型都要做时间戳判断
		if (slots.getSlotNumber(trs.timestamp) < slots.getSlotNumber() - 1) {
			return setImmediate(cb, "Invalid timestamp of a vote transaction");
		}

		if (!trs.asset || typeof trs.asset.applyDelegate !== 'boolean') {
			return setImmediate(cb, "Invalid asset applyDelegate");
		}

		var param = {};
		param.publicKey = trs.senderPublicKey;
		param.slotNum = slots.getSlotNumber(trs.timestamp);
		library.logic.account.isAccountDelegate(param, function(err, result) {
			if (err) {
				return setImmediate(cb, err);
			}

			if (trs.asset.applyDelegate == result) {
				return setImmediate(cb, "ApplyDelegate equals to current delegate state");
			}
			cb(null, trs);
		});
	};

	this.getBytes = function (trs) {
		// try {
		// 	var buf = new Buffer(trs.asset.applyDelegate ? 'TRUE' : 'FALSE', 'utf8');
		// } catch (e) {
		// 	throw Error(e.toString());
		// }
		// return buf;

		var bb = new ByteBuffer(1, true);
		bb.writeByte(trs.asset.applyDelegate ? 255 : 0);
		bb.flip();
		return bb.toBuffer();
	};

	function applyAnyway(trs, cb) {
		var param = {};
		param.publicKey = trs.senderPublicKey;
		param.slotNum = slots.getSlotNumber(trs.timestamp);
		param.applyDelegate = trs.asset.applyDelegate;
		library.logic.account.setAccountDelegate(param, function(err, result) {
			if (err) {
				return cb(err);
			}
			cb(null, trs);
		});
	}

	this.apply = function (trs, cb) {
		applyAnyway(trs, cb);
	};

	this.applyUnconfirmed = function (trs, cb) {
		applyAnyway(trs, cb);
	};

	function undoAnyway(trs, cb) {
		var param = {};
		param.publicKey = trs.senderPublicKey;
		param.slotNum = slots.getSlotNumber(trs.timestamp);
		library.logic.account.unsetAccountDelegate(param, function(err, result) {
			if (err) {
				return cb(err);
			}
			cb(null, trs);
		});
	}

	this.undo = function (trs, cb) {
		undoAnyway(trs, cb);
	};

	this.undoUnconfirmed = function (trs, cb) {
		undoAnyway(trs, cb);
	};

	this.ready = function (trs) {
		return trs.timestamp == 0 || slots.getSlotNumber(trs.timestamp) == slots.getSlotNumber() - 1;
	};
}

function Vote() {
	this.create = function (data, trs) {
		trs.amount = 0;
		trs.asset.votesList = [];
		for (i in data.votesList) {
			var voteItem = {};
			voteItem.delegate = data.votesList[i].delegate;
			voteItem.vote = data.votesList[i].vote;
			trs.asset.votesList.push(voteItem);
		}
		return trs;
	};

	this.calculateFee = function (trs) {
		return 1;		// * constants.fixedPoint;
	};

	this.verify = function (trs, cb) {
		setImmediate(cb, null, trs);
	};

	this.process = function (trs, cb) {
		async.series([function(cb) {
			if (trs.amount !== 0) {
				return setImmediate(cb, "Invalid transaction amount");
			}

			// VOTE和DELEGATE两种交易类型都要做时间戳判断
			if (slots.getSlotNumber(trs.timestamp) < slots.getSlotNumber() - 1)
			{
				return setImmediate(cb, "Invalid timestamp of a vote transaction");
			}

			if (!trs.asset.votesList || trs.asset.votesList.length <= 0
				|| trs.asset.votesList.length > constants.delegatesNum)
			{
				return setImmediate(cb, "Invalid votes list");
			}
			cb();
		}, function(cb) {
			library.logic.account.getDelegateList({slotNum: slots.getSlotNumber(), onlyPublicKey: true}, function(err, res) {
				if (err) {
					return cb(err);
				}

				library.logger.debug("Vote交易的process函数：getDelegateList： res", res);
				for (i in trs.asset.votesList) {
					if (res.indexOf(trs.asset.votesList[i].delegate) < 0) {
						return cb("Invalid vote delegate: " + trs.asset.votesList[i].delegate);
					}
				}

				cb();
			});
		}, function(cb) {
			var votesSum = 0
			for (i in trs.asset.votesList) {
				var voteItem = trs.asset.votesList[i];
				if (voteItem.vote <= 0) {
					return setImmediate(cb, "Invalid vote number: " + voteItem.vote);
				}
				votesSum += voteItem.vote;
			}

			var param = {publicKey: trs.senderPublicKey};
			library.logic.account.getTransferableBalance(param, function(err, result) {
				if (err) {
					return cb(err);
				}

				if (result < votesSum) {
					return cb('Insufficient transferable balance');
				}
				cb();
			});
		}], function(err, res) {
			if (err) {
				return cb(err);
			}
			cb(null, trs);
		});
	};

	this.getBytes = function (trs) {
		// try {
		// 	var buf = new Buffer(JSON.stringify(trs.asset.votesList), 'utf8');
		// } catch (e) {
		// 	throw Error(e.toString());
		// }
		// return buf;

		var bb = new ByteBuffer(trs.asset.votesList.length * 40, true);
		for (var i = 0; i < trs.asset.votesList.length; i++) {
			var delegateBuffer = Buffer.from(trs.asset.votesList[i].delegate, 'hex');		// 占32个字节
			for (var j = 0; j < delegateBuffer.length; j++) {
				bb.writeByte(delegateBuffer[j]);
			}
			bb.writeLong(trs.asset.votesList[i].vote);
		}
		bb.flip();
		return bb.toBuffer();
	};

	function applyAnyway(trs, cb) {
		async.eachSeries(trs.asset.votesList, function(voteItem, cb) {
			var param = {};
			param.publicKey = trs.senderPublicKey;
			param.addVotes = voteItem.vote;
			param.slotNum = slots.getSlotNumber(trs.timestamp);
			library.logic.account.addVotesUsed(param, function(err, res) {
				if (err) {
					return cb(err);
				}
				var param2 = {};
				param2.publicKey = voteItem.delegate;
				param2.addVotes = voteItem.vote;
				param2.slotNum = slots.getSlotNumber(trs.timestamp);
				library.logic.account.addDelegateVotes(param2, function(err, res) {
					if (err) {
						return cb(err);
					}
					cb();
				});
			});
		}, function(err) {
    		if (err) {
				return cb(err);
			}
			cb(null, trs);
		});
	}

	this.applyUnconfirmed = function (trs, cb) {
		applyAnyway(trs, cb);
	};

	this.apply = function (trs, cb) {
		applyAnyway(trs, cb);
	};

	function undoAnyway(trs, cb) {
		async.eachSeries(trs.asset.votesList, function(voteItem, cb) {
			var param = {};
			param.publicKey = voteItem.delegate;
			param.addVotes = -voteItem.vote;
			param.slotNum = slots.getSlotNumber(trs.timestamp);
			library.logic.account.addDelegateVotes(param, function(err, res) {
				if (err) {
					library.logger.debug("Vote交易：undoUnconfirmed：param=" + JSON.stringify(param));
					return cb(err);
				}

				var param2 = {};
				param2.publicKey = trs.senderPublicKey;
				param2.addVotes = -voteItem.vote;
				param2.slotNum = slots.getSlotNumber(trs.timestamp);
				library.logic.account.addVotesUsed(param2, function(err, res) {
					if (err) {
						library.logger.debug("Vote交易：undoUnconfirmed：param2=" + JSON.stringify(param2));
						return cb(err);
					}
					cb();
				});
			});
		}, function(err) {
    		if (err) {
				return cb(err);
			}
			cb(null, trs);
		});
	}
	
	this.undoUnconfirmed = function (trs, cb) {
		undoAnyway(trs, cb);
	};

	this.undo = function (trs, cb) {
		undoAnyway(trs, cb);
	};

	this.ready = function (trs) {
		return trs.timestamp == 0 || slots.getSlotNumber(trs.timestamp) == slots.getSlotNumber() - 1;
	};
}

// Constructor
function Delegates(cb, scope) {
	library = scope;
	self = this;
	self.__private = privated;
	privated.attachApi();

	library.logic.transaction.attachAssetType(TransactionTypes.DELEGATE, new Delegate());
	library.logic.transaction.attachAssetType(TransactionTypes.VOTE, new Vote());

	fs.exists('../special-accounts.json', function(exist) {
		if (exist) {
			privated.specialAccounts = require('../special-accounts.json').accounts;
		}
	});

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
		"get /get": "getDelegate",
		"get /": "getDelegates",
		"get /fee": "getFee",
		"get /startTime": "getStartTime",
		"post /addDelegate": "addDelegate",
		"post /voteDelegate": "voteDelegate"
	});

	library.network.app.use('/api/delegates', router);
	library.network.app.use(function (err, req, res, next) {
		if (!err) return next();
		library.logger.error(req.url, err.toString());
		res.status(500).send({success: false, error: err.toString()});
	});
};

Delegates.prototype.sandboxApi = function (call, args, cb) {
	sandboxHelper.callMethod(shared, call, args, cb);
};

// Events
Delegates.prototype.onBind = function (scope) {
	modules = scope;
};

Delegates.prototype.onBlockchainReady = function () {
	privated.loaded = true;
	setTimeout(nextLoop, 100);
};

function nextLoop() {
	var oldSlotNum = privated.currentSlot, newSlotNum = slots.getSlotNumber();
	if (newSlotNum != oldSlotNum) {
		privated.currentSlot = newSlotNum;
		// if (oldSlotNum >= 0) {
			library.logger.debug('进入新的slot：', privated.currentSlot);
			library.bus.message("enterNewSlot");
		// }
	}
	setTimeout(nextLoop, 100);
};

Delegates.prototype.onEnterNewSlot = function () {
	setTimeout(function() {
		var newDelegateSecretList = [];
		var currSlot = slots.getSlotNumber();
		for (i in privated.delegateSecretList) {
			if (privated.delegateSecretList[i].slotNum >= currSlot - 2) {
				newDelegateSecretList.push(privated.delegateSecretList[i]);
			}
		}
		privated.delegateSecretList = newDelegateSecretList;
		// library.logger.debug('Delegates.prototype.onEnterNewSlot -- delegateSecretList: '
		// 	+ JSON.stringify(privated.delegateSecretList));
	}, 600);
};

Delegates.prototype.getSecretByPublicKey = function (publicKey) {
	for (i in privated.delegateSecretList) {
		if (privated.delegateSecretList[i].publicKey == publicKey) {
			return privated.delegateSecretList[i].secret;
		}
	}
	return null;
};

// 更新数据库中的delegate和vote表，删除过时的记录
Delegates.prototype.onEnterNewSlot2 = function () {
	library.logic.account.deleteLegacyDelegateRecord(function(err, res) {
		if (err) {
			library.logger.error("Delegates模块：onEnterNewSlot函数：调用deleteLegacyDelegateRecord出错：", err);
		}
	});

	library.logic.account.deleteLegacyVoteRecord(function(err, res) {
		if (err) {
			library.logger.error("Delegates模块：onEnterNewSlot函数：调用deleteLegacyVoteRecord出错：", err);
		}
	});
};

Delegates.prototype.cleanup = function (cb) {
	privated.loaded = false;
	setTimeout(function checkActive() {
		if (privated.active) {
			setTimeout(checkActive, 50);
		} else {
			cb();
		}
	}, 50);
};

// Shared
shared.getDelegate = function (req, cb) {
	privated.active = true;
	var query = req.body;
	library.scheme.validate(query, {
		type: "object",
		properties: {
			publicKey: {
				type: "string",
				format: "publicKey"
			}
		},
		require: ["publicKey"]
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function (cb) {
			var param = {publicKey: query.publicKey, slotNum: slots.getSlotNumber()};
			library.logic.account.getDelegateFromPublicKey(param, function(err, res) {
				if (err) {
					return cb(err);
				}
				cb(null, res);
			});
		}, function (err, delegate) {
			privated.active = false;
			if (err) {
				return cb(err.toString());
			}

			if (delegate) {
				cb(null, {delegate: delegate});
			} else {
				cb("Delegate not found");
			}
		});
	});
};

shared.getDelegates = function (req, cb) {
	privated.active = true;
	var query = req.body;
	library.scheme.validate(query, {
		type: 'object',
		properties: {
			limit: {
				type: "integer",
				minimum: 0,
				// maximum: 101
			},
			offset: {
				type: "integer",
				minimum: 0
			},
			sortByVotes: {
				type: "integer"		// 取值-1表示按照得票数从高到低降序排列，1则表示升序排列
			}
		}
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function (cb) {
			var param = {slotNum: slots.getSlotNumber()};
			if (query.sortByVotes) {
				param.sortByVotes = query.sortByVotes;
			}

			if (query.offset) {
				param.offset = query.offset;
			}

			if (query.limit) {
				param.limit = query.limit;
			}

			library.logic.account.getDelegateList(param, cb);
		}, function (err, delegateList) {
			privated.active = false;
			if (err) {
				return cb(err.toString());
			}

			cb(null, {delegates: delegateList});
		});
		
	});
};

shared.getStartTime = function (req, cb) {
	cb(null, {startTime: slots.getStartTime()});
};

shared.getFee = function (req, cb) {
	privated.active = true;
	var query = req.body;
	library.scheme.validate(query, {
		type: "object",
		properties: {
			txType: {
				type: "string",
			}
		},
		required: ["txType"]
	}, function (err) {
		privated.active = false;
		if (err) {
			return cb(err[0].message);
		}

		var txType = query.txType.toLowerCase();
		if (txType == 'delegate') {
			// cb(null, {fee: 100 * constants.fixedPoint});
			cb(null, {fee: 100});
		} else if (txType == 'vote') {
			// cb(null, {fee: 1 * constants.fixedPoint});
			cb(null, {fee: 1});
		} else {
			cb('Invalid transaction type');
		}
	});
};

shared.addDelegate = function (req, cb) {
	privated.active = true;
	var body = req.body;
	library.scheme.validate(body, {
		type: "object",
		properties: {
			secret: {
				type: "string",
				minLength: 1,
				maxLength: 100
			},
			publicKey: {
				type: "string",
				format: "publicKey"
			},
			applyDelegate: {
				type: "boolean"
			}
		},
		required: ["secret"]
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		var hash = crypto.createHash('sha256').update(body.secret, 'utf8').digest();
		var keypair = ed.MakeKeypair(hash);

		if (body.publicKey && keypair.publicKey.toString('hex') != body.publicKey) {
			privated.active = false;
			return cb("Public key does not match the secret");
		}

		if (typeof body.applyDelegate === 'undefined') {
			body.applyDelegate = true;
		}

		library.sequence.add(function (cb) {
			try {
				var transaction = library.logic.transaction.create({
					type: TransactionTypes.DELEGATE,
					senderPublicKey: keypair.publicKey.toString('hex'),
					keypair: keypair,
					applyDelegate: body.applyDelegate
				});
			} catch (e) {
				return cb(e.toString());
			}

			library.logger.info('delegates模块成功创建交易：type=' + transaction.type + ', hash=' + transaction.hash);
			modules.transactions.receiveTransactions([transaction], cb);
		}, function (err, transaction) {
			privated.active = false;
			if (err) {
				return cb(err.toString());
			}

			var object = {publicKey: keypair.publicKey.toString('hex'), secret: body.secret, slotNum: slots.getSlotNumber()};
			privated.delegateSecretList.push(object);
			cb(null, {txHash: '0x' + transaction[0].hash});
		});
	});
};

shared.voteDelegate = function (req, cb) {
	privated.active = true;
	var body = req.body;
	library.scheme.validate(body, {
		type: "object",
		properties: {
			secret: {
				type: "string",
				minLength: 1,
				maxLength: 100
			},
			publicKey: {
				type: "string",
				format: "publicKey"
			},
			votesList: {
				type: "array",
				format: "votesList"
			}
		},
		required: ["secret", "votesList"]
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		var hash = crypto.createHash('sha256').update(body.secret, 'utf8').digest();
		var keypair = ed.MakeKeypair(hash);

		if (body.publicKey && keypair.publicKey.toString('hex') != body.publicKey) {
			privated.active = false;
			return cb("Invalid passphrase");
		}

		library.sequence.add(function (cb) {
			try {
				var transaction = library.logic.transaction.create({
					type: TransactionTypes.VOTE,
					senderPublicKey: keypair.publicKey.toString('hex'),
					keypair: keypair,
					votesList: body.votesList
				});
			} catch (e) {
				return cb(e.toString());
			}
			library.logger.debug('delegates模块成功创建交易：type=' + transaction.type + ', hash=' + transaction.hash);
			modules.transactions.receiveTransactions([transaction], cb);
		}, function (err, transaction) {
			privated.active = false;
			if (err) {
				return cb(err.toString());
			}
			cb(null, {txHash: '0x' + transaction[0].hash});
		});
	});
};

// Export
module.exports = Delegates;
