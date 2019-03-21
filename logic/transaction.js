var slots = require('../helpers/slots.js'),
	ed = require('ed25519'),
	crypto = require('crypto'),
	genesisblock = null,
	constants = require('../helpers/constants.js'),
	ByteBuffer = require("bytebuffer"),
	// bignum = require('../helpers/bignum.js'),
	extend = require('util-extend');

// Constructor
function Transaction(scope, cb) {
	this.scope = scope;
	genesisblock = this.scope.genesisblock;
	cb && setImmediate(cb, null, this);
}

// private methods
var privated = {};
privated.types = {};

function calc (height) {
	return Math.floor(height / constants.delegates) + (height % constants.delegates > 0 ? 1 : 0);
}

// Public methods
Transaction.prototype.create = function (data) {
	this.scope.logger.debug('进入transaction的create函数');
	this.scope.logger.debug('Transaction.prototype.create ---- data: ' + JSON.stringify(data));

	if (!privated.types[data.type]) {
		this.scope.logger.debug('Transaction.prototype.create ---- 不能识别的交易类型');
		throw Error('Unknown transaction type ' + data.type);
	}

	if (!data.keypair) {
		this.scope.logger.debug('Transaction.prototype.create ---- 参数中缺少keypair');
		throw Error("Can't find keypair");
	}

	var trs = {
		type: data.type,
		amount: data.amount,
		senderPublicKey: data.keypair.publicKey.toString('hex'),
		timestamp: slots.getTime(),
		asset: {}
	};

	trs = privated.types[trs.type].create.call(this, data, trs);
	trs.fee = privated.types[trs.type].calculateFee.call(this, trs);
	trs.signature = this.sign(data.keypair, trs);
	trs.hash = this.getHash(trs).toString('hex');
	this.scope.logger.debug('Transaction.prototype.create ---- trs: ', JSON.stringify(trs));
	return trs;
}

Transaction.prototype.attachAssetType = function (typeId, instance) {
	if (instance && typeof instance.create == 'function' && typeof instance.getBytes == 'function' &&
		typeof instance.calculateFee == 'function' && typeof instance.verify == 'function' &&
		//typeof instance.objectNormalize == 'function' && typeof instance.dbRead == 'function' &&
		typeof instance.apply == 'function' && typeof instance.undo == 'function' &&
		typeof instance.applyUnconfirmed == 'function' && typeof instance.undoUnconfirmed == 'function' &&
		typeof instance.ready == 'function' && typeof instance.process == 'function'
	) {
		privated.types[typeId] = instance;
	} else {
		throw Error('Invalid instance interface');
	}
}

Transaction.prototype.sign = function (keypair, trs) {
	var hash = this.getHash(trs, true, true);
	return ed.Sign(hash, keypair).toString('hex');
}

Transaction.prototype.getHash = function (trs, skipSignature, skipHash) {
	return crypto.createHash('sha256').update(this.getBytes(trs, skipSignature, skipHash)).digest();
}

