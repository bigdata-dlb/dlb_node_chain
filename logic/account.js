var genesisBlock = null;
var mongoDb = require('mongodb');
var mongoUrl = "mongodb://localhost:27017/";
var slots = require('../helpers/slots.js');
var constants = require("../helpers/constants.js");

var privated = {};

// Constructor
function Account(scope, cb) {
	this.scope = scope;
	genesisBlock = this.scope.genesisblock.block;
	setImmediate(cb, null, this);
}

// 清空account_delegate表，节点启动运行时调用
Account.prototype.deleteDelegateTable = function (cb) {
    mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
        if (err) {
            return cb(err);
        }

        var dbc = db.db("dlb_node").collection("account_delegate");
        dbc.find({}).toArray(function(err, result) {
            if (err) {
                db.close();
                return cb(err);
            }

            if (result && result.length > 0) {
                dbc.deleteMany({}, function(err, res) {
                    if (err) {
                        db.close();
                        return cb(err);
                    }
                    // console.log('Account.prototype.deleteDelegateTable：清空account_delegate表成功 -- res=', res);
                    db.close();
                    cb();
                });
            } else {
                db.close();
                cb();
            }
        });
    });
};

// 清空account_votes_used表，节点启动运行时调用
Account.prototype.deleteVoteTable = function (cb) {
    mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
        if (err) {
            return cb(err);
        }

        var dbc = db.db("dlb_node").collection("account_votes_used");
        dbc.find({}).toArray(function(err, result) {
            if (err) {
                db.close();
                return cb(err);
            }

            if (result && result.length > 0) {
                dbc.deleteMany({}, function(err, res) {
                    if (err) {
                        db.close();
                        return cb(err);
                    }
                    // console.log('Account.prototype.deleteVoteTable：清空account_votes_used表成功 -- res=', res);
                    db.close();
                    cb();
                });
            } else {
                db.close();
                cb();
            }
        });
    });
};

// 清空account_dlb_balance表，节点启动运行时调用
Account.prototype.deleteDlbBalanceTable = function (cb) {
    mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
        if (err) {
            return cb(err);
        }

        var dbc = db.db("dlb_node").collection("account_dlb_balance");
        dbc.find({}).toArray(function(err, result) {
            if (err) {
                db.close();
                return cb(err);
            }

            if (result && result.length > 0) {
                dbc.deleteMany({}, function(err, res) {
                    if (err) {
                        db.close();
                        return cb(err);
                    }
                    // console.log('Account.prototype.deleteDlbBalanceTable：清空account_dlb_balance表成功 -- res=', res);
                    db.close();
                    cb();
                });
            } else {
                db.close();
                cb();
            }
        });
    });
};

// 删除account_dlb_balance表中所有记录，并把首账号余额设置为1个亿
// 本函数仅供调试测试使用
// Account.prototype.initDlbBalanceTable = function (param, cb) {
//     mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
//         if (err) {
//             return cb(err);
//         }

//         var dbc = db.db("dlb_node").collection("account_dlb_balance");
//         dbc.find({}).toArray(function(err, result) {
//             if (err) {
//                 db.close();
//                 return cb(err);
//             }

//             if (!result || result.length <= 0) {
//                 dbc.insertOne(param, function(err2, res) {
//                     if (err2) {
//                         db.close();
//                         return cb(err2);
//                     }
//                     console.log("Account.prototype.initDlbBalanceTable -- 记录插入成功：", JSON.stringify(param));
//                     db.close();
//                     cb(null, param);
//                 });
//             } else {
//                 dbc.deleteMany({}, function(err, res) {
//                     if (err) {
//                         db.close();
//                         return cb(err);
//                     }
//                     console.log('Account.prototype.initDlbBalanceTable -- res=', res);
//                     //cb(null, res);
//                     dbc.insertOne(param, function(err2, res) {
//                         if (err2) {
//                             db.close();
//                             return cb(err2);
//                         }
//                         console.log("Account.prototype.initDlbBalanceTable -- 记录插入成功：", JSON.stringify(param));
//                         db.close();
//                         cb(null, param);
//                     });
//                 });
//             }
//         });
//     });
// }

