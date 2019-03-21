var ed = require('ed25519'),
	util = require('util'),
	crypto = require('crypto'),
	constants = require("../helpers/constants.js"),
	slots = require('../helpers/slots.js'),
	extend = require('extend'),
	Router = require('../helpers/router.js'),
	async = require('async'),
	TransactionTypes = require('../helpers/transaction-types.js'),
	sandboxHelper = require('../helpers/sandbox.js'),
	myUtils = require('../helpers/utils.js');

var	genesisblock = null;
var modules, library, self, privated = {}, shared = {};

privated.tipBlock = {};						// 记录最近一个处理完成已加入数据库表中的block
privated.legalBlockGenerator = null;		// 根据DPOS算法计算出的下一个block的合法generator
privated.specialDelegates = [];


function Blocks(cb, scope) {
	library = scope;
	genesisblock = library.genesisblock;
	self = this;
	self.__private = privated;
	privated.attachApi();

	privated.saveGenesisBlock(function (err) {
		setImmediate(cb, err, self);
	});
}

privated.attachApi = function () {
	var router = new Router();

	router.use(function (req, res, next) {
		if (modules && privated.loaded) return next();
		res.status(500).send({success: false, error: "Blockchain is loading"});
	});

	router.map(shared, {
		"get /getBlockByHeight": "getBlockByHeight",
		"get /getBlockAsync": "getBlockAsync",
		// "post /generateBlock": "generateBlock"	// 测试阶段使用，调试组块和块解析
	});

	router.use(function (req, res, next) {
		res.status(500).send({success: false, error: "API endpoint not found"});
	});

	library.network.app.use('/api/blocks', router);
	library.network.app.use(function (err, req, res, next) {
		if (!err) return next();
		library.logger.error(req.url, err.toString());
		res.status(500).send({success: false, error: err.toString()});
	});
}

function findTxByHash(block, txHash) {
	if (util.isArray(block.txArray) && block.txArray.length > 0) {
		for (i in block.txArray) {
			if (txHash === block.txArray[i].hash) {
				return block.txArray[i];
			}
		}
	}

	var unconfirmedTransactions = modules.transactions.getUnconfirmedTransactionList();
	if (unconfirmedTransactions.length > 0) {
		for (i in unconfirmedTransactions) {
			if (txHash === unconfirmedTransactions[i].hash) {
				return unconfirmedTransactions[i];
			}
		}
	}
	return null;
}

privated.saveBlock = function (block, cb) {
	var block2Save = {version: block.version, timestamp: block.timestamp, height: block.height,
			numberOfTransactions: block.numberOfTransactions, payloadLength: block.payloadLength,
			totalAmount: block.totalAmount, totalFee: block.totalFee, reward: block.reward,
			payloadHash: block.payloadHash, generatorPublicKey: block.generatorPublicKey,
			blockSignature: block.blockSignature, hash: block.hash, previousBlockHash: block.previousBlockHash,
			txHashArray: block.txHashArray
		};

	if (!util.isArray(block2Save.txHashArray) || block2Save.txHashArray.length <= 0) {
		block2Save.txHashArray = [];
		if (util.isArray(block.txArray) && block.txArray.length > 0) {
			for (i in block.txArray) {
				block2Save.txHashArray.push(block.txArray[i].hash);
			}
		}
	}

	// console.log('saveBlock -- block2Save: ' + JSON.stringify(block2Save));

	library.mongoDb.saveBlockInDb(block2Save, function (err, res) {
		if (err) {
			library.logger.error('blocks module: saveBlock: ', err);
			return cb(err);
		}

		async.eachSeries(block2Save.txHashArray, function (txHash, cb) {
			var txObj = findTxByHash(block, txHash);
			if (!txObj) {
				return cb('Can not find transaction by hash: ' + txHash);
			}

			txObj.blockHash = block2Save.hash;
			// if (block.height == 0) {
				library.mongoDb.saveTransactionInDb(txObj, cb);
			// } else {
			// 	cb();
			// }
		}, function (err) {
			if (err) {
				library.logger.error('blocks module: saveBlock: ', err);
				return cb(err);
			}
			cb(null, block);
		});
	});
}

privated.saveGenesisBlock = function (cb) {
	library.mongoDb.getBlockFromDb({height: 0, onlyCheckExist: true}, function(err, res) {
		if (err) {
			return cb(err);
		}
		var genesisBlockExist = res;
		if (!genesisBlockExist) {
			privated.saveBlock(genesisblock.block, cb);
		} else {
			library.logger.debug('创世区块已存在于数据库blocks表中！！！！！！');
			cb();
		}
	});
}

