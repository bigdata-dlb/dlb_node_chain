var ed = require('ed25519'),
	util = require('util'),
	crypto = require('crypto'),
	genesisblock = null,
	constants = require("../helpers/constants.js"),
	slots = require('../helpers/slots.js'),
	extend = require('extend'),
	Router = require('../helpers/router.js'),
	async = require('async'),
	TransactionTypes = require('../helpers/transaction-types.js'),
	sandboxHelper = require('../helpers/sandbox.js'),
	utils = require('../helpers/utils.js');

// private fields
var modules, library, self, privated = {}, shared = {};

privated.unconfirmedTransactions = [];
privated.unconfirmedTransactionsHashIndex = {};

function Transfer() {
	this.create = function (data, trs) {
		trs.asset.recipientPublicKey = data.recipientPublicKey;
		return trs;
	}

	this.calculateFee = function (trs) {
		return 1;	//library.logic.block.calculateFee();
	}

	this.verify = function (trs, cb) {
		cb(null, trs);
	}

	this.process = function (trs, cb) {
		if (!trs.asset || !utils.isPublicKeyString(trs.asset.recipientPublicKey)) {
			return cb("Invalid recipient");
		}

		if (trs.asset.recipientPublicKey.toString('hex') == trs.senderPublicKey.toString('hex')) {
			// console.log('SEND交易的发送者和接受者不能是同一个账户！！！');
			return cb("Sender and recipient is the same account");
		}

		this.scope.account.getDlbBalance({publicKey: trs.senderPublicKey}, function(err, res) {
			if (err) {
				return cb(err);
			}

			if (res < trs.amount + trs.fee) {
				// console.log('Sender账户的DLB余额不足');
				return cb('Insufficient dlb balance');
			}
			cb(null, trs);
		});
	}

	this.getBytes = function (trs) {
		return new Buffer(trs.asset.recipientPublicKey, 'hex');
	}

	this.apply = function (trs, cb) {
		var param = {publicKey:trs.asset.recipientPublicKey, addAmount: trs.amount};
		this.scope.account.dlbBalanceAdd(param, function (err) {
			if (err) {
				return cb(err);
			}
			cb();
		}.bind(this));
	}

	this.undo = function (trs, cb) {
		var param = {publicKey:trs.asset.recipientPublicKey, addAmount: -trs.amount};
		this.scope.account.dlbBalanceAdd(param, function (err) {
			if (err) {
				return cb(err);
			}
			cb();
		}.bind(this));
	}

	this.applyUnconfirmed = function (trs, cb) {
		setImmediate(cb);
	}

	this.undoUnconfirmed = function (trs, cb) {
		setImmediate(cb);
	}

	this.ready = function (trs) {
		return trs.timestamp == 0 || slots.getSlotNumber(trs.timestamp) < slots.getSlotNumber();	//true;
	}
}

// Constructor
function Transactions(cb, scope) {
	library = scope;
	genesisblock = library.genesisblock;
	self = this;
	self.__private = privated;
	privated.attachApi();

	// console.log("library.logic:" + JSON.stringify(library.logic));
	library.logic.transaction.attachAssetType(TransactionTypes.SEND, new Transfer());

	// privated.setInitAccounts();		// 这个仅在测试调试阶段使用
	// console.log('创世区块：' + JSON.stringify(library.genesisblock.block));

	setImmediate(cb, null, self);
}

// 这个仅在测试调试阶段使用
// privated.setInitAccounts = function() {
// 	var specialAccountsArray = require('../special-accounts.json');
// 	// 我的第一个账号secret，以后的创世区块的接收70亿个DLB的账号也是这个
// 	var myFirstSecret = specialAccountsArray.accounts[0];
// 	var myFirstPublicKey = utils.generatePublicKey(myFirstSecret);

// 	async.series([function(cb) {
// 		library.logic.account.deleteDelegateTable(cb);
// 	}, function(cb) {
// 		library.logic.account.deleteVoteTable(cb);
// 	}, function(cb) {
// 		library.logic.account.deleteDlbBalanceTable(cb);
// 	}, function(cb) {
// 		async.eachSeries(specialAccountsArray.accounts, function (secret, cb) {
// 			var param = {publicKey: utils.generatePublicKey(secret), dlbBalance: 100000000};
// 			library.logic.account.setDlbBalance(param, function(err, res) {
// 				if (err) {
// 					return cb(err);
// 				}
// 				cb();
// 			});
// 		}, function(err, res) {
// 			if (err) {
// 				return cb(err);
// 			}
// 			cb();
// 		});
// 	}], function(err, res) {
// 		if (err) {
// 			console.log(err);
// 			return;
// 		}

