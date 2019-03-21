var mongoDb = require('mongodb');
var mongoUrl = "mongodb://localhost:27017/";
var TransactionTypes = require('./transaction-types.js');
var utils = require('./utils.js');
var slots = require('./slots.js');

module.exports = {

    // 从数据库的blocks表中查询高度在一定范围内的区块的generatorPublicKey
    // DPOS机制需要用到
    getBlockGeneratorArray: function getBlockGeneratorArray(param, cb) {
        mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
            if (err) {
                return cb(err);
            }

            var dbc = db.db("dlb_node").collection("blocks");
            var blockGeneratorArray = [];
            var findObj = {"$and": [{"$where": "this.height >= " + param.from}, {"$where": "this.height < " + param.to}]};
            dbc.find(findObj).toArray(function(err, res) {
                db.close();
                if (err) {
                    return cb(err);
                }
                // console.log('getBlockGeneratorsOfRound -- res=', res);

                for (i in res) {
                    blockGeneratorArray.push(res[i].generatorPublicKey);
                }
                cb(null, blockGeneratorArray);
            });
        });
    },

    // 根据param的属性限定条件到blocks表中查找Block记录
    // 目前支持根据block的hash和height查找block
    // blocks表的结构如下：
    // {'version': integer, 'timestamp': integer, 'numberOfTransactions': integer, 'payloadLength': hash,
    //  'totalAmount': integer, 'totalFee': integer, 'reward': integer, 'payloadHash': hash,
    //  'generatorPublicKey': publicKey, 'previousBlockHash': hash, 'blockSignature': signature, 'height': integer,
    //  'hash': hash}
    getBlockFromDb: function getBlockFromDb(param, cb) {
        mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
            if (err) {
                return cb(err);
            }

            var dbc = db.db("dlb_node").collection("blocks");

            var whereObj = {};
            if (utils.isHashString(param.hash)) {
                whereObj.hash = param.hash;
            }
            if (utils.isInteger(param.height) && param.height >= 0) {
                whereObj.height = param.height;
            }

            if (!whereObj.hasOwnProperty('hash') && !whereObj.hasOwnProperty('height')) {
                // console.log('getBlockFromDb -- 无效的block查询参数：', JSON.stringify(param));
                return cb('Invalid block search param');
            };

            dbc.find(whereObj).toArray(function(err, res) {
                db.close();
                if (err) {
                  return cb(err);
                }
                // console.log('getBlockFromDb -- res=', res);

                var checkExist = param.onlyCheckExist === true;
                if (res && res.length > 0) {
                    cb(null, checkExist ? true : res[0]);
                } else {
                    // console.log('getBlockFromDb -- 数据库中没有该数据的记录：', JSON.stringify(param));
                    cb(null, checkExist ? false : null);
                }
            });
        });
    },

    // 将block保存到数据库中的blocks表中
    // 由本函数的调用者负责参数blockObj的数据的有效性、完整性和一致性，本函数只负责保存，不做多余的校验检查
    // blocks表的结构如下：
    // {'version': integer, 'timestamp': integer, 'numberOfTransactions': integer, 'payloadLength': hash,
    //  'totalAmount': integer, 'totalFee': integer, 'reward': integer, 'payloadHash': hash,
    //  'generatorPublicKey': publicKey, 'previousBlockHash': hash, 'blockSignature': signature, 'height': integer,
    //  'hash': hash}
    saveBlockInDb: function saveBlockInDb(blockObj, cb) {
        mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
            if (err) {
                return cb(err);
            }

            db.db("dlb_node").collection("blocks").insertOne(blockObj, function(err2, res) {
                db.close();
                if (err) {
                    return cb(err);
                }
                // console.log("saveBlockInDb -- block存入数据库成功：", JSON.stringify(blockObj));
                cb(null, blockObj);
            });
        });
    },

    // 根据blockHash从数据库中读取属于同一个Block的交易的hash，所有的交易类型都在transaction_common表中有记录
    // transaction_common表的结构如下：
    // {type: integer, senderPublicKey: string, timestamp: integer, amount: integer, asset: string,
    //  signature: string, hash: string, fee: integer, blockHash: string}
    getTxHashArrayByBlockHash: function getTxHashArrayByBlockHash(param, cb) {
        mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
            if (err) {
                return cb(err);
            }

            var whereObj = {blockHash: param.blockHash};
            db.db("dlb_node").collection("transaction_common").find(whereObj).toArray(function(err, res) {
                db.close();
                if (err) {
                    return cb(err);
                }
                // console.log('getTxHashArrayByBlockHash: transaction_common -- res=', res);

                if (!res || res.length <= 0) {
                    // console.log('getTxHashArrayByBlockHash -- transaction_common表中没有符合要求的记录：',
                    //     JSON.stringify(param));
                    return cb('Invalid block hash');
                }

                txHashArray = [];
                for (i in res) {
                    txHashArray.push(res[i].hash);
                }
                cb(null, txHashArray);
            });
        });
    },

    // 从数据库中读取交易，所有的交易类型都在transaction_common表中有记录
    // VOTE、UPLOAD_DATA和USE_DATA三种交易类型还分别在transaction_vote、transaction_upload_data和
    // transaction_use_data表中存在记录
    // transaction_common表的结构如下：
    // {type: integer, senderPublicKey: string, timestamp: integer, amount: integer, asset: string,
    //  signature: string, hash: string, fee: integer, blockHash: string}
    // transaction_vote表的结构如下：
    // {txHash: string, senderPublicKey: string, timestamp: integer,
    //  delegateList: "delegate1;delegate2;...;delegateN", voteList: "vote1;vote2;...;voteN"}
    // transaction_upload_data表的结构如下：
    // {txHash: string, senderPublicKey: string, timestamp: integer, dataHash: string,
    //  dataType: integer, dataAmount: integer, reward: integer}
    // transaction_use_data表的结构如下：
    // {txHash: string, senderPublicKey: string, timestamp: integer,
    //  dataHashList: "hash1;hash2;...;hashN", rewardList: "reward1;reward2;...;rewardN"}
    getTransactionFromDb: function getTransactionFromDb(param, cb) {
        mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
            if (err) {
                return cb(err);
            }

            var whereObj = {hash: param.hash};
            db.db("dlb_node").collection("transaction_common").find(whereObj).toArray(function(err, res) {
                if (err) {
                    db.close();
                    return cb(err);
                }
                // console.log('getTransactionFromDb: transaction_common -- res=', res);

                if (!res || res.length <= 0) {
                    // console.log('getTransactionFromDb -- transaction_common表中没有该交易的记录：', JSON.stringify(param));
                    db.close();
                    return cb(null, null);
                }

                var txObj = {type: res[0].type, senderPublicKey: res[0].senderPublicKey, timestamp: res[0].timestamp,
                    amount: res[0].amount, signature: res[0].signature, hash: res[0].hash, fee: res[0].fee,
                    blockHash: res[0].blockHash};
                if (TransactionTypes.SEND == txObj.type) {
                    txObj.asset = {recipientPublicKey: res[0].asset};
                    db.close();
                    cb(null, txObj);
                } else if (TransactionTypes.DELEGATE == txObj.type) {
                    txObj.asset = {applyDelegate: res[0].asset.toLowerCase() === 'true'};
                    db.close();
                    cb(null, txObj);
                } else if (TransactionTypes.VOTE == txObj.type) {
                    db.db("dlb_node").collection("transaction_vote").find({txHash: param.hash}).toArray(function(err, res) {
                        if (err) {
                            db.close();
                            return cb(err);
                        }
                        // console.log('getTransactionFromDb: transaction_vote -- res=', res);

                        if (!res || res.length <= 0) {
                            // console.log('getTransactionFromDb -- transaction_vote表中没有该交易的记录：',
                            //     JSON.stringify(param));
                            db.close();
                            return cb(null, null);
                        }

                        delegateSplitArray = res[0].delegateList.split(';');
                        voteSplitArray = res[0].voteList.split(';');
                        txObj.asset = {votesList: []};
                        for (i in delegateSplitArray) {
                            var item = {delegate: delegateSplitArray[i], vote: voteSplitArray[i]};
                            txObj.asset.votesList.push(item);
                        }
                        db.close();
                        cb(null, txObj);
                    });
                } else if (TransactionTypes.UPLOAD_DATA == txObj.type) {
                    db.db("dlb_node").collection("transaction_upload_data").find({txHash: param.hash}).toArray(function(err, res) {
                        if (err) {
                            db.close();
                            return cb(err);
                        }
                        // console.log('getTransactionFromDb: transaction_upload_data -- res=', res);

                        if (!res || res.length <= 0) {
                            // console.log('getTransactionFromDb -- transaction_upload_data表中没有该交易的记录：',
                            //     JSON.stringify(param));
                            db.close();
                            return cb(null, null);
                        }

                        txObj.asset = {dataHash: res[0].dataHash, dataType: res[0].dataType,
                            dataAmount: res[0].dataAmount, reward: res[0].reward};
                        db.close();
                        cb(null, txObj);
                    });
                } else if (TransactionTypes.USE_DATA == txObj.type) {
                    db.db("dlb_node").collection("transaction_use_data").find({txHash: param.hash}).toArray(function(err, res) {
                        if (err) {
                            db.close();
                            return cb(err);
                        }
                        // console.log('getTransactionFromDb: transaction_use_data -- res=', res);

                        if (!res || res.length <= 0) {
                            // console.log('getTransactionFromDb -- transaction_use_data表中没有该交易的记录：',
                            //     JSON.stringify(param));
                            db.close();
                            return cb(null, null);
                        }

                        dataHashSplitArray = res[0].dataHashList.split(';');
                        rewardSplitArray = res[0].rewardList.split(';');
                        txObj.asset = {useDataList: []};
                        for (i in dataHashSplitArray) {
                            var item = {dataHash: dataHashSplitArray[i], reward: rewardSplitArray[i]};
                            txObj.asset.useDataList.push(item);
                        }
                        db.close();
                        cb(null, txObj);
                    });
                }

                // db.close();
                // cb(null, txObj);
            });
        });
    },

    // 将交易保存到数据库中，所有的交易类型都要在transaction_common表中写入记录
    // VOTE、UPLOAD_DATA和USE_DATA三种交易类型还需要分别在transaction_vote、transaction_upload_data和
    // transaction_use_data表中写入记录
    // 由本函数的调用者负责参数txObj的数据的有效性、完整性和一致性，本函数只负责保存，不做多余的校验检查
    // transaction_common表的结构如下：
    // {type: integer, senderPublicKey: string, timestamp: integer, amount: integer, asset: string,
    //  signature: string, hash: string, fee: integer, blockHash: string}
    // transaction_vote表的结构如下：
    // {txHash: string, senderPublicKey: string, timestamp: integer,
    //  delegateList: "delegate1;delegate2;...;delegateN", voteList: "vote1;vote2;...;voteN"}
    // transaction_upload_data表的结构如下：
    // {txHash: string, senderPublicKey: string, timestamp: integer, dataHash: string,
    //  dataType: integer, dataAmount: integer, reward: integer}
    // transaction_use_data表的结构如下：
    // {txHash: string, senderPublicKey: string, timestamp: integer,
    //  dataHashList: "hash1;hash2;...;hashN", rewardList: "reward1;reward2;...;rewardN"}
    saveTransactionInDb: function saveTransactionInDb(txObj, cb) {
        mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
            if (err) {
                return cb(err);
            }

            var tx2Save = {type: txObj.type, senderPublicKey: txObj.senderPublicKey,
                timestamp: txObj.timestamp, amount: txObj.amount, signature: txObj.signature,
                hash: txObj.hash, fee: txObj.fee, blockHash: txObj.blockHash};
            if (TransactionTypes.SEND == txObj.type) {
                tx2Save.asset = txObj.asset.recipientPublicKey;
            } else if (TransactionTypes.DELEGATE == txObj.type) {
                tx2Save.asset = txObj.asset.applyDelegate ? 'true' : 'false';
            } else {
                tx2Save.asset = '';
            }

            db.db("dlb_node").collection("transaction_common").insertOne(tx2Save, function(err2, res) {
                if (err2) {
                    db.close();
                    return cb(err2);
                }
                // console.log("saveTransactionInDb -- 交易存入transaction_common表成功：", JSON.stringify(tx2Save));

                if (TransactionTypes.VOTE == txObj.type) {
                    txVote2Save = {txHash: txObj.hash, senderPublicKey: txObj.senderPublicKey,
                        timestamp: txObj.timestamp};
                    txVote2Save.delegateList = utils.joinPropertyValueOfObjectArray(txObj.asset.votesList, 'delegate');
                    txVote2Save.voteList = utils.joinPropertyValueOfObjectArray(txObj.asset.votesList, 'vote');

                    db.db("dlb_node").collection("transaction_vote").insertOne(txVote2Save, function(err3, res) {
                        db.close();
                        if (err3) {
                            return cb(err3);
                        }
                        // console.log("saveTransactionInDb -- 交易存入transaction_vote表成功：", JSON.stringify(txVote2Save));
                        cb(null, txObj);
                    });
                } else if (TransactionTypes.UPLOAD_DATA == txObj.type) {
                    txUploadData2Save = {txHash: txObj.hash, senderPublicKey: txObj.senderPublicKey,
                        timestamp: txObj.timestamp, dataHash: txObj.asset.dataHash,
                        dataType: txObj.asset.dataType, dataAmount: txObj.asset.dataAmount, reward: txObj.asset.reward};

                    db.db("dlb_node").collection("transaction_upload_data").insertOne(txUploadData2Save, function(err3, res) {
                        db.close();
                        if (err3) {
                            return cb(err3);
                        }
                        // console.log("saveTransactionInDb -- 交易存入transaction_upload_data表成功：",
                        //     JSON.stringify(txUploadData2Save));
                        cb(null, txObj);
                    });
                } else if (TransactionTypes.USE_DATA == txObj.type) {
                    txUseData2Save = {txHash: txObj.hash, senderPublicKey: txObj.senderPublicKey,
                        timestamp: txObj.timestamp};
                    txUseData2Save.dataHashList = utils.joinPropertyValueOfObjectArray(txObj.asset.useDataList, 'dataHash');
                    txUseData2Save.rewardList = utils.joinPropertyValueOfObjectArray(txObj.asset.useDataList, 'reward');

                    db.db("dlb_node").collection("transaction_use_data").insertOne(txUseData2Save, function(err3, res) {
                        db.close();
                        if (err3) {
                            return cb(err3);
                        }
                        // console.log("saveTransactionInDb -- 交易存入transaction_use_data表成功：",
                        //     JSON.stringify(txUseData2Save));
                        cb(null, txObj);
                    });
                } else {
                    db.close();
                    cb(null, txObj);
                }
            });
        });
    },

    // 根据交易hash到transaction_common表中查找交易记录
    // transaction_common表的结构如下：
    // {type: integer, senderPublicKey: string, timestamp: integer, amount: integer, asset: string,
    //  signature: string, hash: string, fee: integer, blockHash: string}
    getTransactionByTxHash: function getTransactionByTxHash(param, cb) {
        mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
            if (err) {
                return cb(err);
            }

            var dbc = db.db("dlb_node").collection("transaction_common");
            dbc.find({hash: param.hash}).toArray(function(err, res) {
                db.close();
                if (err) {
                  return cb(err);
                }
                // console.log('getTransactionByTxHash -- res=', res);

                if (res && res.length > 0) {
                    cb(null, res[0]);
                } else {
                    // console.log('getTransactionByTxHash -- 数据库中没有该数据的记录：', param.hash);
                    cb(null, null);
                }
            });
        });
    },

	// 根据数据块hash查找数据上传记录
	// UPLOAD_DATA类型的交易在transaction_common表和transaction_upload_data表中同时有记录
	// UPLOAD_DATA类型交易在transaction_upload_data表的结构如下：
	// {txHash: string, senderPublicKey: string, timestamp: integer, dataHash: string,
	//	dataType: integer, dataAmount: integer, reward: integer}
    getDataUploadRecordByDataHash: function getDataUploadRecordByDataHash(param, cb) {
		mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
            if (err) {
                return cb(err);
            }

            var dbc = db.db("dlb_node").collection("transaction_upload_data");
            dbc.find({dataHash: param.dataHash}).toArray(function(err, res) {
                db.close();
                if (err) {
        		  return cb(err);
                }
                // console.log('getDataUploadRecordByDataHash -- res=', res);

                // 这个检查已经没有必要，因为这是在区块链数据库中，写入的时候就必须保证这种事情不会发生
                // if (res && res.length > 1) {
                // 	console.log('getDataUploadRecordByDataHash -- 数据库中有该数据重复的记录：', param.dataHash);
                // 	return cb('Duplicate data record: ' + param.dataHash);
                // }

                if (!res || res.length <= 0) {
                    // console.log('getDataUploadRecordByDataHash -- 数据库中没有该数据的记录：', param.dataHash);
                    return cb(null, null);
                }
        	
                cb(null, res[0]);
            });
        });
	},

    // 根据数据块hash查找数据使用记录
    // USE_DATA类型的交易在transaction_common表和transaction_use_data表中同时有记录
    // USE_DATA类型交易在transaction_use_data表的结构如下：
    // {txHash: string, senderPublicKey: string, timestamp: integer,
    //    dataHashList: "hash1;hash2;...;hashN", rewardList: "reward1;reward2;...;rewardN"}
    // skip(), limilt(), sort()三个放在一起执行的时候，执行的顺序是先 sort(), 然后是 skip()，最后是显示的 limit()
    getDataUseRecordByDataHash: function getDataUseRecordByDataHash(param, cb) {
        mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
            if (err) {
                return cb(err);
            }

            var dbc = db.db("dlb_node").collection("transaction_use_data");
            var whereObj = {$where: "(this.dataHashList.indexOf('" + param.dataHash + "') >= 0)"};

            var middleRes = dbc.find(whereObj);
            if (param.sortByTime === 1 || param.sortByTime === -1) {
                middleRes = middleRes.sort({'timestamp': param.sortByTime});
            }

            if (typeof param.offset === 'number' && param.offset > 0) {
                middleRes = middleRes.skip(param.offset);
            }

            if (typeof param.limit === 'number' && param.limit > 0) {
                middleRes = middleRes.limit(param.limit);
            }

            middleRes.toArray(function(err, res) {
                db.close();
                if (err) {
                  return cb(err);
                }
                // console.log('getDataUseRecordByDataHash -- res=', res);

                if (!res || res.length <= 0) {
                    // console.log('getDataUseRecordByDataHash -- 数据库中没有该数据的记录：', param.dataHash);
                    return cb(null, null);
                }
            
                cb(null, res);
            });
        });
    }
}