shared.getBlockByHeight = function (req, cb) {
	privated.active = true;
	var query = req.body;
	library.scheme.validate(query, {
		type: "object",
		properties: {
			height: {
				type: 'integer',
				minimum: 1
			},
			withAllTx: {
				type: 'integer',
			}
		},
		required: ["height"]
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		library.sequence.add(function (cb) {
			library.mongoDb.getBlockFromDb(query, function(err, block) {
				if (err) {
					return cb(err);
				}

				if (!block) {
					return cb("Block not found");
				}

				if (query.withAllTx <= 0) {
					cb(null, {block: block});
				} else {
					block.txArray = [];
					async.eachSeries(block.txHashArray, function(txHash, cb) {
						library.mongoDb.getTransactionFromDb({hash: txHash}, function(err, res) {
							if (err) {
								return cb(err);
							}
							block.txArray.push(res);
							cb();
						});
					}, function(err, res) {
						if (err) {
							return cb(err);
						}

						cb(null, {block: block});
					});
				}
			});
		}, function(err, res) {
			privated.active = false;
			if (err) {
				return cb(err)
			}
			cb(null, res);
		});
	});
}

// 要求get请求的接收者把指定的block以http post的方式传回给我，并且带上txHashArray中的hash对应的交易的完整对象
shared.getBlockAsync = function (req, cb) {
	privated.active = true;
	var query = req.body;
	library.scheme.validate(query, {
		type: "object",
		properties: {
			hash: {
				type: "string",
				format: "hash"
			},
			height: {
				type: "integer"
			},
			txHashArray: {
				type: "array",
				format: "hashArray"
			}
		},
		required: ["hash"]
	}, function (err) {
		if (err) {
			privated.active = false;
			return cb(err[0].message);
		}

		// cb(null, {acknowledge: 'OK'});

		library.sequence.add(function (cb) {
			var param = {hash: query.hash};
			library.mongoDb.getBlockFromDb(param, function(err, block) {
				if (err) {
					return cb(err);
				}

				if (!block) {
					return cb("Block not found");
				}

				if (myUtils.isInteger(block.height) && block.height != query.height) {
					return cb("Block height in DB does not match the query parameter");
				}

				library.mongoDb.getTxHashArrayByBlockHash({blockHash: block.hash}, function(err, res) {
					if (err) {
						return cb(err);
					}
					block.txHashArray = res;

					if (myUtils.isHashArray(query.txHashArray) && query.txHashArray.length > 0) {
						var txArray = [];
						async.eachSeries(query.txHashArray, function(txHash, cb) {
							library.mongoDb.getTransactionFromDb({hash: txHash}, function(err, res) {
								if (err) {
									return cb(err);
								}
								txArray.push(res);
								cb();
							})
						}, function(err) {
							if (err) {
								return cb(err);
							}
							block.txArray = txArray;
							cb(null, {block: block});
						});
					} else {
						cb(null, {block: block});
					}
				});
			});
		}, function(err, res) {
			if (err) {
				library.logger.error('getBlockAsync: ', err);
				privated.active = false;
				return cb(err);
			}

			// var peerIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
			// var peerPort = parseInt(req.headers.port);
			// myUtils.httpPost({host: peerIp, port: peerPort, path: '/api/transport/newBlock'}, block, function(resData) {
			// 	library.logger.debug('getBlockAsync: ', resData);
			// });

			privated.active = false;
			// cb(null, {acknowledgement: 'OK'});
			cb(null, res);
		});
	});
}

// Blocks.prototype.getTipBlock = function () {
// 	return privated.tipBlock;
// }