// 		library.logic.account.getDlbBalance({publicKey: myFirstPublicKey}, function(err, res) {
// 			if (err) {
// 				console.log(err);
// 				return;
// 			}
// 			console.log(myFirstPublicKey + "余额：" + res);
// 		});
// 	});
// }

// private methods
privated.attachApi = function () {
	var router = new Router();

	router.use(function (req, res, next) {
		if (modules && privated.loaded) return next();
		res.status(500).send({success: false, error: "Blockchain is loading"});
	});

	router.map(shared, {
		"get /get": "getTransaction",
		"get /unconfirmed/get": "getUnconfirmedTransaction",
		"get /unconfirmed": "getUnconfirmedTransactions",
		"post /": "addTransactions"
	});

	router.use(function (req, res, next) {
		res.status(500).send({success: false, error: "API endpoint not found"});
	});

	library.network.app.use('/api/transactions', router);
	library.network.app.use(function (err, req, res, next) {
		// if (!err) return next();
		if (err) {
			library.logger.error(req.url, err.toString());
			res.status(500).send({success: false, error: err.toString()});
		}
	});
};

// Public methods
Transactions.prototype.getUnconfirmedTransaction = function (hash) {
	var index = privated.unconfirmedTransactionsHashIndex[hash];
	return privated.unconfirmedTransactions[index];
};

// Blocks模块处理完成了一个block，就要更新待确认交易列表
Transactions.prototype.updateUnconfirmedListAfterProcessBlock = function (appliedTxHashArray) {
	var newUnconfirmedTxArray = [];
	var newUnconfirmedTxHashIndex = {};
	async.eachSeries(privated.unconfirmedTransactions, function(txObj, cb) {
		// appliedTxHashArray列表中的交易代表已被打包进block，所以不再在待确认交易列表中保留
		if (appliedTxHashArray.indexOf(txObj.hash) < 0) {
			// 超过20个slot仍然没有打包进block的send交易被丢弃
			if (TransactionTypes.SEND == txObj.type) {
				if (slots.getSlotNumber(txObj.timestamp) > slots.getSlotNumber() - 20) {
					library.logic.transaction.applyUnconfirmed(txObj, function(err) {
						if (!err) {
							newUnconfirmedTxArray.push(txObj);
							newUnconfirmedTxHashIndex[txObj.hash] = newUnconfirmedTxArray.length - 1;
						}
						cb();
					});
				}
			} else if (TransactionTypes.DELEGATE == txObj.type || TransactionTypes.VOTE == txObj.type) {
				// DELEGATE和VOTE两种交易类型只有属于当前slot的才需要保留
				if (slots.getSlotNumber(txObj.timestamp) == slots.getSlotNumber()) {
					library.logic.transaction.applyUnconfirmed(txObj, function(err) {
						if (!err) {
							newUnconfirmedTxArray.push(txObj);
							newUnconfirmedTxHashIndex[txObj.hash] = newUnconfirmedTxArray.length - 1;
						}
						cb();
					});
				}
			} else {
				// 两种DATA交易类型暂时全部保留未打包进block的，以后再考虑怎么进一步处理
				library.logic.transaction.applyUnconfirmed(txObj, function(err) {
					if (!err) {
						newUnconfirmedTxArray.push(txObj);
						newUnconfirmedTxHashIndex[txObj.hash] = newUnconfirmedTxArray.length - 1;
					}
					cb();
				});
			}
		} else {
			cb();
		}
	}, function(err) {
		if (!err) {
			privated.unconfirmedTransactions = newUnconfirmedTxArray;
			privated.unconfirmedTransactionsHashIndex = newUnconfirmedTxHashIndex;
			// library.logger.debug('新的待确认交易列表：' + JSON.stringify(privated.unconfirmedTransactions));
		}
	});
};

Transactions.prototype.getUnconfirmedTransactionList = function (reverse) {
	var a = [];
	for (var i = 0; i < privated.unconfirmedTransactions.length; i++) {
		if (privated.unconfirmedTransactions[i] !== false) {
			a.push(privated.unconfirmedTransactions[i]);
		}
	}
	return reverse ? a.reverse() : a;
};

Transactions.prototype.removeUnconfirmedTransaction = function (hash) {
	var index = privated.unconfirmedTransactionsHashIndex[hash];
	delete privated.unconfirmedTransactionsHashIndex[hash];
	privated.unconfirmedTransactions[index] = false;
};

Transactions.prototype.applyUnconfirmedList = function (hashList, cb) {
	async.eachSeries(hashList, function (hash, cb) {
		var transaction = self.getUnconfirmedTransaction(hash);
		self.applyUnconfirmed(transaction, function (err) {
			if (err) {
				self.removeUnconfirmedTransaction(hash);
			}
			setImmediate(cb);
		});
	}, cb);
};