Account.prototype.setDlbBalance = function (data, cb) {
	mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
    	if (err) {
        	return cb(err);
        }
    	var dbc = db.db("dlb_node").collection("account_dlb_balance");
    	dbc.find({publicKey: data.publicKey}).toArray(function(err, result) {
        	if (err) {
        		db.close();
        		return cb(err);
        	}

        	if (result && result.length > 1) {
        		// console.log('Account.prototype.setDlbBalance -- 数据库中有该账户重复的记录：', data.publicKey);
        		db.close();
        		return cb('Duplicate data record: ' + data.publicKey);
        	}

        	if (!result || result.length <= 0) {
        		dbc.insertOne(data, function(err2, res) {
        			if (err2) {
        				db.close();
        				return cb(err2);
        			}
        			// console.log("Account.prototype.setDlbBalance -- 记录插入成功：", data.publicKey);
        			db.close();
        			cb(null, data);
    			});
        	} else {
        		var updateStr = {$set: {"dlbBalance": data.dlbBalance}};
        		dbc.updateOne({publicKey: data.publicKey}, updateStr, function(err2, res) {
        			if (err2) {
        				db.close();
        				return cb(err2);
        			}
        			// console.log("Account.prototype.setDlbBalance -- 记录更新成功：", data.publicKey);
        			db.close();
        			cb(null, data);
    			});
        	}
    	});
	});
}

Account.prototype.getDlbBalance = function (data, cb) {
	mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
    	if (err) {
        	return cb(err);
        }
    	var dbo = db.db("dlb_node");
    	dbo.collection("account_dlb_balance").find({publicKey: data.publicKey}).toArray(function(err, result) {
    		db.close();
        	if (err) {
        		return cb(err);
        	}

        	if (result && result.length > 1) {
        		// console.log('Account.prototype.getDlbBalance -- 数据库中有该账户重复的记录：', data.publicKey);
        		return cb('Duplicate data record: ' + data.publicKey);
        	}

        	if (result.length <= 0) {
        		// console.log('Account.prototype.getDlbBalance -- 数据库中没有该账户的记录：', data.publicKey);
        		return cb(null, 0);
        	}
        	
        	// console.log('Account.prototype.getDlbBalance -- result=', result);
        	cb(null, result[0].dlbBalance);
    	});
	});
}

// 可转账余额，就是DLB余额减去已投票数额
Account.prototype.getTransferableBalance = function (data, cb) {
	mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
    	if (err) {
        	return cb(err);
        }
    	var dbo = db.db("dlb_node");
    	dbo.collection("account_dlb_balance").find({publicKey: data.publicKey}).toArray(function(err, result1) {
        	if (err) {
        		db.close();
        		return cb(err);
        	}

        	if (result1 && result1.length > 1) {
        		// console.log('Account.prototype.getTransferableDlbBalance -- 数据库中有该账户重复的记录：', data.publicKey);
        		db.close();
        		return cb('Duplicate data record: ' + data.publicKey);
        	}

        	if (result1.length <= 0) {
        		// console.log('Account.prototype.getTransferableDlbBalance -- 数据库中没有该账户的记录：', data.publicKey);
        		db.close();
        		return cb(null, 0);
        	}
        	
        	// console.log('Account.prototype.getTransferableDlbBalance -- result1=', result1);

            var slotFrom = Math.floor((slots.getSlotNumber() + 2) / constants.delegateNum) * constants.delegateNum - 2;
            if (slotFrom < 0) {
                slotFrom = 0;
            }
            var findObj = {"$and": [{publicKey: data.publicKey}, {"$where": "this.slot >= " + slotFrom},
                {"$where": "this.slot <= " + slots.getSlotNumber()}]};
        	dbo.collection("account_votes_used").find(findObj).toArray(function(err2, result2) {
        		db.close();
        		if (err2) {
        			return cb(err2);
        		}

        		// console.log('Account.prototype.getTransferableDlbBalance -- result2=', result2);

        		// account_votes_used表中有slot字段，因此允许一个publicKey有多个记录
        		var sum = 0;
        		if (result2.length > 0) {
        			for(i in result2) {
        				sum += result2[i].votesUsed;
        			}
        		}
        		cb(null, result1[0].dlbBalance - sum);
    		});
    	});
	});
}