Blocks.prototype.onEnterNewSlot = function () {

	// 稍微延迟一下，防止不同节点机器之间时间毫秒数有些微差异
	setTimeout(function() {
		library.sequence.add(function(cb) {
			// 暂时实行谦让制，以后再考虑优化
			if (privated.tipBlock.height < slots.getSlotNumber()) {
				var blockGenerator = privated.legalBlockGenerator;
				if (blockGenerator && blockGenerator.publicKey) {
					var blockGeneratorSecret = modules.delegates.getSecretByPublicKey(blockGenerator.publicKey);
					library.logger.info('Blocks.prototype.onEnterNewSlot -- blockGeneratorSecret: ' + blockGeneratorSecret);
					if (blockGeneratorSecret) {
						var hash = crypto.createHash('sha256').update(blockGeneratorSecret, 'utf8').digest();
						var keypair = ed.MakeKeypair(hash);
						self.generateBlock(keypair, cb);
					} else {
						cb();
					}
				} else {
					cb();
				}
			} else {
				cb();
			}
		}, function(err, res) {
			if (err) {
				library.logger.error('Blocks模块：创建block遭遇严重错误 -- 1：', err);
				return process.exit(0);
			}
		});
	}, 1000);

	setTimeout(function() {
		library.sequence.add(function(cb) {
			if (library.config.special_accounts.length == constants.delegatesNum
				&& privated.tipBlock.height < slots.getSlotNumber())
			{
				var index = slots.getSlotNumber() % constants.delegatesNum;
				var hash = crypto.createHash('sha256').update(library.config.special_accounts[index], 'utf8').digest();
				var keypair = ed.MakeKeypair(hash);
				self.generateBlock(keypair, cb);
			} else {
				cb();
			}
		}, function(err, res) {
			if (err) {
				library.logger.error('Blocks模块：创建block遭遇严重错误 -- 2：', err);
				return process.exit(0);
			}
		});
	}, constants.slots.interval * 1000 / 2);

	// 时间已过去一个slot的三分之二仍然没有获得最新的block，就主动到peer去获取
	setTimeout(function loadLatestBlockFromPeer() {
		library.sequence.add(function(cb) {
			var currSlotNumber = slots.getSlotNumber();
			if (privated.tipBlock.height < currSlotNumber)
			{
				// if (privated.tipBlock.height < currSlotNumber - 1) {
				// 	library.logger.error('Blocks模块：这种情况不允许发生！！！');
				// 	return process.exit(0);
				// }

				var peer = library.config.peers.peerList[0];
				var url = '/api/blocks/getBlockByHeight?withAllTx=1&height=' + currSlotNumber;
				myUtils.httpGet(peer.host, peer.port, url, function(data) {
					library.logger.info('Blocks模块： -- data: ', data);
					var dataObj = JSON.parse(data);
					if (dataObj.success === true) {
						var blockObj = dataObj.block;
						modules.blocks.processBlock(blockObj, true, cb);
					} else {
						cb('loadLatestBlockFromPeer fail');
					}
				});
			} else {
				library.logger.info('Blocks模块：当前已获得最新Block，不需从peer处加载');
				cb();
			}
		}, function(err, res) {
			var currSlotNumber = slots.getSlotNumber();
			if (err || privated.tipBlock.height < currSlotNumber) {
				setTimeout(loadLatestBlockFromPeer, 100);
			}
		});
	}, constants.slots.interval * 2 * 1000 / 3);
}

// shared.generateBlock = function (req, cb) {
// 	var body = req.body;
// 	library.scheme.validate(body, {
// 		type: "object",
// 		properties: {
// 			secret: {
// 				type: "string",
// 				minLength: 1,
// 				maxLength: 100
// 			},
// 			publicKey: {
// 				type: "string",
// 				format: "publicKey"
// 			}
// 		},
// 		required: ["secret"]
// 	}, function (err) {
// 		if (err) {
// 			return cb(err[0].message);
// 		}
// 		library.logger.debug('shared.generateBlock ---- 参数校验成功!!!');

// 		var hash = crypto.createHash('sha256').update(body.secret, 'utf8').digest();
// 		var keypair = ed.MakeKeypair(hash);

// 		if (body.publicKey) {
// 			if (keypair.publicKey.toString('hex') != body.publicKey) {
// 				library.logger.debug('shared.generateBlock ---- secret和publicKey不匹配!!!');
// 				return cb("Invalid secret or publicKey");
// 			}
// 		}

// 		library.sequence.add(function (cb) {
// 			library.modules.blocks.generateBlock(keypair, cb);
// 		}, function(err, block) {
// 			if (err) {
// 				library.logger.error('shared.generateBlock: ', err);
// 				return cb(err);
// 			}
// 			cb(null, block);	//'BLOCK: ' + JSON.stringify(block));
// 		});
// 	});
// }

