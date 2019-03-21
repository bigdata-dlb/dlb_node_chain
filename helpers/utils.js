var	util = require('util');
var TransactionTypes = require('./transaction-types.js');

module.exports = {
	generatePublicKey: function generatePublicKey(secret) {
		var	crypto = require('crypto');
		var ed = require('ed25519');
		var hash = crypto.createHash('sha256').update(secret, 'utf8').digest();
		var keypair = ed.MakeKeypair(hash);
		// console.log('publicKey: ' + keypair.publicKey.toString('hex'));
		// return '0x' + keypair.publicKey.toString('hex');
		return keypair.publicKey.toString('hex');
	},

    isInteger: function isInteger(obj) {
		return typeof obj === 'number' && Math.floor(obj) === obj;
	},

	isHashString: function isHashString(obj) {
		return typeof obj === 'string' && new Buffer(obj, 'hex').length == 32;
	},

	isSignatureString: function isSignatureString(obj) {
		return typeof obj === 'string' && new Buffer(obj, 'hex').length == 64;
	},

	isPublicKeyString: function isPublicKeyString(obj) {
		return typeof obj === 'string' && new Buffer(obj, 'hex').length == 32;
	},

	computeNumberByPublicKey: function computeNumberByPublicKey(publicKey) {
		if (!this.isPublicKeyString(publicKey)) {
			return -1;
		}

		return parseInt(publicKey.substr(0, 16), 16);
	},

	isIpString: function isIpString(obj) {
		if (typeof obj !== 'string') {
			return false;
		}

		var ipSegs = obj.split('.');
		if (ipSegs.length != 4) {
			return false;
		}

		for (i in ipSegs) {
			var seg = ipSegs[i].replace(/(^\s*)|(\s*$)/g, "");	// 去掉字符串前后的空白字符
			var segInt = parseInt(seg);
			if (!isInteger(segInt) || segInt < 0 || segInt > 255) {
				return false;
			}
		}
		return true;
	},

	isVotesList: function isVotesList(obj) {
		if (!util.isArray(obj)) {
			return false;
		}

		for (i in obj) {
			if (typeof obj[i] !== 'object') {
				return false;
			}

			if (!this.isPublicKeyString(obj[i].delegate)) {
				return false;
			}

			if (!this.isInteger(obj[i].vote) || obj[i].vote <= 0) {
				return false;
			}
		}

		return true;
	},

	isUseDataList: function isUseDataList(obj) {
		if (!util.isArray(obj)) {
			return false;
		}

		for (i in obj) {
			if (typeof obj[i] !== 'object') {
				return false;
			}

			if (!this.isHashString(obj[i].dataHash)) {
				return false;
			}

			if (!this.isInteger(obj[i].reward) || obj[i].reward <= 0) {
				return false;
			}
		}

		return true;
	},

	isHashArray: function isHashArray(obj) {
		if (!util.isArray(obj)) {
			return false;
		}

		for (i in obj) {
			if (!this.isHashString(obj[i])) {
				return false;
			}
		}
		return true;
	},

	joinPropertyValueOfObjectArray: function joinPropertyValueOfObjectArray(objectArray, propertyName) {
		var valueJoined = '';
        for (index in objectArray) {
            if (valueJoined.length > 0) {
                valueJoined += ';';
            }
            valueJoined += objectArray[index][propertyName];
        }
        return valueJoined;
	},

	checkTxAssetMatchType: function checkTxAssetMatchType(txType, txAsset) {
		if (!txAsset || typeof txAsset !== 'object') {
			return false;
		}

		if (txType == TransactionTypes.SEND) {				// SEND交易
			return this.isPublicKeyString(txAsset.recipientPublicKey);
		}

		if (txType == TransactionTypes.DELEGATE) {			// DELEGATE交易
			return typeof txAsset.applyDelegate === 'boolean';
		}

		if (txType == TransactionTypes.VOTE) {				// VOTE交易
			return txAsset.votesList && this.isVotesList(txAsset.votesList);
		}

		if (txType == TransactionTypes.UPLOAD_DATA) {		// UPLOAD_DATA交易
			return this.isHashString(txAsset.dataHash) && this.isInteger(txAsset.dataType)
				&& this.isInteger(txAsset.dataAmount);
		}

		if (txType == TransactionTypes.USE_DATA) {			// USE_DATA交易
			return txAsset.useDataList && this.isUseDataList(txAsset.useDataList);
		}

		return false;
	},

	isPeerList: function isPeerList(obj) {
		if (!util.isArray(obj)) {
				return false;
			}

			for (i in obj) {
				if (typeof obj[i] !== 'object') {
					return false;
				}

				//if (!this.isIpString(obj[i].host)) {
				if (typeof obj[i].host !== 'string') {
					return false;
				}

				if (!this.isInteger(obj[i].port) || obj[i].port < 1 || obj[i].port > 65535) {
					return false;
				}
			}

			return true;
	},

	httpPost: function httpPost(host, port, path, contentObj, cb) {
		var http = require('http');

		// querystring提供的是这种连接方式：name=byvoid&email=byvoid%40byvoid.com&address=Zijing
		// 对应的Content-Type是application/x-www-form-urlencoded
		// var querystring = require('querystring');
		var contents = JSON.stringify(contentObj);

		// console.log(typeof contents);
		// console.log(contents);
 
		var options = {
    		host: host,		//'127.0.0.1',
    		port: port,		//3091,
    		path: path,		//'/api/transactions/',
    		method:'POST',
    		headers:{
        		'Content-Type':'application/json',
        		// 'Content-Type':'application/x-www-form-urlencoded',
        		'Content-Length':contents.length
    		}
		}
 
 		var d = require('domain').create();
		d.on('error', function (err) {
			console.log('发送post请求[host=' + host + ',port=' + port + ',path=' + path + ']失败！ err: ', err.toString());
			cb('{}');
		});

		d.run(function () {
			var req = http.request(options, function(res) {
    			res.setEncoding('utf8');
    			res.on('data', cb);
			});
 
			req.write(contents);
			req.end();
		});
		
	},

	httpGet: function httpGet(host, port, path, cb) {
		var http = require('http');
		var options = {
			host: host,
			port: port,
			path: path
		};

		var d = require('domain').create();
		d.on('error', function (err) {
			console.log('发送get请求[host=' + host + ',port=' + port + ',path=' + path + ']失败！ err: ', err.toString());
			cb('{}');
		});

		d.run(function () {
			var result = '';
			http.get(options, function(res) {
				// console.log('Got response: ' + res.statusCode);
				res.setEncoding('utf-8');
				res.on('data', function(data) {
					result = result + data;
				});
				res.on('end', function(data) {
					result = result.replace('\n', '');
					console.log('发送get请求[host=' + host + ',port=' + port + ',path=' + path + ']成功！ result: ', result);
					cb(result);
				});
			});
		});
	},

	mergePeersNoDuplicate: function mergePeersNoDuplicate(peers1, peers2, selfPeer) {
		for (i in peers2) {
			var peerToPush = peers2[i];

			if (selfPeer && selfPeer.host == peerToPush.host && selfPeer.port == peerToPush.port) {
				continue;
			}

			var alreadyExist = false;
			for (j in peers1) {
				if (peers1[j].host == peerToPush.host && peers1[j].port == peerToPush.port) {
					alreadyExist = true;
					break;
				}
			}

			if (!alreadyExist) {
				peers1.push(peerToPush);
			}
		}

		return peers1;
	},

	// writeObj2JsonFile: function writeObj2JsonFile(filePath, obj) {
	// 	var fs = require('fs');
	// 	var str = JSON.stringify(obj);
 //        fs.writeFile(filePath, str, function(err) {
 //            if(err) {
 //                console.error(err);
 //            }
 //        });
	// }














}