// 账户的投票记录表结构如下：{publicKey: String, votesUsed: Number, slot: Number}
Account.prototype.getVotesUsed = function (data, cb) {
	mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
    	if (err) {
        	return cb(err);
        }
    	var dbo = db.db("dlb_node");
        var slotFrom = Math.floor((slots.getSlotNumber() + 2) / constants.delegateNum) * constants.delegateNum - 2;
        if (slotFrom < 0) {
            slotFrom = 0;
        }
        var findObj = {"$and": [{publicKey: data.publicKey}, {"$where": "this.slot >= " + slotFrom},
            {"$where": "this.slot <= " + slots.getSlotNumber()}]};
    	dbo.collection("account_votes_used").find(findObj).toArray(function(err, result) {
    		db.close();
        	if (err) {
        		return cb(err);
        	}

        	// console.log('Account.prototype.getVotesUsed -- result=', result);

        	// account_votes_used表中有slot字段，因此允许一个publicKey有多个记录
        	var sum = 0;
        	if (result.length > 0) {
        		for(i in result) {
        			sum += result[i].votesUsed;
        		}
        	}
        	cb(null, sum);
    	});
	});
}

// 插入已使用投票记录或者增加已有记录的投票数
Account.prototype.addVotesUsed = function (data, cb) {
    mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
        if (err) {
            return cb(err);
        }
        var dbc = db.db("dlb_node").collection("account_votes_used");
        dbc.find({publicKey: data.publicKey, slot: data.slotNum}).toArray(function(err, res) {
            if (err) {
                db.close();
                return cb(err);
            }

            // console.log('Account.prototype.addVotesUsed -- res=', res);

            if (res && res.length > 1) {
                // console.log('Account.prototype.addVotesUsed -- 数据库中有该账户重复的记录：', data.publicKey);
                db.close();
                return cb('Duplicate data record: ' + data.publicKey);
            }

            if (!res || res.length <= 0) {
                var insertObj = {publicKey: data.publicKey, votesUsed: data.addVotes, slot: data.slotNum};
                dbc.insertOne(insertObj, function(err2, res) {
                    if (err2) {
                        db.close();
                        return cb(err2);
                    }
                    // console.log("Account.prototype.addVotesUsed -- 记录插入成功：", data.publicKey);
                    db.close();
                    cb(null, data);
                });
            } else {
                var updateStr = {$set: {"votesUsed": res[0].votesUsed + data.addVotes}};
                dbc.updateOne({publicKey: data.publicKey, slot: data.slotNum}, updateStr, function(err2, res) {
                    if (err2) {
                        db.close();
                        return cb(err2);
                    }
                    // console.log("Account.prototype.addVotesUsed -- 记录更新成功：", data.publicKey);
                    db.close();
                    cb(null, data);
                });
            }
        });
    });
}