Blocks.prototype.generateBlock = function (keypair, cb) {
	privated.active = true;
	var transactions = modules.transactions.getUnconfirmedTransactionList();
	library.logger.debug('Blocks.prototype.generateBlock -- 待确认交易列表：' + JSON.stringify(transactions));
	var ready = [];
	async.eachSeries(transactions, function(transaction, cb) {
		if (library.logic.transaction.ready(transaction)) {
			library.logic.transaction.verify(transaction, function (err) {
				if (!err) {
					ready.push(transaction);
				} else {
					library.logger.info('Blocks.prototype.generateBlock -- 交易verify失败：' + JSON.stringify(transaction));
				}
				cb();
			});
		} else {
			library.logger.info('Blocks.prototype.generateBlock -- 交易ready失败：' + JSON.stringify(transaction));
			cb();
		}
	}, function() {
		try {
			var block = library.logic.block.create({
				keypair: keypair,
				timestamp: slots.getTime(),
				previousBlock: privated.tipBlock,
				txArray: ready
			});
		} catch (e) {
			privated.active = false;
			return cb(e);
		}

		library.logger.info('Blocks.prototype.generateBlock -- block: ' + JSON.stringify(block));

		var block2Process = {version: block.version, timestamp: block.timestamp, height: block.height,
			numberOfTransactions: block.numberOfTransactions, payloadLength: block.payloadLength,
			totalAmount: block.totalAmount, totalFee: block.totalFee, reward: block.reward,
			payloadHash: block.payloadHash, generatorPublicKey: block.generatorPublicKey,
			blockSignature: block.blockSignature, hash: block.hash, previousBlockHash: block.previousBlockHash,
			txHashArray: []
		};

		for (i in block.txArray) {
			block2Process.txHashArray.push(block.txArray[i].hash)
		}
		
		library.logger.debug('Block2Process: ' + JSON.stringify(block2Process));
		self.processBlock(block2Process, true, function(err, res) {
			privated.active = false;
			if (err) {
				return cb(err);
			}
			cb(null, block2Process);
		});
	});
}

// 暂时没有考虑分叉，但是DPOS理论上不存在分叉，不表示实际上没有
// Blocks.prototype.receiveBlock = function(block, cb) {
// 	library.sequence.add(function (cb) {
// 		self.processBlock(block, true, cb);
// 	}, function(err, res) {
// 		if (err) {
// 			return cb(err);
// 		}
// 		cb(null, {blockHash: '0x' + block.hash});
// 	});
// }