Transactions.prototype.apply = function (transaction, cb) {
	library.logic.transaction.apply(transaction, cb);
};

Transactions.prototype.undo = function (transaction, cb) {
	library.logic.transaction.undo(transaction, cb);
};

Transactions.prototype.applyUnconfirmed = function (transaction, cb) {
	if (!transaction.senderPublicKey && transaction.blockHash != genesisblock.block.hash) {
		return cb("Invalid account");
	} else {
		library.logic.transaction.applyUnconfirmed(transaction, cb);
	}
};

Transactions.prototype.undoUnconfirmed = function (transaction, cb) {
	library.logic.transaction.undoUnconfirmed(transaction, cb);
};

Transactions.prototype.receiveTransactions = function (transactions, cb) {
	async.eachSeries(transactions, function (transaction, cb) {
		self.processUnconfirmedTransaction(transaction, true, cb);
	}, function (err) {
		// console.log('执行到了Transactions.prototype.receiveTransactions的cb函数');
		if (err) {
			// console.log('Transactions.prototype.receiveTransactions: err = ', err);
			return cb(err);
		}
		cb(null, transactions);
	});
};

Transactions.prototype.processUnconfirmedTransaction = function (transaction, broadcast, cb) {
	library.logic.transaction.process(transaction, function (err) {
		if (err) {
			return cb(err);
		}

		// Check in confirmed transactions
		if (privated.unconfirmedTransactionsHashIndex[transaction.hash] !== undefined) {
			console.log('交易已存在于待确认交易列表');
			return cb("Transaction already exists");
		}

		library.logic.transaction.verify(transaction, function (err) {
			if (err) {
				return cb(err);
			}

			privated.addUnconfirmedTransaction(transaction, function (err) {
				if (err) {
					return cb(err);
				}

				library.logger.debug('交易：type=' + transaction.type + ', hash=' + transaction.hash + ' 成功加入待确认交易列表');
				library.logger.info('交易成功加入待确认交易列表：' + JSON.stringify(transaction));

				if (broadcast) {
					library.modules.transport.broadcastTransaction(transaction, cb);
				} else {
					cb();
				}
			});
		});
	});
};

// 根据参数交易hash判断一个交易是否存在于待确认交易列表中
Transactions.prototype.checkTxExistInUnconfirmedList = function(txHash) {
	return privated.unconfirmedTransactionsHashIndex[txHash] !== undefined;
};

// 判断某个UPLOAD_DATA交易是否已存在于待确认交易列表中，交易hash可以不同，只需要dataHash相同，因为交易时间戳可以不同
Transactions.prototype.checkDataHashExistInUnconfirmedList = function(dataHash) {
	for (i in privated.unconfirmedTransactions) {
		var tx = privated.unconfirmedTransactions[i];
		if (tx.type == TransactionTypes.UPLOAD_DATA && tx.asset.dataHash == dataHash) {
			return true;
		}
	}
	return false;
};

privated.addUnconfirmedTransaction = function (transaction, cb) {
	library.logic.transaction.applyUnconfirmed(transaction, function (err) {
		if (err) {
			// self.addDoubleSpending(transaction);
			return cb(err);
		}

		privated.unconfirmedTransactions.push(transaction);
		var index = privated.unconfirmedTransactions.length - 1;
		privated.unconfirmedTransactionsHashIndex[transaction.hash] = index;
		// library.logger.debug("addUnconfirmedTransaction:unconfirmedTransactions: " + JSON.stringify(privated.unconfirmedTransactions));
		cb();
	});
};

Transactions.prototype.sandboxApi = function (call, args, cb) {
	sandboxHelper.callMethod(shared, call, args, cb);
};

// Events
Transactions.prototype.onBind = function (scope) {
	modules = scope;
};

Transactions.prototype.onBlockchainReady = function (scope) {
	privated.loaded = true;
};

// Shared
shared.getTransactions = function (req, cb) {
	privated.active = true;
	var query = req.body;
	library.scheme.validate(query, {
		type: "object",
		properties: {
			blockHash: {
				type: "string"
			},
			limit: {
				type: "integer",
				minimum: 0,
				maximum: 100
			},
			type: {
				type: "integer",
				minimum: 0,
				maximum: 10
			},
			orderBy: {
				type: "string"
			},
			offset: {
				type: "integer",
				minimum: 0
			},
			senderPublicKey: {
				type: "string",
				format: "publicKey"
			},
			recipientPublicKey: {
				type: "string",
				format: "publicKey"
			},
			amount: {
				type: "integer",
				minimum: 0,
				maximum: constants.fixedPoint
			},
			fee: {
				type: "integer",
				minimum: 0,
				maximum: constants.fixedPoint
			}
		}
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		privated.list(query, function (err, data) {
			if (err) {
				privated.active = false;
				return cb("Failed to get transactions");
			}

			privated.active = false;
			cb(null, {transactions: data.transactions, count: data.count});
		});
	});
};

