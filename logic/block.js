var slots = require('../helpers/slots.js'),
	ed = require('ed25519'),
	crypto = require('crypto'),
	genesisblock = null,
	// bignum = require('../helpers/bignum.js'),
	ByteBuffer = require("bytebuffer"),
	milestones = require("../helpers/milestones.js"),
	constants = require('../helpers/constants.js');

// Constructor
function Block(scope, cb) {
	this.scope = scope;
	genesisblock = this.scope.genesisblock;
	cb && setImmediate(cb, null, this);
}

// private methods
var privated = {};
privated.milestones = new milestones();

// Public methods
Block.prototype.create = function (data) {
	var transactions = data.txArray.sort(function compare(a, b) {
		if (a.type < b.type) return -1;			// 这是升序排列，数字越小越靠前
		if (a.type > b.type) return 1;
		if (a.timestamp < b.timestamp) return -1;
		if (a.timestamp > b.timestamp) return 1;
		return 0;
	});

	var nextHeight = (data.previousBlock) ? data.previousBlock.height + 1 : 1;

	var reward = 100,	//privated.milestones.calcReward(nextHeight),
	    totalFee = 0, totalAmount = 0, size = 0;

	var blockTransactions = [];
	var payloadHash = crypto.createHash('sha256');

	for (var i = 0; i < transactions.length; i++) {
		var transaction = transactions[i];
		var bytes = this.scope.transaction.getBytes(transaction);

		// this.scope.logger.debug('交易字节大小：' + bytes.length);
		if (size + bytes.length > constants.maxPayloadLength) {
			break;
		}

		size += bytes.length;
		totalFee += transaction.fee;
		totalAmount += transaction.amount;
		transaction.indexInBlock = i;		// 增加索引值，防止经过网络广播以后就失去顺序，导致payloadHash校验失败
		blockTransactions.push(transaction);
		payloadHash.update(bytes);
	}

	var block = {
		version: 0,
		totalAmount: totalAmount,
		totalFee: totalFee,
		reward: reward,
		payloadHash: payloadHash.digest().toString('hex'),
		timestamp: data.timestamp,
		numberOfTransactions: blockTransactions.length,
		payloadLength: size,
		previousBlockHash: (data.previousBlock) ? data.previousBlock.hash : null,
		generatorPublicKey: data.keypair.publicKey.toString('hex'),
		txArray: blockTransactions
	};

	block.height = slots.getSlotNumber(block.timestamp);
	try {
		block.blockSignature = this.sign(block, data.keypair);
		block.hash = this.getHash(block, false, true).toString('hex');
		// block = this.objectNormalize(block);
	} catch (e) {
		throw Error(e.toString());
	}

	return block;
}

Block.prototype.sign = function (block, keypair) {
	var hash = this.getHash(block, true, true);
	return ed.Sign(hash, keypair).toString('hex');
}

Block.prototype.getBytes = function (block, skipSignature, skipHash) {
	var size = 4 	// version 4字节
		+ 4 		// timestamp 4字节
		+ 4 		// numberOfTransactions 4字节
		+ 4 		// payloadLength 4字节
		+ 8			// height 8字节
		+ 8 		// totalAmount 8字节
		+ 8 		// totalFee 8字节
		+ 8 		// reward 8字节
		+ 32 		// payloadHash 32字节
		+ 32; 		// generatorPublicKey 32字节
		// + 64; 		// blockSignature 64字节

	if (block.previousBlockHash) {
		size += 32;		// previousBlockHash 32字节
	}

	if (block.blockSignature && !skipSignature) {
		size += 64;		// blockSignature 64字节
	}

	if (block.hash && !skipHash) {
		size += 32;		// hash 32字节
	}

	try {
		var bb = new ByteBuffer(size, true);
		bb.writeInt(block.version);
		bb.writeInt(block.timestamp);

		if (block.previousBlockHash) {
			// var pb = bignum(block.previousBlock).toBuffer({size: '8'});
			var previousBlockHashBuffer = new Buffer(block.previousBlockHash, 'hex');
			for (var i = 0; i < previousBlockHashBuffer.length; i++) {
				bb.writeByte(previousBlockHashBuffer[i]);
			}
		}

		bb.writeInt(block.numberOfTransactions);
		bb.writeLong(block.height);
		bb.writeLong(block.totalAmount);
		bb.writeLong(block.totalFee);
		bb.writeLong(block.reward);
		bb.writeInt(block.payloadLength);

		var payloadHashBuffer = new Buffer(block.payloadHash, 'hex');
		for (var i = 0; i < payloadHashBuffer.length; i++) {
			bb.writeByte(payloadHashBuffer[i]);
		}

		var generatorPublicKeyBuffer = new Buffer(block.generatorPublicKey, 'hex');
		for (var i = 0; i < generatorPublicKeyBuffer.length; i++) {
			bb.writeByte(generatorPublicKeyBuffer[i]);
		}

		if (block.blockSignature && !skipSignature) {
			var blockSignatureBuffer = new Buffer(block.blockSignature, 'hex');
			for (var i = 0; i < blockSignatureBuffer.length; i++) {
				bb.writeByte(blockSignatureBuffer[i]);
			}
		}

		if (block.hash && !skipHash) {
			var blockHashBuffer = new Buffer(block.hash, 'hex');
			for (var i = 0; i < blockHashBuffer.length; i++) {
				bb.writeByte(blockHashBuffer[i]);
			}
		}

		bb.flip();
		var b = bb.toBuffer();
	} catch (e) {
		throw Error(e.toString());
	}

	return b;
}

Block.prototype.verifySignature = function (block) {
	try {
		var data = this.getBytes(block, true, true);
		var hash = crypto.createHash('sha256').update(data).digest();
		var blockSignatureBuffer = new Buffer(block.blockSignature, 'hex');
		var generatorPublicKeyBuffer = new Buffer(block.generatorPublicKey, 'hex');
		var res = ed.Verify(hash, blockSignatureBuffer || ' ', generatorPublicKeyBuffer || ' ');
	} catch (e) {
		throw Error(e.toString());
	}
	return res;
}

Block.prototype.getHash = function (block, skipSignature, skipHash) {
	return crypto.createHash('sha256').update(this.getBytes(block, skipSignature, skipHash)).digest();
}

// Block.prototype.calculateFee = function (block) {
// 	return 10000000;
// }

// Export
module.exports = Block;