Blocks.prototype.loadLocalBlock = function (block, needSave, cb) {
	if (block.height != 0 && block.previousBlockHash != privated.tipBlock.hash) {
		return setImmediate(cb, "Can't verify previous block: " + block.hash);
	}

	var blockSlotNumber = slots.getSlotNumber(block.timestamp);
	if (blockSlotNumber != block.height) {
		return setImmediate(cb, "Invalid block height: " + block.hash);
	}
	library.logger.debug("Block高度校验成功！");

	// 暂时先不做，以后再完善
	// if (block.height != 0 && privated.legalBlockGenerator !== block.generatorPublicKey) {
	// 	return setImmediate(cb, "Invalid block generator");
	// }
	// library.logger.debug("Block generator校验成功！");

	var expectedReward = 100;		//privated.milestones.calcReward(block.height);
	if (block.height != 0 && expectedReward !== block.reward) {
		return setImmediate(cb, "Invalid block reward");
	}
	library.logger.debug("Block奖励校验成功！");

	if (block.payloadLength > constants.maxPayloadLength) {
		return setImmediate(cb, "Can't verify payload length of block: " + block.hash);
	}
	library.logger.debug("Block载荷校验成功！");

	if (block.txHashArray.length != block.numberOfTransactions) {
		return setImmediate(cb, "Invalid amount of block transactions: " + block.hash);
	}
	library.logger.debug("Block交易数校验成功！");

	var valid = library.logic.block.verifySignature(block);
	if (!valid) {
		return setImmediate(cb, "Can't verify signature: " + block.hash);
	}
	library.logger.debug("Block签名校验成功！");

	var totalAmount = 0, totalFee = 0, payloadHash = crypto.createHash('sha256');
	async.eachSeries(block.txHashArray, function (txHash, cb) {
		var txObj = findTxByHash(block, txHash);
		if (!txObj) {
			return cb('Can not find transaction by hash: ' + txHash);
		}

		var bytes = library.logic.transaction.getBytes(txObj, false, false);
		payloadHash.update(bytes);
		totalAmount += txObj.amount;
		totalFee += txObj.fee;
		cb();
	}, function(err) {
		if (err) {
			return cb(err);
		}

		if (block.height != 0 && payloadHash.digest().toString('hex') !== block.payloadHash) {
			return cb("Invalid payload hash: " + block.hash);
		}
		library.logger.debug("Block载荷hash校验成功！");

		if (totalAmount != block.totalAmount) {
			return cb("Invalid total amount: " + block.hash);
		}
		library.logger.debug("Block total amount校验成功！");

		if (totalFee != block.totalFee) {
			return cb("Invalid total fee: " + block.hash);
		}
		library.logger.debug("Block total fee校验成功！");

		async.eachSeries(block.txHashArray, function (txHash, cb) {
			var txObj = findTxByHash(block, txHash);
			if (!txObj) {
				return cb('Can not find transaction by hash: ' + txHash);
			}

			library.logic.transaction.verify(txObj, function(err) {
				if (err) {
					return cb(err);
				}
				library.logger.debug("交易verify成功：" + txObj.hash);

				library.logic.transaction.apply(txObj, function(err) {
					if (err) {
						return cb(err);
					}
					library.logger.debug("交易apply成功：" + txObj.hash);

					// 组块的后备特殊账号，单独保存下来
					if (block.height == 0 && txObj.type == TransactionTypes.DELEGATE) {
						privated.specialDelegates.push(txObj.senderPublicKey);
					}
					cb();
				});
			});
		}, function(err) {
			if (err) {
				return cb(err);
			}
			library.logger.debug("全部交易apply成功");
						
			// privated.legalBlockGenerator = privated.computeNextBlockGenerator();
			privated.tipBlock = block;
						
			// generator的DLB余额要加上reward
			var param = {publicKey:block.generatorPublicKey, addAmount: block.reward};
			library.logic.account.dlbBalanceAdd(param, function (err) {
				if (err) {
					return cb(err);
				}

				if (needSave) {
					privated.saveBlock(block, function (err) {
						if (err) {
							library.logger.error("保存区块到数据库失败：", err);
							return cb(err);
						}
						library.logger.debug("保存区块到数据库成功 - 2：" + block.hash);
						// process.exit(-1);
						cb(null, block);
					});
				} else {
					cb(null, block);
				}
			});
		});
	});
}

