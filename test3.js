// 本JS程序专用于构造Genesis block
var	crypto = require('crypto');
var ed = require('ed25519');
var specialAccountsArray = require('./special-accounts.json');
var ByteBuffer = require("bytebuffer");


function getTxBytes(trs, skipSignature, skipHash)
{
	// var assetBytes = '';
	if (trs.type === 200) {
		assetBytes = new Buffer(trs.asset.recipientPublicKey, 'hex');
	} else if (trs.type === 1) {
		// console.log('Come here!!!trs: ' + JSON.stringify(trs));
		if (trs.asset.applyDelegate) {
			assetBytes = new Buffer('TRUE', 'utf8');
		} else {
			assetBytes = new Buffer('FALSE', 'utf8');
		}
		// assetBytes = new Buffer(trs.asset.applyDelegate ? 'TRUE' : 'FALSE', 'hex');
	}
	var assetSize = assetBytes ? assetBytes.length : 0;
	// console.log('Come here!!! assetBytes:' + JSON.stringify(assetBytes));

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


	if (assetSize > 0) {
		// console.log('---' + assetSize);
		for (var i = 0; i < assetSize; i++) {
			bb.writeByte(assetBytes[i]);
		}
	}

	if (trs.signature && !skipSignature) {
		console.log('---' + trs.signature);
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
	return bb.toBuffer();
}

function getTxHash(trs, skipSignature, skipHash)
{
	return crypto.createHash('sha256').update(getTxBytes(trs, skipSignature, skipHash)).digest();
}


function createSendTxInGenesis(keypair, sendAmount, recipient)
{
	var trs = {
		type: 200,
		amount: sendAmount,
		senderPublicKey: '0000000000000000000000000000000000000000000000000000000000000000',	// 只有Genesis block中才可以为全0
		timestamp: 0,			// 只有Genesis block中才可以等于0
		fee: 0,					// 只有Genesis block中才可以等于0
		asset: {}
	};

	trs.asset.recipientPublicKey = recipient;
	var hash = getTxHash(trs, true, true);
	trs.signature = ed.Sign(hash, keypair).toString('hex');
	trs.hash = getTxHash(trs, false, true).toString('hex');
	return trs;
}

function createDelegateTxInGenesis(keypair, sender)
{
	var trs = {
		type: 1,
		amount: 0,
		senderPublicKey: sender,
		timestamp: 0,			// 只有Genesis block中才可以等于0
		fee: 0,					// 只有Genesis block中才可以等于0
		asset: {},
	};

	trs.asset.applyDelegate = true;
	var hash = getTxHash(trs, true, true);
	trs.signature = ed.Sign(hash, keypair).toString('hex');
	trs.hash = getTxHash(trs, false, true).toString('hex');
	return trs;
}

function getBlockBytes(block, skipSignature, skipHash) {
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

function getBlockHash(block, skipSignature, skipHash) {
	return crypto.createHash('sha256').update(getBlockBytes(block, skipSignature, skipHash)).digest();
}

function createGenesisBlock(txList, generator, keypair) {
	var txList = txList.sort(function compare(a, b) {
		if (a.type < b.type) return -1;			// 这是升序排列，数字越小越靠前
		if (a.type > b.type) return 1;
		if (a.timestamp < b.timestamp) return -1;
		if (a.timestamp > b.timestamp) return 1;
		return 0;
	});

	var totalFee = 0, totalAmount = 0, size = 0;
	var payloadHash = crypto.createHash('sha256');

	for (var i = 0; i < txList.length; i++) {
		var txObj = txList[i];
		var bytes = getTxBytes(txObj, false, false);
		console.log(bytes.toString('hex'));
		size += bytes.length;
		totalFee += txObj.fee;
		totalAmount += txObj.amount;
		payloadHash.update(bytes);
	}

	var block = {
		version: 0,
		height: 0,
		totalAmount: totalAmount,
		totalFee: totalFee,
		reward: 0,			// 只有Genesis block中才可以等于0
		payloadHash: payloadHash.digest().toString('hex'),
		timestamp: 0,		// 只有Genesis block中才可以等于0
		numberOfTransactions: txList.length,
		payloadLength: size,
		previousBlockHash: null,
		generatorPublicKey: generator,
		txArray: txList
	};

	var hash = getBlockHash(block, true, true);
	block.blockSignature = ed.Sign(hash, keypair).toString('hex');
	block.hash = getBlockHash(block, false, true).toString('hex');

	for (i = 0; i < block.txArray.length; i++) {
		block.txArray[i].blockHash = block.hash;
	}

	return block;
}

function main() {
	var my1stSecret = specialAccountsArray.accounts[0];
	var my1stKeypair = ed.MakeKeypair(crypto.createHash('sha256').update(my1stSecret, 'utf8').digest());
	var trs0 = createSendTxInGenesis(my1stKeypair, 7000000000, my1stKeypair.publicKey.toString('hex'));
	// console.log(JSON.stringify(trs0));

	var genesisTxList = [trs0];
	for (i = 0; i < specialAccountsArray.accounts.length; i++) {
		var keypair = ed.MakeKeypair(crypto.createHash('sha256').update(specialAccountsArray.accounts[i], 'utf8').digest());
		var trs = createDelegateTxInGenesis(keypair, keypair.publicKey.toString('hex'));
		genesisTxList.push(trs);
	}

	// console.log(JSON.stringify(genesisTxList));
	var genesisBlock = createGenesisBlock(genesisTxList, my1stKeypair.publicKey.toString('hex'), my1stKeypair);
	console.log(JSON.stringify(genesisBlock));
}

main();




