// {"type":1,"amount":0,"senderPublicKey":"65c7f088e1b9e3d6cf2048d9f14b100054b897b5f4d007d4e11526e1459940bf",
// 	"timestamp":84940728,"asset":{"applyDelegate":true},"fee":100,
// 	"signature":"71fb809f6852cb865121fb00c62be163a124fd895898fcb3b7f2e0e55316a232736717b1a253b5156aeaab688fec232c43257a8447789fc37dee8e13a1643108",
// 	"hash":"d48a3b4a98d5f8673d615d7da8a6a7a47de435a5e7ec0138a364f66ed3db5ae9"}
Transaction.prototype.getBytes = function (trs, skipSignature, skipHash) {
	if (!privated.types[trs.type]) {
		throw Error('Unknown transaction type ' + trs.type);
	}

	// try {
		var assetBytes = privated.types[trs.type].getBytes.call(this, trs);
		this.scope.logger.debug('Transaction.prototype.getBytes -- assetBytes: ', assetBytes);
		var assetSize = assetBytes ? assetBytes.length : 0;

		var bufferSize = 1 + 4 + 32 + 8 + 8 + assetSize;
		if (trs.signature && !skipSignature) {
			bufferSize += 64;
		}

		if (trs.hash && !skipHash) {
			bufferSize += 32;
		}

		var bb = new ByteBuffer(bufferSize, true);
		bb.writeByte(trs.type);			// 占1个字节
		bb.writeInt(trs.timestamp);		// 占4个字节

		var senderPublicKeyBuffer = new Buffer(trs.senderPublicKey, 'hex');		// 占32个字节
		for (var i = 0; i < senderPublicKeyBuffer.length; i++) {
			bb.writeByte(senderPublicKeyBuffer[i]);
		}

		bb.writeLong(trs.amount);		// 占8个字节
		bb.writeLong(trs.fee);

		// 对Send类型交易来说，recipient信息包含在asset当中，所以trs.recipientId不需要单独写入
		if (assetSize > 0) {
			for (var i = 0; i < assetSize; i++) {
				bb.writeByte(assetBytes[i]);
			}
		}

		if (trs.signature && !skipSignature) {
			var signatureBuffer = new Buffer(trs.signature, 'hex');
			for (var i = 0; i < signatureBuffer.length; i++) {
				bb.writeByte(signatureBuffer[i]);
			}
		}

		if (trs.hash && !skipHash) {
			var hashBuffer = new Buffer(trs.hash, 'hex');
			for (var i = 0; i < hashBuffer.length; i++) {
				bb.writeByte(hashBuffer[i]);
			}
		}

		bb.flip();
	// } catch (e) {
	// 	throw Error(e.toString());
	// }
	return bb.toBuffer();
}

Transaction.prototype.ready = function (trs) {
	// 在交易进来时的process处理阶段就应该做这个检查，这个地方再检查完全多余
	// if (!privated.types[trs.type]) {
	// 	throw Error('Unknown transaction type ' + trs.type);
	// }

	// if (!trs.senderPublicKey) {
	// 	return false;
	// }

	return privated.types[trs.type].ready.call(this, trs);
}

// 检查交易是否已存在区块链数据库表中
function checkTxAlreadyInDB(txHash, cb)
{
	var MongoClient = require('mongodb').MongoClient;
	var url = "mongodb://localhost:27017/";
 
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
    	if (err) {
        	cb(err);
        }
    	var dbo = db.db("dlb_node");
    	dbo.collection("common_transaction").find({hash: txHash}).toArray(function(err, result) {
        	if (err) {
        		cb(err);
        	}
        	db.close();
        	cb(null, result);
    	});
	});
}