// Block: {"version":0,"totalAmount":0,"totalFee":0,"reward":100,
// 	"payloadHash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","timestamp":84944080,
// 	"numberOfTransactions":0,"payloadLength":0,"previousBlockHash":null,"transactions":[],
// 	"generatorPublicKey":"451a74ca0225c3c99e5481ff22b5c265092a5129123e7621cc50e1048743dc6e",
//	"blockSignature":"53955db0b5fa155c2430bba6516a10a840cfb225012db347d08a6d3151388c810243a2821b190997b1d286324bc1abb39b2e118bcada50ae99a45b97e25ce00d"} 
Blocks.prototype.processBlock = function (block, broadcast, cb) {
	if (block.previousBlockHash != privated.tipBlock.hash) {
		// Fork same height and different previous block
		// modules.delegates.fork(block, 1);
		return setImmediate(cb, "Can't verify previous block: " + block.hash);
	}

	var blockSlotNumber = slots.getSlotNumber(block.timestamp);
	var lastBlockSlotNumber = slots.getSlotNumber(privated.tipBlock.timestamp);
	library.logger.debug('slots.getSlotNumber(): ', slots.getSlotNumber());
	library.logger.debug('blockSlotNumber: ', blockSlotNumber);
	library.logger.debug('lastBlockSlotNumber: ', lastBlockSlotNumber);
	if (blockSlotNumber > slots.getSlotNumber() || blockSlotNumber <= lastBlockSlotNumber) {
		return setImmediate(cb, "Can't verify block timestamp: " + block.hash);
	}
	library.logger.debug("Block时间戳校验成功！");

	if (blockSlotNumber != block.height) {
		return setImmediate(cb, "Invalid block height: " + block.hash);
	}
	library.logger.debug("Block高度校验成功！");

	privated.legalBlockGenerator = block.generatorPublicKey;		// 调试阶段临时改成这样
	if (block.height != 0 && privated.legalBlockGenerator !== block.generatorPublicKey) {
		return setImmediate(cb, "Invalid block generator");
	}
	library.logger.debug("Block generator校验成功！");

	var expectedReward = 100;		//privated.milestones.calcReward(block.height);
	if (block.height != 0 && expectedReward !== block.reward) {
		return setImmediate(cb, "Invalid block reward");
	}
	library.logger.debug("Block奖励校验成功！");

	if (block.payloadLength > constants.maxPayloadLength) {
		return setImmediate(cb, "Can't verify payload length of block: " + block.hash);
	}
	library.logger.debug("Block载荷校验成功！");

	if (block.txHashArray.length != block.numberOfTransactions) {
		return setImmediate(cb, "Invalid amount of block transactions: " + block.hash);
	}
	library.logger.debug("Block交易数校验成功！");

	var valid = library.logic.block.verifySignature(block);
	if (!valid) {
		return setImmediate(cb, "Can't verify signature: " + block.hash);
	}
	library.logger.debug("Block签名校验成功！");

	var totalAmount = 0, totalFee = 0, payloadHash = crypto.createHash('sha256');
	async.eachSeries(block.txHashArray, function (txHash, cb) {
		var txObj = findTxByHash(block, txHash);
		if (!txObj) {
			return cb('Can not find transaction by hash: ' + txHash);
		}

		var bytes = library.logic.transaction.getBytes(txObj, false, false);
		payloadHash.update(bytes);
		totalAmount += txObj.amount;
		totalFee += txObj.fee;
		cb();
	}, function(err) {
		if (err) {
			return cb(err);
		}

		var payloadHash2 = payloadHash.digest().toString('hex');
		console.log('计算得出的payloadHash：' + payloadHash2);
		console.log('block本身的payloadHash：' + block.payloadHash);
		if (payloadHash2 !== block.payloadHash) {
			return cb("Invalid payload hash: " + block.hash);
		}
		library.logger.debug("Block载荷hash校验成功！");

		if (totalAmount != block.totalAmount) {
			return cb("Invalid total amount: " + block.hash);
		}
		library.logger.debug("Block total amount校验成功！");

		if (totalFee != block.totalFee) {
			return cb("Invalid total fee: " + block.hash);
		}
		library.logger.debug("Block total fee校验成功！");

		// 这里暂时先假定每个步骤都不会出错，实际上在实验环境下出错的几率也是微乎其微的
		// 但是在以后的多节点实际运行环境下，出错的可能性永远存在，而且不一定很小
		// 到时候需要认真考虑这里每一步出错时怎么恢复原状，以及从peer节点主动加载解析失败的block
		// modules.transactions.undoUnconfirmedList(function (err, unconfirmedTransactions) {

		// 待确认交易列表不颠倒顺序的话DPOS的undoUnconfirmed执行逻辑会有问题
		var unconfirmedTransactions2 = library.modules.transactions.getUnconfirmedTransactionList(true);
		async.eachSeries(unconfirmedTransactions2, function (transaction, cb) {
			library.logic.transaction.undoUnconfirmed(transaction, cb);
		}, function (err) {
			if (err) {
				return cb(err);
			}
			library.logger.debug("待确认交易列表全部执行undoUnconfirmed成功！");
			// return cb(null, block);

			var appliedTxHashArray = [];
			async.eachSeries(block.txHashArray, function (txHash, cb) {
				var txObj = findTxByHash(block, txHash);
				if (!txObj) {
					return cb('Can not find transaction by hash: ' + txHash);
				}

				library.logic.transaction.verify(txObj, function(err) {
					if (err) {
						return cb(err);
					}
					library.logger.debug("交易verify成功：" + txObj.hash);

					library.logic.transaction.apply(txObj, function(err) {
						if (err) {
							return cb(err);
						}
						library.logger.debug("交易apply成功：" + txObj.hash);

						appliedTxHashArray.push(txObj.hash);
						cb();
					});
				});
			}, function(err) {
				if (err) {
					return cb(err);
				}
				library.logger.debug("全部交易apply成功 -- appliedTxHashArray = " + JSON.stringify(appliedTxHashArray));

				privated.saveBlock(block, function (err) {
					if (err) {
						library.logger.error("保存区块到数据库失败：", err);
						return cb(err);
					}
					library.logger.debug("保存区块到数据库成功：" + block.hash);
					// process.exit(-1);
						
					// generator的DLB余额要加上reward
					var param = {publicKey:block.generatorPublicKey, addAmount: block.reward};
					library.logic.account.dlbBalanceAdd(param, function (err) {
						if (err) {
							return cb(err);
						}
						library.modules.transactions.updateUnconfirmedListAfterProcessBlock(appliedTxHashArray);
						privated.computeNextBlockGenerator(function(res) {
							privated.legalBlockGenerator = res;
							library.logger.debug('Blocks.prototype.processBlock -- 计算出下一个组块账号：', privated.legalBlockGenerator);
						});
							
						privated.tipBlock = block;
						if (broadcast) {
							library.modules.transport.broadcastBlock(block, function(err, res) {
								if (err) {
									library.logger.debug('Blocks.prototype.processBlock -- broadcastBlock：', err);
								}
								cb(null, block);
							});
						} else {
							cb(null, block);
						}
					});
				});
			});
		});
	});
}

