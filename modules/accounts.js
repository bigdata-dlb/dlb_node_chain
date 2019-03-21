var crypto = require('crypto');
var	ed = require('ed25519');
var	slots = require('../helpers/slots.js');
var	Router = require('../helpers/router.js');
var	util = require('util');
var	constants = require('../helpers/constants.js');
var	TransactionTypes = require('../helpers/transaction-types.js');
var	util = require('util');
var	extend = require('extend');
var	sandboxHelper = require('../helpers/sandbox.js');
var randomstring = require("randomstring");

// private fields
var modules, library, self, privated = {}, shared = {};

// Constructor
function Accounts(cb, scope) {
	library = scope;
	self = this;
	self.__private = privated;
	privated.attachApi();

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
		"get /createAccount": "createAccount",
		"get /getDlbBalance": "getDlbBalance",
		"get /getTransferableBalance": "getTransferableBalance",
		"get /getVotesUsed": "getVotesUsed",
	});

	router.use(function (req, res, next) {
		res.status(500).send({success: false, error: "API endpoint was not found"});
	});

	library.network.app.use('/api/accounts', router);
	library.network.app.use(function (err, req, res, next) {
		if (!err) return next();
		library.logger.error(req.url, err.toString());
		res.status(500).send({success: false, error: err.toString()});
	});
};

// Events
Accounts.prototype.onBind = function (scope) {
	modules = scope;
};

Accounts.prototype.onBlockchainReady = function (scope) {
	privated.loaded = true;
};

// 2019年3月18日实际测试过，发现在一个网络请求还没有处理完毕时，一个模块的cleanup函数依然可以被执行
// 因此，广泛使用privated.active，保证数据的完整性，就很有必要
// 2019年3月19日同一天实际测试过，发现一个网络请求还没有处理完成的情况下，不妨碍node正确处理下一个客户端网络请求
shared.createAccount = function (req, cb) {
	privated.active = true;
	library.sequence.add(function(cb) {
		var secret = randomstring.generate({length: 88, readable: true, charset: 'alphanumeric'});
		var hash = crypto.createHash('sha256').update(secret, 'utf8').digest();
		var keypair = ed.MakeKeypair(hash);
		cb(null, {secret: secret, publicKey: keypair.publicKey.toString('hex')});
	}, function(err, account) {
		if (err) {
			privated.active = false;
			return cb(err.toString());
		}
		privated.active = false;
		cb(null, account);
	});
};

shared.getDlbBalance = function (req, cb) {
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
		required: ["publicKey"]
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function(cb) {
			library.logic.account.getDlbBalance(query, cb);
		}, function(err, num) {
			if (err) {
				privated.active = false;
				return cb(err.toString());
			}
			privated.active = false;
			cb(null, {dlbBalance: num});
		});
	});
};

shared.getVotesUsed = function (req, cb) {
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
		required: ["publicKey"]
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function(cb) {
			library.logic.account.getVotesUsed(query, cb);
		}, function(err, num) {
			if (err) {
				privated.active = false;
				return cb(err.toString());
			}
			privated.active = false;
			cb(null, {votesUsed: num});
		});
	});
};

shared.getTransferableBalance = function (req, cb) {
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
		required: ["publicKey"]
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function(cb) {
			library.logic.account.getTransferableBalance(query, cb);
		}, function(err, num) {
			if (err) {
				privated.active = false;
				return cb(err.toString());
			}
			privated.active = false;
			cb(null, {transferableBalance: num});
		});
	});
};

Accounts.prototype.cleanup = function (cb) {
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
module.exports = Accounts;
