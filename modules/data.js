var	Router = require('../helpers/router.js');
var	utils = require('../helpers/utils.js');
var TransactionTypes = require('../helpers/transaction-types.js');
var	crypto = require('crypto');
var ed = require('ed25519');
var async = require('async');
var ByteBuffer = require("bytebuffer");
var	slots = require('../helpers/slots.js');

var modules, library, self, privated = {}, shared = {};

// UPLOAD_DATA交易类型的asset定义如下：
// {dataHash: 32字节Buffer, dataType: integer, dataAmount: integer, reward: integer}
function UploadData() {
	this.create = function (param, trs) {
		trs.amount = 0;
		trs.asset.dataHash = param.dataHash;
		trs.asset.dataType = param.dataType;
		trs.asset.dataAmount = param.dataAmount;
		trs.asset.reward = Math.floor(param.dataAmount * 0.1);	 //* constants.fixedPoint);
		return trs;
	};

	this.calculateFee = function (trs) {
		return 1;	// * constants.fixedPoint;
	};

	this.verify = function (trs, cb) {
		setImmediate(cb, null, trs);
	};

	this.process = function (trs, cb) {
		if (trs.amount !== 0) {
			return setImmediate(cb, "Invalid transaction amount");
		}

		if (!trs.asset || !utils.isHashString(trs.asset.dataHash)
			|| !utils.isInteger(trs.asset.dataType)
			|| !utils.isInteger(trs.asset.dataAmount)
			|| !utils.isInteger(trs.asset.reward))
		{
			return setImmediate(cb, "Invalid transaction asset");
		}

		// 判断数据hash是否已存在于待确认交易列表中的其他交易中
		if (library.modules.transactions.checkDataHashExistInUnconfirmedList(trs.asset.dataHash)) {
			return setImmediate(cb, "Data hash already exists in unconfirmed tx list");
		}

		var param = {dataHash: trs.asset.dataHash};
		library.mongoDb.getDataUploadRecordByDataHash(param, function(err, res) {
			if (err) {
				return setImmediate(cb, err);
			}

			if (res) {
				return setImmediate(cb, "Data hash already exists in db");
			}
			cb(null, trs);
		});
	};

	this.getBytes = function (trs) {
		// 这是省事的处理方式，其实也确实没必要太在意多消耗这一点内存
		// 这个处理方式以后还是改掉比较好，毕竟JSON字符串里面有空格的话不影响意义，但是字节码就不一样了
		// try {
		// 	var buf = new Buffer(JSON.stringify(trs.asset), 'utf8');
		// } catch (e) {
		// 	throw Error(e.toString());
		// }
		// return buf;

		// dataHash 32字节，dataType 4字节，dataAmount 8字节，reward 8字节
		var bb = new ByteBuffer(32 + 4 + 8 + 8, true);
		var dataHashBuffer = Buffer.from(trs.asset.dataHash, 'hex');		// 占32个字节
		for (var i = 0; i < dataHashBuffer.length; i++) {
			bb.writeByte(dataHashBuffer[i]);
		}
		bb.writeInt(trs.asset.dataType);
		bb.writeLong(trs.asset.dataAmount);
		bb.writeLong(trs.asset.reward);
		bb.flip();
		return bb.toBuffer();
	};

	this.apply = function (trs, cb) {
		var param = {publicKey: trs.senderPublicKey, addAmount: trs.asset.reward};
		library.logic.account.dlbBalanceAdd(param, function(err, res) {
			if (err) {
				return cb(err);
			}
			cb(null, trs);
		});
	};

	this.undo = function (trs, cb) {
		var param = {publicKey: trs.senderPublicKey, addAmount: -trs.asset.reward};
		library.logic.account.dlbBalanceAdd(param, function(err, res) {
			if (err) {
				return cb(err);
			}
			cb(null, trs);
		});
	};

	this.applyUnconfirmed = function (trs, cb) {
		cb(null, trs);
	};

	this.undoUnconfirmed = function (trs, cb) {
		cb(null, trs);
	};

	this.ready = function (trs) {
		return trs.timestamp == 0 || slots.getSlotNumber(trs.timestamp) < slots.getSlotNumber();	//true;
	};
}