// 根据上个block处理过程中delegate和vote两种类型的交易apply的结果计算出下一个round的block generator
privated.computeNextBlockGenerator = function (cb) {
	var param1 = {slotNum: slots.getSlotNumber() - 1, sortByVotes: -1, limit: 2 * constants.delegatesNum};
	// var param1 = {slotNum: slotNumber, sortByVotes: -1, limit: 2 * constants.delegatesNum};
	library.logic.account.getDelegateList(param1, function(err, delegates) {
		if (err) {
			library.logger.error("Blocks模块：computeNextBlockGenerator函数发生严重错误1：", err);
			return cb(null);
		}
		library.logger.debug("Blocks模块：computeNextBlockGenerator函数 -- delegates=", delegates);

		if (!delegates || delegates.length <= 0) {
			library.logger.error("Blocks模块：computeNextBlockGenerator函数 -- ：delegates列表为空");
			return cb(null);
		}

		var delegates2 = [];
		for (i in delegates) {
			if (privated.specialDelegates.indexOf(delegates[i].publicKey) < 0) {
				delegates2.push(delegates[i]);
			}
		}
		library.logger.debug("Blocks模块：computeNextBlockGenerator函数 -- delegates2=", delegates2);

		if (delegates2.length <= 0) {
			library.logger.error("Blocks模块：computeNextBlockGenerator函数 -- ：delegates2列表为空");
			return cb(null);
		}

		var sortedDelegates = delegates2.sort(function compare(a, b) {
			if (a.votes < b.votes) return 1;			// 按照得票数降序排列，得票数越大越靠前
			if (a.votes > b.votes) return -1;

			// 得票相同的话就看运气了
			var numA = myUtils.computeNumberByPublicKey(a.publicKey);
			var numB = myUtils.computeNumberByPublicKey(b.publicKey);
			if (numA < numB) return -1;
			if (numA > numB) return 1;

			return 0;
		});
		library.logger.debug("Blocks模块：computeNextBlockGenerator函数 -- sortedDelegates=", sortedDelegates);

		var currentSlot = slots.getSlotNumber();
		if ((currentSlot + 1) % constants.delegatesNum == 0) {
			return cb(sortedDelegates[0]);
		}

		var startSlotOfCurrentRound = constants.delegatesNum * Math.floor(currentSlot / constants.delegatesNum);
		var param2 = {from: startSlotOfCurrentRound, to: currentSlot + 1};
		library.mongoDb.getBlockGeneratorArray(param2, function(err, actedBlockGenerators) {
			if (err) {
				library.logger.error("Blocks模块：computeNextBlockGenerator函数发生严重错误2：", err);
				return cb(null);
			}
			library.logger.debug("Blocks模块：computeNextBlockGenerator函数 -- actedBlockGenerators=", actedBlockGenerators);

			for (i in sortedDelegates) {
				if (actedBlockGenerators.indexOf(sortedDelegates[i].publicKey) < 0) {
					return cb(sortedDelegates[i]);
				}
			}
			return cb(null);
		});
	});
}

// 从peer节点加载当前slot之前的block
function loadBlockFromPeer(peer, blockHeight, cb) {
	var url = '/api/blocks/getBlockByHeight?withAllTx=1&height=' + blockHeight;
	myUtils.httpGet(peer.host, peer.port, url, function(data) {
		library.logger.debug('loadBlockFromPeer -- data: ', data);
		var dataObj = JSON.parse(data);
		if (dataObj.success === true) {
			var blockObj = dataObj.block;
			// console.log(JSON.stringify(blockObj));
					
			self.loadLocalBlock(blockObj, true, function(err, res) {
				if (err) {
					return cb(err);
				}
				setTimeout(function() {
					slots.setFakeSlotNumber(blockHeight + 1);
					loadBlockFromPeer(peer, blockHeight + 1, cb)
				}, 10);
			});
		} else {
			cb('Load block from peer fail: blockHeight=' + blockHeight);
		}
	});
}