shared.getTransaction = function (req, cb) {
	privated.active = true;
	var query = req.body;
	library.scheme.validate(query, {
		type: 'object',
		properties: {
			hash: {
				type: 'string',
				format: 'hash'
			}
		},
		required: ['hash']
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function(cb) {
			library.mongoDb.getTransactionFromDb({hash: query.hash}, cb);
		}, function(err, res) {
			if (err) {
				privated.active = false;
				return cb(err);
			}

			if (!res) {
				privated.active = false;
				return cb("Transaction not found");
			}

			privated.active = false;
			cb(null, {transaction: res});
		});
	});
};

shared.getUnconfirmedTransaction = function (req, cb) {
	privated.active = true;
	var query = req.body;
	library.scheme.validate(query, {
		type: 'object',
		properties: {
			hash: {
				type: 'string',
				format: "hash"
			}
		},
		required: ['hash']
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		var unconfirmedTransaction = self.getUnconfirmedTransaction(query.hash);
		if (!unconfirmedTransaction) {
			return cb("Transaction not found");
		}

		privated.active = false;
		cb(null, {transaction: unconfirmedTransaction});
	});
};

shared.getUnconfirmedTransactions = function (req, cb) {
	privated.active = true;
	var query = req.body;
	library.scheme.validate(query, {
		type: "object",
		properties: {
			senderPublicKey: {
				type: "string",
				format: "publicKey"
			},
			recipientPublicKey: {
				type: "string",
				format: "publicKey"
			}
		}
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		var transactions = self.getUnconfirmedTransactionList(true), toSend = [];

		if (query.senderPublicKey || query.recipientPublicKey) {
			for (var i = 0; i < transactions.length; i++) {
				if (transactions[i].senderPublicKey == query.senderPublicKey || transactions[i].recipientPublicKey == query.recipientPublicKey) {
					toSend.push(transactions[i]);
				}
			}
		} else {
			for (var i = 0; i < transactions.length; i++) {
				toSend.push(transactions[i]);
			}
		}

		privated.active = false;
		cb(null, {transactions: toSend});
	});
};

shared.addTransactions = function (req, cb) {
	privated.active = true;
	var body = req.body;
	library.scheme.validate(body, {
		type: "object",
		properties: {
			secret: {
				type: "string",
				minLength: 1,
				// maxLength: 100
			},
			amount: {
				type: "integer",
				minimum: 1,
				// maximum: constants.totalAmount
			},
			recipientPublicKey: {
				type: "string",
				format: "publicKey"
			},
			publicKey: {
				type: "string",
				format: "publicKey"
			}
		},
		required: ["secret", "amount", "recipientPublicKey"]
	}, function (err) {
		if (err) {
			// library.logger.debug('shared.addTransactions ---- 参数校验失败!!!');
			privated.active = false;
			return cb(err[0].message);
		}
		// library.logger.debug('shared.addTransactions ---- 参数校验成功!!!');

		var hash = crypto.createHash('sha256').update(body.secret, 'utf8').digest();
		var keypair = ed.MakeKeypair(hash);

		if (body.publicKey && keypair.publicKey.toString('hex') != body.publicKey) {
			// library.logger.debug('shared.addTransactions ---- secret和publicKey不匹配!!!');
			privated.active = false;
			return cb("Invalid secret or publicKey");
		}
		// library.logger.debug('shared.addTransactions ---- 顺利通过所有的参数检查!!!');

		library.sequence.add(function (cb) {
			try {
				var transaction = library.logic.transaction.create({
					type: TransactionTypes.SEND,
					amount: body.amount,
					senderPublicKey: keypair.publicKey.toString('hex'),
					recipientPublicKey: body.recipientPublicKey,
					keypair: keypair
				});
			} catch (e) {
				privated.active = false;
				return cb(e.toString());
			}

			library.logger.debug('transactions模块成功创建交易：type=' + transaction.type + ', hash=' + transaction.hash);
			modules.transactions.receiveTransactions([transaction], cb);
		}, function (err, transaction) {
			if (err) {
				privated.active = false;
				return cb(err);
			}
			privated.active = false;
			cb(null, {txHash: '0x' + transaction[0].hash});
		});
	});
};

Transactions.prototype.cleanup = function (cb) {
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
module.exports = Transactions;