Account.prototype.dlbBalanceAdd = function (data, cb) {
	mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
    	if (err) {
        	return cb(err);
        }
    	var dbc = db.db("dlb_node").collection("account_dlb_balance");
    	dbc.find({publicKey: data.publicKey}).toArray(function(err, result) {
        	if (err) {
        		db.close();
        		return cb(err);
        	}

        	if (result && result.length > 1) {
        		// console.log('Account.prototype.dlbBalanceAdd -- 数据库中有该账户重复的记录：', data.publicKey);
        		db.close();
        		return cb('Duplicate data record: ' + data.publicKey);
        	}

        	if (!result || result.length <= 0) {
        		if (data.addAmount < 0) {
        			db.close();
					return cb('Invalid add amount');
        		}

        		dbc.insertOne({publicKey: data.publicKey, dlbBalance: data.addAmount}, function(err2, res) {
        			if (err2) {
        				db.close();
        				return cb(err2);
        			}
        			// console.log("Account.prototype.dlbBalanceAdd -- 记录插入成功：", data.publicKey);
        			db.close();
        			cb(null, data);
    			});
        	} else {
                var newAmount = result[0].dlbBalance + data.addAmount;
        		if (newAmount < 0) {
        			db.close();
					return cb('Invalid add amount2');
        		}

                // console.log("Account.prototype.dlbBalanceAdd -- newAmount = ", newAmount);
        		var updateStr = {$set: {"dlbBalance": newAmount}};
        		dbc.updateOne({publicKey: data.publicKey}, updateStr, function(err2, res) {
        			if (err2) {
        				db.close();
        				return cb(err2);
        			}
        			// console.log("Account.prototype.dlbBalanceAdd -- 记录更新成功：", data.publicKey);
        			db.close();
        			cb(null, data);
    			});
        	}
    	});
	});
}

// account_delegate表的结构：{publicKey: String, applyDelegate: Boolean, votes: Number, slot: Number}
Account.prototype.isAccountDelegate = function (data, cb) {
	mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
    	if (err) {
        	return cb(err);
        }
    	var dbc = db.db("dlb_node").collection("account_delegate");
    	var whereObj = {publicKey: data.publicKey, slot: data.slotNum};
    	dbc.find(whereObj).toArray(function(err, result) {
    		db.close();
        	if (err) {
        		return cb(err);
        	}
        	// console.log('Account.prototype.isAccountDelegate -- result=', result);

        	if (result && result.length > 1) {
        		// console.log('Account.prototype.isAccountDelegate -- 数据库中有该账户重复的记录：', data.publicKey);
        		return cb('Duplicate data record: ' + data.publicKey);
        	}

        	if (!result || result.length <= 0) {
        		// console.log('Account.prototype.isAccountDelegate -- 数据库中没有该账户的记录：', data.publicKey);
        		cb(null, false);
        	} else {
				cb(null, result[0].applyDelegate);
        	}
    	});
	});
}

// 不一定是设置delegate，也可能是取消设置delegate，视data参数的applyDelegate属性而定
Account.prototype.setAccountDelegate = function (data, cb) {
	mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
    	if (err) {
        	return cb(err);
        }
    	var dbc = db.db("dlb_node").collection("account_delegate");
    	var whereObj = {publicKey: data.publicKey, slot: data.slotNum};
    	dbc.find(whereObj).toArray(function(err, result) {
        	if (err) {
        		db.close();
        		return cb(err);
        	}
        	// console.log('Account.prototype.setAccountDelegate -- result=', result);

        	if (result && result.length > 1) {
        		// console.log('Account.prototype.setAccountDelegate -- 数据库中有该账户重复的记录：', data.publicKey);
        		db.close();
        		return cb('Duplicate data record: ' + data.publicKey);
        	}

        	if (!result || result.length <= 0) {
        		// console.log('Account.prototype.setAccountDelegate -- 数据库中没有该账户的记录：', data.publicKey);
        		if (data.applyDelegate) {
        			var insertObj = {publicKey: data.publicKey, applyDelegate: data.applyDelegate, votes: 0, slot: data.slotNum};
        			dbc.insertOne(insertObj, function(err2, res) {
        				if (err2) {
        					db.close();
        					return cb(err2);
        				}
        				// console.log("Account.prototype.setAccountDelegate -- 记录插入成功：", data.publicKey);
        				db.close();
        				cb(null, insertObj);
    				});
        		} else {
        			db.close();
        			cb(null, data);
        		}
        	} else {
				if (data.applyDelegate != result[0].applyDelegate) {
					var updateStr = {$set: {"applyDelegate": data.applyDelegate, 'votes': 0}};
        			dbc.updateOne(whereObj, updateStr, function(err2, res) {
        				if (err2) {
        					db.close();
        					return cb(err2);
        				}
        				// console.log("Account.prototype.setAccountDelegate -- 记录更新成功：", data.publicKey);
        				db.close();
        				cb(null, updateStr);
    				});
				} else {
					db.close();
        			cb(null, data);
				}
        	}
    	});
	});
}