Transaction.prototype.process = function (trs, cb) {
	this.scope.logger.debug('进入transaction的process函数');
	this.scope.logger.debug('Transaction.prototype.process ---- trs: ' + JSON.stringify(trs));

	checkTxAlreadyInDB(trs.hash, function(err, result) {
		if (err) {
			return setImmediate(cb, err);
		}

		this.scope.logger.debug('Transaction.prototype.process ---- result=' + JSON.stringify(result));
		if (result && result.length > 0)
		{
			this.scope.logger.debug('Transaction.prototype.process ---- 交易已存在区块链数据库表中');
			return setImmediate(cb, "Transaction already exist in blockchain: " + trs.hash);
		}
		else
		{
			if (!privated.types[trs.type]) {
				this.scope.logger.debug('Transaction.prototype.process ---- 无效的交易类型');
				return setImmediate(cb, "Unknown transaction type " + trs.type);
			}
			this.scope.logger.debug('Transaction.prototype.process ---- 交易类型校验OK！');

			// Check timestamp
			if (slots.getSlotNumber(trs.timestamp) > slots.getSlotNumber()) {
				this.scope.logger.debug('Transaction.prototype.process ---- 无效的交易时间戳');
				return setImmediate(cb, "Invalid transaction timestamp");
			}
			this.scope.logger.debug('Transaction.prototype.process ---- 交易时间戳校验OK！');

			// 一次转账最大1亿个DLB，必须是整数，并且不能是科学记数法
			// amount可以等于0，但是不能小于0
			if (trs.amount < 0 || trs.amount > 100000000 * constants.fixedPoint
				|| String(trs.amount).indexOf('.') >= 0 || trs.amount.toString().indexOf('e') >= 0)
			{
				this.scope.logger.debug('Transaction.prototype.process ---- 无效的交易金额');
				return setImmediate(cb, "Invalid transaction amount");
			}
			this.scope.logger.debug('Transaction.prototype.process ---- 交易金额校验OK！');

			// 以后可以考虑把交易费用设计成跟以太坊一样动态调整的，暂时就这么着吧，根据交易类型全网写死
			var fee = privated.types[trs.type].calculateFee.call(this, trs);
			if (!trs.fee || trs.fee <= 0 || trs.fee != fee) {
				this.scope.logger.debug('Transaction.prototype.process ---- 无效的交易费用');
				return setImmediate(cb, "Invalid transaction fee");
			}
			this.scope.logger.debug('Transaction.prototype.process ---- 交易费用校验OK！');

			var txHash = this.getHash(trs, false, true).toString('hex');
			this.scope.logger.debug('Transaction.prototype.process ---- txHash：', txHash);
			this.scope.logger.debug('Transaction.prototype.process ---- trs.hash：', trs.hash);

			if (!trs.hash || trs.hash != txHash) {
				this.scope.logger.debug('Transaction.prototype.process ---- 校验交易的hash失败！！！');
				return setImmediate(cb, "Invalid transaction hash");
			}

			try {
				var valid = false;
				valid = this.verifySignature(trs, trs.senderPublicKey, trs.signature);
			} catch (e) {
				return setImmediate(cb, e.toString());
			}

			if (!valid) {
				this.scope.logger.debug('Transaction.prototype.process ---- 校验交易signature失败');
				return setImmediate(cb, "Failed to verify signature");
			}
			this.scope.logger.debug('Transaction.prototype.process ---- 校验交易signature成功');

			privated.types[trs.type].process.call(this, trs, function (err, trs) {
				if (err) {
					return setImmediate(cb, err);
				}
				cb(null, trs);
			});
		}
	}.bind(this));
}

Transaction.prototype.verify = function (trs, cb) {
	this.scope.logger.debug('进入transaction的verify函数');

	// Spec
	privated.types[trs.type].verify.call(this, trs, function (err) {
		if (!err) {
			console.log('Transaction.prototype.verify ---- 校验交易成功');
		}
		cb(err);
	});
}

Transaction.prototype.verifySignature = function (trs, publicKey, signature) {
	// if (!privated.types[trs.type]) {
	// 	throw Error('Unknown transaction type ' + trs.type);
	// }

	this.scope.logger.debug('进入transaction的verifySignature函数');
	if (!signature) return false;

	try {
		var bytes = this.getBytes(trs, true, true);
		var res = this.verifyBytes(bytes, publicKey, signature);
	} catch (e) {
		throw Error(e.toString());
	}

	return res;
}

Transaction.prototype.verifyBytes = function (bytes, publicKey, signature) {
	try {
		var data2 = new Buffer(bytes.length);

		for (var i = 0; i < data2.length; i++) {
			data2[i] = bytes[i];
		}

		var hash = crypto.createHash('sha256').update(data2).digest();
		var signatureBuffer = new Buffer(signature, 'hex');
		var publicKeyBuffer = new Buffer(publicKey, 'hex');
		var res = ed.Verify(hash, signatureBuffer || ' ', publicKeyBuffer || ' ');
		// var res = ed.Verify(hash, signature || ' ', publicKey || ' ');
	} catch (e) {
		throw Error(e.toString());
	}

	return res;
}