// 从peer节点加载当前slot的block
function loadCurrentBlockFromPeer(peer, cb) {
	var url = '/api/blocks/getBlockByHeight?withAllTx=1&height=' + slots.getSlotNumber();
	myUtils.httpGet(peer.host, peer.port, url, function(data) {
		library.logger.debug('loadCurrentBlockFromPeer -- data: ', data);
		var dataObj = JSON.parse(data);
		if (dataObj.success === true) {
			var blockObj = dataObj.block;
			library.logger.debug(JSON.stringify(blockObj));

			self.loadLocalBlock(blockObj, true, function(err, res) {
				if (err) {
					return cb(err);
				}
				cb();
			});
		} else {
			library.logger.debug('Load block from peer fail: blockHeight=' + slots.getSlotNumber());
			setTimeout(function() {
				loadCurrentBlockFromPeer(peer, cb);
			}, 300);
		}
	});
}

function loadBlockFromDb(height, cb) {
	library.mongoDb.getBlockFromDb({height: height}, function(err, res) {
		if (err) {
			return cb(err);
		}

		if (!res) {
			return cb('getBlockFromDb fail: height=' + height);
		}

		var block = res;
		block.txArray = [];
		async.eachSeries(block.txHashArray, function(txHash, cb) {
			library.mongoDb.getTransactionFromDb({hash: txHash}, function(err, res) {
				if (err) {
					return cb(err);
				}
				block.txArray.push(res);
				cb();
			});
		}, function(err, res) {
			if (err) {
				return cb(err);
			}
			// console.log(JSON.stringify(block));
					
			self.loadLocalBlock(block, false, function(err, res) {
				if (err) {
					return cb(err);
				}
				setTimeout(function() {
					slots.setFakeSlotNumber(height + 1);
					loadBlockFromDb(height + 1, cb);
				}, 10);
			});
		});
	});
}

Blocks.prototype.onBlockchainReady = function (scope) {
	privated.loaded = true;
};

// Events
Blocks.prototype.onBind = function (scope) {
	modules = scope;

	library.logger.debug('Blocks.prototype.onBind');
	async.series([function(cb) {
		library.logic.account.deleteDelegateTable(cb);
	}, function(cb) {
		library.logic.account.deleteVoteTable(cb);
	}, function(cb) {
		library.logic.account.deleteDlbBalanceTable(cb);
	}, function(cb) {
		slots.setFakeSlotNumber(0);
		loadBlockFromDb(0, cb);
	}], function(err, res) {
		if (err) {
			library.logger.debug(err);
			// return;
		}

		var fakeSlotNumber = privated.tipBlock.height + 1;
		slots.setFakeSlotNumber(fakeSlotNumber);
		if (library.config.peers.peerList.length <= 0) {		// 这是影子节点，启动DPOS定时器，开天辟地！
			library.bus.message("blockchainReady");
		} else {
			var peer = library.config.peers.peerList[0];
			loadBlockFromPeer(peer, fakeSlotNumber, function(err, res) {
				if (err) {
					library.logger.debug(err);
					// return;
				}

				myUtils.httpGet(peer.host, peer.port, '/api/delegates/startTime', function(data) {
					var dataObj = JSON.parse(data);
					if (dataObj.success === true) {
						slots.setStartTime(dataObj.startTime);
						if (privated.tipBlock.height >= slots.getSlotNumber() - 1) {
							if (privated.tipBlock.height < slots.getSlotNumber()) {
								loadCurrentBlockFromPeer(peer, function(err, res) {
									if (err) {
										library.logger.error('Loading block from peer fail: ', err);
										process.exit(0);
										return;
									}
									library.bus.message("blockchainReady");
								});
							} else {
								library.bus.message("blockchainReady");
							}
						} else {
							library.logger.error('Loading block from peer fail');
							process.exit(0);
						}
					} else {
						library.logger.error('Getting start time fail');
						process.exit(0);
					}
				});
			});
		}
	});
};

Blocks.prototype.cleanup = function (cb) {
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
module.exports = Blocks;