// delegate接收到其他账户对其投票时本函数被执行
// account_delegate表的结构：{publicKey: String, applyDelegate: Boolean, votes: Number, slot: Number}
Account.prototype.addDelegateVotes = function (data, cb) {
    mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
        if (err) {
            return cb(err);
        }
        var dbc = db.db("dlb_node").collection("account_delegate");
        var whereObj = {publicKey: data.publicKey, applyDelegate: true, slot: data.slotNum};
        dbc.find(whereObj).toArray(function(err, result) {
            if (err) {
                db.close();
                return cb(err);
            }
            // console.log('Account.prototype.addDelegateVotes -- result=', result);

            if (result && result.length > 1) {
                // console.log('Account.prototype.addDelegateVotes -- 数据库中有该账户重复的记录：', data.publicKey);
                db.close();
                return cb('Duplicate data record: ' + data.publicKey);
            }

            if (!result || result.length <= 0) {
                // console.log('Account.prototype.addDelegateVotes -- 数据库中没有该账户的记录：', data.publicKey);
                db.close();
                return cb('Non-exist data record: ' + data.publicKey);
            }

            var updateStr = {$set: {'votes': result[0].votes + data.addVotes}};
            dbc.updateOne(whereObj, updateStr, function(err2, res) {
                if (err2) {
                    db.close();
                    return cb(err2);
                }
                // console.log("Account.prototype.addDelegateVotes -- 记录更新成功：", data.publicKey);
                db.close();
                cb(null, data);
            });
        });
    });
}

// 将账户的delegate属性取为当前值的相反值，用在delegate交易的undo和undoUnconfirmed操作中
Account.prototype.unsetAccountDelegate = function (data, cb) {
	mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
    	if (err) {
        	return cb(err);
        }
    	var dbc = db.db("dlb_node").collection("account_delegate");
    	var whereObj = {publicKey: data.publicKey, slot: data.slotNum};
    	dbc.find(whereObj).toArray(function(err, result) {
        	if (err) {
        		db.close();
        		return cb(err);
        	}
        	// console.log('Account.prototype.unsetAccountDelegate -- result=', result);

        	if (result && result.length > 1) {
        		// console.log('Account.prototype.unsetAccountDelegate -- 数据库中有该账户重复的记录：', data.publicKey);
        		db.close();
        		return cb('Duplicate data record: ' + data.publicKey);
        	}

        	if (!result || result.length <= 0) {
        		// console.log('Account.prototype.unsetAccountDelegate -- 数据库中没有该账户的记录：', data.publicKey);
        		db.close();
        		return cb('Non-exist data record: ' + data.publicKey);
        	}

        	var updateStr = {$set: {"applyDelegate": !result[0].applyDelegate, 'votes': 0}};
        	dbc.updateOne(whereObj, updateStr, function(err2, res) {
        		if (err2) {
        			db.close();
        			return cb(err2);
        		}
        		// console.log("Account.prototype.unsetAccountDelegate -- 记录更新成功：", data.publicKey);
        		db.close();
        		cb(null, updateStr);
    		});
    	});
	});
}