Transaction.prototype.apply = function (trs, cb) {
	if (!privated.types[trs.type]) {
		return setImmediate(cb, "Unknown transaction type " + trs.type);
	}

	// if (!this.ready(trs)) {
	// 	return setImmediate(cb, "Transaction is not ready: " + trs.hash);
	// }

	var amount = trs.timestamp == 0 ? 0 : trs.amount + trs.fee;		// 创世区块中的交易要特殊对待

	this.scope.account.dlbBalanceAdd({publicKey:trs.senderPublicKey, addAmount: -amount}, function (err) {
		if (err) {
			return cb(err);
		}

		privated.types[trs.type].apply.call(this, trs, function (err) {
			if (err) {
				this.scope.account.dlbBalanceAdd({publicKey: trs.senderPublicKey, addAmount: amount}, function (err2) {
					cb(err);
				});
			} else {
				setImmediate(cb);
			}
		}.bind(this));
	}.bind(this));
}

Transaction.prototype.undo = function (trs, cb) {
	if (!privated.types[trs.type]) {
		return setImmediate(cb, "Unknown transaction type " + trs.type);
	}

	var amount = trs.timestamp == 0 ? 0 : trs.amount + trs.fee;		// 创世区块中的交易要特殊对待

	this.scope.account.dlbBalanceAdd({publicKey:trs.senderPublicKey, addAmount: amount}, function (err) {
		if (err) {
			return cb(err);
		}

		privated.types[trs.type].undo.call(this, trs, function (err) {
			if (err) {
				this.scope.account.dlbBalanceAdd({publicKey:trs.senderPublicKey, addAmount: amount}, function (err2) {
					cb(err);
				});
			} else {
				setImmediate(cb);
			}
		}.bind(this));
	}.bind(this));
}

Transaction.prototype.applyUnconfirmed = function (trs, cb) {
	var amount = trs.amount + trs.fee;

	this.scope.account.dlbBalanceAdd({publicKey: trs.senderPublicKey, addAmount: -amount}, function (err) {
		if (err) {
			return cb(err);
		}

		privated.types[trs.type].applyUnconfirmed.call(this, trs, function (err) {
			if (err) {
				this.scope.account.dlbBalanceAdd({publicKey: trs.senderPublicKey, addAmount: amount}, function (err2) {
					cb(err);
				});
			} else {
				setImmediate(cb, err);
			}
		}.bind(this));
	}.bind(this));
}

Transaction.prototype.undoUnconfirmed = function (trs, cb) {
	if (!privated.types[trs.type]) {
		return setImmediate(cb, "Unknown transaction type " + trs.type);
	}

	var amount = trs.amount + trs.fee;
	this.scope.account.dlbBalanceAdd({publicKey: trs.senderPublicKey, addAmount: amount}, function (err) {
		if (err) {
			return cb(err);
		}

		privated.types[trs.type].undoUnconfirmed.call(this, trs, function (err) {
			if (err) {
				this.scope.account.dlbBalanceAdd({publicKey: trs.senderPublicKey, addAmount: -amount}, function (err2) {
					cb(err);
				});
			} else {
				setImmediate(cb, err);
			}
		}.bind(this));
	}.bind(this));
}