function UseData() {
	this.create = function (param, trs) {
		trs.amount = 0;
		trs.asset.useDataList = [];
		for (i in param.useDataList) {
			var useDataItem = {};
			useDataItem.dataHash = param.useDataList[i].dataHash;
			useDataItem.reward = param.useDataList[i].reward;
			trs.asset.useDataList.push(useDataItem);
		}
		return trs;
	};

	this.calculateFee = function (trs) {
		return 1;	// * constants.fixedPoint;
	};

	this.verify = function (trs, cb) {
		setImmediate(cb, null, trs);
	};

	this.process = function (trs, cb) {
		async.series([function(cb) {
			if (trs.amount !== 0) {
				return setImmediate(cb, "Invalid transaction amount");
			}

			if (!trs.asset.useDataList || trs.asset.useDataList.length <= 0) {
				return setImmediate(cb, "Invalid use data list");
			}

			cb();
		}, function(cb) {
			async.eachSeries(trs.asset.useDataList, function(useDataItem, cb) {
				if (!utils.isHashString(useDataItem.dataHash)) {
					return cb('Invalid use data hash:' + useDataItem.dataHash);
				}

				library.mongoDb.getDataUploadRecordByDataHash(useDataItem, function(err, res) {
					if (err) {
						return setImmediate(cb, err);
					}

					if (!res || res.length <= 0) {
						return setImmediate(cb, 'Invalid use data hash:' + useDataItem.dataHash);
					}

					cb();
				});
			}, function(err) {
    			if (err) {
					return cb(err);
				}
				cb();
			});
		}, function(cb) {
			var rewardSum = 0
			for (i in trs.asset.useDataList) {
				var useDataItem = trs.asset.useDataList[i];
				if (useDataItem.reward <= 0) {
					return setImmediate(cb, "Invalid use data reward: " + useDataItem.reward);
				}
				rewardSum += useDataItem.reward;
			}

			var param = {publicKey: trs.senderPublicKey};
			library.logic.account.getTransferableBalance(param, function(err, res) {
				if (err) {
					return cb(err);
				}

				if (res < rewardSum) {
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
		// 	var buf = new Buffer(JSON.stringify(trs.asset.useDataList), 'utf8');
		// } catch (e) {
		// 	throw Error(e.toString());
		// }
		// return buf;

		var bb = new ByteBuffer(trs.asset.useDataList.length * 40, true);
		for (var i = 0; i < trs.asset.useDataList.length; i++) {
			var dataHashBuffer = Buffer.from(trs.asset.useDataList[i].dataHash, 'hex');		// 占32个字节
			for (var j = 0; j < dataHashBuffer.length; j++) {
				bb.writeByte(dataHashBuffer[j]);
			}
			bb.writeLong(trs.asset.useDataList[i].reward);
		}
		bb.flip();
		return bb.toBuffer();
	};

	this.apply = function (trs, cb) {
		async.eachSeries(trs.asset.useDataList, function(useDataItem, cb) {
			library.mongoDb.getDataUploadRecordByDataHash(useDataItem, function(err, res) {
				if (err) {
					return setImmediate(cb, err);
				}

				if (!res || res.length <= 0) {
					return setImmediate(cb, 'Invalid use data hash:' + useDataItem.dataHash);
				}
				var recipientPublicKey = res.senderPublicKey;

				var param = {publicKey: trs.senderPublicKey, addAmount: -useDataItem.reward};
				library.logic.account.dlbBalanceAdd(param, function(err, res) {
					if (err) {
						return cb(err);
					}

					var param2 = {publicKey: recipientPublicKey, addAmount: useDataItem.reward};
					library.logic.account.dlbBalanceAdd(param2, function(err, res) {
						if (err) {
							return cb(err);
						}
						cb();
					});
				});
			});
		}, function(err) {
    		if (err) {
				return cb(err);
			}
			cb(null, trs);
		});
	};

	this.undo = function (trs, cb) {
		async.eachSeries(trs.asset.useDataList, function(useDataItem, cb) {
			library.mongoDb.getDataUploadRecordByDataHash(useDataItem, function(err, res) {
				if (err) {
					return setImmediate(cb, err);
				}

				if (!res || res.length <= 0) {
					return setImmediate(cb, 'Invalid use data hash:' + useDataItem.dataHash);
				}
				var recipientPublicKey = res.senderPublicKey;

				var param = {publicKey: recipientPublicKey, addAmount: -useDataItem.reward};
				library.logic.account.dlbBalanceAdd(param, function(err, res) {
					if (err) {
						return cb(err);
					}

					var param2 = {publicKey: trs.senderPublicKey, addAmount: useDataItem.reward};
					library.logic.account.dlbBalanceAdd(param2, function(err, res) {
						if (err) {
							return cb(err);
						}
						cb();
					});
				});
			});
		}, function(err) {
    		if (err) {
				return cb(err);
			}
			cb(null, trs);
		});
	};

	this.applyUnconfirmed = function (trs, cb) {
		cb(null, trs);
	};

	this.undoUnconfirmed = function (trs, cb) {
		cb(null, trs);
	};

	this.ready = function (trs) {
		return trs.timestamp == 0 || slots.getSlotNumber(trs.timestamp) < slots.getSlotNumber();	//true;
	};
}


// Constructor
function Data(cb, scope) {
	library = scope;
	self = this;
	self.__private = privated;
	privated.attachApi();

	library.logic.transaction.attachAssetType(TransactionTypes.UPLOAD_DATA, new UploadData());
	library.logic.transaction.attachAssetType(TransactionTypes.USE_DATA, new UseData());

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
		"get /getUploadDataRecords": "getUploadDataRecords",
		"get /getUseDataRecords": "getUseDataRecords",
		"get /fee": "getFee",
		"post /uploadData": "uploadData",
		"post /useData": "useData"
	});

	library.network.app.use('/api/data', router);
	library.network.app.use(function (err, req, res, next) {
		if (!err) return next();
		library.logger.error(req.url, err.toString());
		res.status(500).send({success: false, error: err.toString()});
	});
};

Data.prototype.sandboxApi = function (call, args, cb) {
	sandboxHelper.callMethod(shared, call, args, cb);
};

// Events
Data.prototype.onBind = function (scope) {
	modules = scope;
};

Data.prototype.onBlockchainReady = function (scope) {
	privated.loaded = true;
};

// 以后可以增加更多的查询方式，比如根据sender查询，或者根据dataType查询，但是暂时就做这么多
shared.getUploadDataRecords = function (req, cb) {
	privated.active = true;
	var query = req.body;
	library.scheme.validate(query, {
		type: "object",
		properties: {
			dataHash: {
				type: "string",
				format: "hash"
			}
		},
		required: ["dataHash"]
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function (cb) {
			library.mongoDb.getDataUploadRecordByDataHash(query, cb);
		}, function (err, res) {
			if (err) {
				privated.active = false;
				return cb(err.toString());
			}
			privated.active = false;
			cb(null, {dataUploadRecord: res});
		});
	});
}

shared.getUseDataRecords = function (req, cb) {
	privated.active = true;
	var query = req.body;
	library.scheme.validate(query, {
		type: 'object',
		properties: {
			dataHash: {
				type: "string",
				format: "hash"
			},
			limit: {
				type: "integer",
				minimum: 0,
			},
			offset: {
				type: "integer",
				minimum: 0
			},
			sortByTime: {
				type: "integer"		// 取值-1表示按照时间戳从大到小降序排列，1则表示升序排列
			}
		},
		required: ["dataHash"]
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function (cb) {
			library.mongoDb.getDataUseRecordByDataHash(query, cb);
		}, function (err, useDataRecList) {
			if (err) {
				privated.active = false;
				return cb(err.toString());
			}

			privated.active = false;
			cb(null, {useDataRecs: useDataRecList});
		});
		
	});
}

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
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		privated.active = false;
		var txType = query.txType.toLowerCase();
		if (txType == 'upload_data' || txType == 'uploaddata') {
			// cb(null, {fee: 1 * constants.fixedPoint});
			cb(null, {fee: 1});
		} else if (txType == 'use_data' || txType == 'usedata') {
			// cb(null, {fee: 1 * constants.fixedPoint});
			cb(null, {fee: 5});
		} else {
			cb('Invalid transaction type');
		}
	});
};