// 根据时间戳获取delegate列表
// skip(), limilt(), sort()三个放在一起执行的时候，执行的顺序是先 sort(), 然后是 skip()，最后是显示的 limit()
Account.prototype.getDelegateList = function (data, cb) {
    mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
        if (err) {
            return cb(err);
        }
        var dbc = db.db("dlb_node").collection("account_delegate");
        var whereObj = {applyDelegate: true, slot: data.slotNum};

        var middleRes = dbc.find(whereObj);
        if (data.sortByVotes === 1 || data.sortByVotes === -1) {
            middleRes = middleRes.sort({'votes': data.sortByVotes});
        }

        if (typeof data.offset === 'number' && data.offset > 0) {
            middleRes = middleRes.skip(data.offset);
        }

        if (typeof data.limit === 'number' && data.limit > 0) {
            middleRes = middleRes.limit(data.limit);
        }

        middleRes.toArray(function(err, result) {
            db.close();
            if (err) {
                return cb(err);
            }
            // console.log('Account.prototype.getDelegateList -- result=', result);

            var delegateList = [];
            if (result && result.length > 0) {
                for (i in result) {
                    if (data.onlyPublicKey === true) {
                        delegateList.push(result[i].publicKey);
                    } else {
                        delegateList.push(result[i]);
                    }
                }
            }
            cb(null, delegateList);
        });
    });
}

// 根据publicKey和时间戳获取delegate
// account_delegate表的结构：{publicKey: String, applyDelegate: Boolean, votes: Number, slot: Number}
Account.prototype.getDelegateFromPublicKey = function (data, cb) {
    mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
        if (err) {
            return cb(err);
        }
        var dbc = db.db("dlb_node").collection("account_delegate");
        var whereObj = {publicKey: data.publicKey, applyDelegate: true, slot: data.slotNum};
        dbc.find(whereObj).toArray(function(err, result) {
            db.close();
            if (err) {
                return cb(err);
            }
            // console.log('Account.prototype.getDelegateFromPublicKey -- result=', result);

            if (result && result.length > 1) {
                // console.log('Account.prototype.getDelegateFromPublicKey -- 数据库中有该账户重复的记录：', data.publicKey);
                return cb('Duplicate data record: ' + data.publicKey);
            }

            var delegate = null;
            if (result && result.length > 0) {
                delegate = result[0];
            }
            cb(null, delegate);
        });
    });
}

// 删除过时的delegate表中的记录，保留最近的5个slot的记录应该足够了
// account_delegate表的结构：{publicKey: String, applyDelegate: Boolean, votes: Number, slot: Number}
Account.prototype.deleteLegacyDelegateRecord = function (cb) {
    mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
        if (err) {
            return cb(err);
        }

        var whereObj = {"$where": "this.slot < " + (slots.getSlotNumber() - 5)};
        db.db("dlb_node").collection("account_delegate").deleteMany(whereObj, function(err, res) {
            db.close();
            if (err) {
                return cb(err);
            }
            // console.log('Account.prototype.deleteLegacyDelegateRecord -- res=', res);
            cb(null, res);
        });
    });
}

// 删除过时的Vote表中的记录，时间戳进入新的round（实际上要前推2个slot，想想为什么？）就删除所有之前的记录
Account.prototype.deleteLegacyVoteRecord = function (cb) {
    if ((slots.getSlotNumber() + 2) % constants.delegateNum != 0) {
        return cb('Invalid slot number');
    }

    mongoDb.MongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, db) {
        if (err) {
            return cb(err);
        }

        var whereObj = {"$where": "this.slot < " + slots.getSlotNumber()};
        db.db("dlb_node").collection("account_votes_used").deleteMany(whereObj, function(err, res) {
            db.close();
            if (err) {
                return cb(err);
            }
            // console.log('Account.prototype.deleteLegacyVoteRecord -- res=', res);
            cb(null, res);
        });
    });
}



// Export
module.exports = Account;