Transaction.prototype.dbSave = function (trs, cb) {
	if (!privated.types[trs.type]) {
		return cb("Unknown transaction type: " + trs.type);
	}

	try {
		var senderPublicKey = new Buffer(trs.senderPublicKey, 'hex');
		var signature = new Buffer(trs.signature, 'hex');
		// var signSignature = trs.signSignature ? new Buffer(trs.signSignature, 'hex') : null;
		// var requesterPublicKey = trs.requesterPublicKey ? new Buffer(trs.requesterPublicKey, 'hex') : null;
	} catch (e) {
		return cb(e.toString())
	}

	this.scope.dbLite.query("INSERT INTO trs(hash, blockHash, type, timestamp, senderPublicKey, amount, fee, signature) VALUES($hash, $blockHash, $type, $timestamp, $senderPublicKey, $amount, $fee, $signature)", {
		hash: trs.hash,
		blockHash: trs.blockHash,
		type: trs.type,
		timestamp: trs.timestamp,
		senderPublicKey: senderPublicKey,
		// requesterPublicKey: requesterPublicKey,
		// senderId: trs.senderId,
		// recipientId: trs.recipientId || null,
		// senderUsername: trs.senderUsername || null,
		// recipientUsername: trs.recipientUsername || null,
		amount: trs.amount,
		fee: trs.fee,
		signature: signature,
		// signSignature: signSignature,
		// signatures: trs.signatures ? trs.signatures.join(',') : null
	}, function (err) {
		if (err) {
			return cb(err);
		}

		privated.types[trs.type].dbSave.call(this, trs, cb);
	}.bind(this));

}

Transaction.prototype.objectNormalize = function (trs) {
	if (!privated.types[trs.type]) {
		throw Error('Unknown transaction type ' + trs.type);
	}

	for (var i in trs) {
		if (trs[i] === null || typeof trs[i] === 'undefined') {
			delete trs[i];
		}
	}

	var report = this.scope.scheme.validate(trs, {
		type: "object",
		properties: {
			hash: {
				type: "string"
			},
			height: {
				type: "integer"
			},
			blockHash: {
				type: "string"
			},
			type: {
				type: "integer"
			},
			timestamp: {
				type: "integer"
			},
			senderPublicKey: {
				type: "string",
				format: "publicKey"
			},
			// requesterPublicKey: {
			// 	type: "string",
			// 	format: "publicKey"
			// },
			// senderId: {
			// 	type: "string"
			// },
			// recipientId: {
			// 	type: "string"
			// },
			// senderUsername: {
			// 	type: "string"
			// },
			// recipientUsername: {
			// 	type: "string"
			// },
			amount: {
				type: "integer",
				minimum: 0,
				maximum: constants.totalAmount
			},
			fee: {
				type: "integer",
				minimum: 0,
				maximum: constants.totalAmount
			},
			signature: {
				type: "string",
				format: "signature"
			},
			// signSignature: {
			// 	type: "string",
			// 	format: "signature"
			// },
			asset: {
				type: "object"
			}
		},
		required: ['type', 'timestamp', 'senderPublicKey', 'signature']
	});

	if (!report) {
		throw Error(this.scope.scheme.getLastError());
	}

	try {
		trs = privated.types[trs.type].objectNormalize.call(this, trs);
	} catch (e) {
		throw Error(e.toString());
	}

	return trs;
}

Transaction.prototype.dbRead = function (raw) {
	if (!raw.t_hash) {
		return null
	} else {		
		var tx = {
			hash: raw.t_hash,
			height: raw.b_height,
			blockHash: raw.b_hash || raw.t_blockHash,
			type: parseInt(raw.t_type),
			timestamp: parseInt(raw.t_timestamp),
			senderPublicKey: raw.t_senderPublicKey,
			// requesterPublicKey: raw.t_requesterPublicKey,
			// senderId: raw.t_senderId,
			// recipientId: raw.t_recipientId,
			// senderUsername: raw.t_senderUsername,
			// recipientUsername: raw.t_recipientUsername,
			amount: parseInt(raw.t_amount),
			fee: parseInt(raw.t_fee),
			signature: raw.t_signature,
			// signSignature: raw.t_signSignature,
			// signatures: raw.t_signatures ? raw.t_signatures.split(',') : null,
			confirmations: raw.confirmations,
			asset: {}
		}

		if (!privated.types[tx.type]) {
			throw Error('Unknown transaction type ' + tx.type);
		}

		var asset = privated.types[tx.type].dbRead.call(this, raw);

		if (asset) {
			tx.asset = extend(tx.asset, asset);
		}

		return tx;
	}
}

// Export
module.exports = Transaction;