shared.uploadData = function (req, cb) {
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
			publicKey: {
				type: "string",
				format: "publicKey"
			},
			dataHash: {
				type: "string",
				format: "hash"
			},
			dataType: {
				type: "string"
			},
			dataAmount: {
				type: "string"
			}
		},
		required: ["secret", "dataHash", "dataType", "dataAmount"]
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
					type: TransactionTypes.UPLOAD_DATA,
					senderPublicKey: keypair.publicKey.toString('hex'),
					keypair: keypair,
					dataHash: body.dataHash,
					dataType: parseInt(body.dataType),
					dataAmount: parseInt(body.dataAmount)
				});
			} catch (e) {
				return cb(e.toString());
			}
			library.logger.debug('data模块成功创建交易：type=' + transaction.type + ', hash=' + transaction.hash);
			modules.transactions.receiveTransactions([transaction], cb);
		}, function (err, transactions) {
			privated.active = false;
			if (err) {
				return cb(err.toString());
			}

			cb(null, {txHash: '0x' + transactions[0].hash});
			// setTimeout(function() {cb(null, {txHash: '0x' + transactions[0].hash});}, 30000);
		});
	});
}

shared.useData = function (req, cb) {
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
			useDataList: {
				type: "array",
				format: "useDataList"
			}
		},
		required: ["secret", "useDataList"]
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
					type: TransactionTypes.USE_DATA,
					senderPublicKey: keypair.publicKey.toString('hex'),
					keypair: keypair,
					useDataList: body.useDataList
				});
			} catch (e) {
				return cb(e.toString());
			}
			library.logger.debug('data模块成功创建交易：type=' + transaction.type + ', hash=' + transaction.hash);
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

Data.prototype.cleanup = function (cb) {
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
module.exports = Data;
