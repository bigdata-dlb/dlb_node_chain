var testDelegates = [
	{
		"secret":"CxPAPkPhKuJCX8JfcjEsxJzzXY6qGaJcsHyPAHN3HwPmFgf9MKNLhP6PQ8uuf2cSbKeU5qUidv9iSjbF1tBJ4NjarrSReRpeTbAp",
		"publicKey":"6d09241c3ba5ef79f6562032d61e5f7ff5417f06ac3b2ddbeb5165c95c418910"
	},
	{
		"secret":"B9mUpjFZeQzrQeWxusp6HdArvcjXVuVFnkYcWEGmviSSwmNEtqcWAWotdigXj78yh5nhNfte54PWq9ZeuZ3LEnRNiH35EaggsDzS",
		"publicKey":"24a9bd612b324c5207d92d3d2436e3267dced87487d79a8e5322d0584f0d76ad"
	},
	{
		"secret":"xn36RHLbJs3mBvT41tGKDA73Fwv9qwwZiuLM1pMqqi4RHCSgetscPKkGZAhxnbaYKYTKHM5YvVTqBcZLLYTxia2YD6RBUhzDVLQL",
		"publicKey":"2d50853c148f8cd8194e1097799cba7180fb25c54795be517bcc0cbcc464a2f3"
	},
	{
		"secret":"Rw982RU8sjdMC2FF2mkmk2rKJmvvHpnwfrKtUBs2cJv9RNXMEYZQYYiRNUoEeMLPKtycLr8LeWpqkGCoRKFjfPMsHJwHEwNRcDvU",
		"publicKey":"010e6c648e3d41795695fda64a3bc8eddd90d6e995a187a8642e620ecbeacd28"
	},
	{
		"secret":"iotJPwJomfydjKdsb1PdFVX1BBgTe5Hz8Z9FMe6W1Yb7fUQBPVLT518yXFzaxBwuRLHHc7D9pyf32BDMsCmqP2sbpn6aAQmR2bD2",
		"publicKey":"8f67ce161e311d1d2591040b1287a0a158c5741e700b3a9c5537f7375a4e00d8"
	},
	{
		"secret":"rijY7QJduXKhdQhQAiBbssVxQD1QcWw8D3ebPwVxQtJwh9gpX6tnYmQsnzHq5548yUFA8dFP9bJrkTbCqutMDAMfgNFFj6EkyzEo",
		"publicKey":"f723cb28f258d95f88fceff29535ebc7ee03836cd6d2eba9e1ab86ef7d9240eb"
	},
	{
		"secret":"fLKjAKJS6yxXEv9wzQg382A6NuVp1vkm1cdjcB2cQnkyJg284aqmuLBJ6MkfFHAh6jP6CwgAE3HPR9LEsEizbEqLVx4pSjcoS1uu",
		"publicKey":"c4213f63eaeecd8c61fd38472f520d368a5101f4df81960e07b218507f7b3d08"
	},
	{
		"secret":"q2Vyg93Rj18LcFMAe9iZi6SZMZTwScGUrFQfg1BQ19hWfpdJ5XqkHPgqrfUsfpV4WTp5FYk4y4Ly5QpncXR4GvNEeecXsabK32xX",
		"publicKey":"fafdf133ea3925e926b9d0c11e3eaf79272ccc4dd754ad0f69e2285be61783f4"
	},
	{
		"secret":"orxrSYeGaFDaD2wHzTD9ZjdxsVkDGa43UktBx5Et4QsXtVfLU1nukEwe7Gbdc6URuXmyPLwKJq6bdNVPeXpEdihNPamm5aoTYGLT",
		"publicKey":"5ce755adcbd667b75c220b60c80179c553336e68bf8c279ecab00f2ffde2fb78"
	},
	{
		"secret":"NJ8zv19VPpmt79D8HAYH2tuUeZXwWnTcQEQumWBSjLTGit3LuykcGHuzDikZP6SEpvXz4EzLG8ApeWsb4a8VEAXfdLpmquzTsP6u",
		"publicKey":"f4e4bcceae9f037687d27dbc25df162892b81c460c0dc6545896c8d3dd13d1b1"
	},
	{
		"secret":"vn36XMTUN3TtRQ8D7717hy6686rPU5WuzGq7SUsMQz6ABwn4XP9F71iRLwvfjxecpf8C94x2rsD2s5gYLJF7ZuVQTEiX1YPoL6zL",
		"publicKey":"f2f62882825a9fbefa6849eb954b882db87f616405a95ffed6c8fad5faf77e07"
	}];

function generatePublicKey(secret) {
	var	crypto = require('crypto');
	var ed = require('ed25519');
	var hash = crypto.createHash('sha256').update(secret, 'utf8').digest();
	var keypair = ed.MakeKeypair(hash);
	// console.log('publicKey: ' + keypair.publicKey.toString('hex'));
	// return '0x' + keypair.publicKey.toString('hex');
	return keypair.publicKey.toString('hex');
}

var startTime = 0;
var currSlot = -1;
var sendFlag = false;

var	crypto = require('crypto');
var ed = require('ed25519');
var	async = require('async');
var myUtils = require('./helpers/utils.js');
var specialAccountsArray = require('./special-accounts.json');

var my1stSecret = specialAccountsArray.accounts[0];
var my1stPublicKey = generatePublicKey(my1stSecret);

function loop()
{
	newSlot = Math.floor(((new Date()).getTime() - startTime) / (30 * 1000));
	if (currSlot != newSlot)
	{
		console.log('currSlot=' + currSlot);
		console.log('newSlot=' + newSlot);
		console.log('该执行了');
		currSlot = newSlot;
		if (!sendFlag)
		{
			async.eachSeries(testDelegates, function (delegate, cb) {
				var recipient = generatePublicKey(delegate.secret);
				var content = {secret: my1stSecret, publicKey: my1stPublicKey, amount: 10000000, recipientPublicKey: recipient};
				myUtils.httpPost('127.0.0.1', 3091, '/api/transactions/', content, function(data) {
					console.log("data:",data);
					var dataObj = JSON.parse(data);
					if (dataObj.success !== true) {
						cb('err: ' + data);
					} else {
						cb();
					}
				});
			}, function(err, res) {
				if (err) {
					console.log('err: ', err);
					return;
				}
				sendFlag = true;
			});
		}
		else
		{
			async.waterfall([function(cb) {
				setTimeout(function() {
					cb(null, null);
				}, 2000);
			}, function(arg, cb) {
				async.eachSeries(testDelegates, function (delegate, cb) {
					var content = {secret: delegate.secret, publicKey: delegate.publicKey, applyDelegate: true};
					myUtils.httpPost('127.0.0.1', 3091, '/api/delegates/addDelegate', content, function(data) {
						console.log("data:",data);
						var dataObj = JSON.parse(data);
						if (dataObj.success !== true) {
							cb('err: ' + data);
						} else {
							cb();
						}
					});
				}, function(err, res) {
					if (err) {
						console.log('err: ', err);
						return cb(err);
					}
					cb(null, null);
				});
			}, function(arg, cb) {
				var content = {secret: my1stSecret, publicKey: my1stPublicKey, votesList: []};
				for (i in testDelegates) {
					var voteItem = {delegate: testDelegates[i].publicKey, vote: 10000 - i * 100};
					content.votesList.push(voteItem);
				}
				// cb(null, content);
				setTimeout(function() {
					cb(null, content);
				}, 2000);
			// }
			}, function(arg, cb){
				myUtils.httpPost('127.0.0.1', 3091, '/api/delegates/voteDelegate', arg, function(data) {
					console.log("data:", data);
					cb(null, null);
				});
			}
			], function(err, res) {
				if (err) {
					console.log('err: ', err);
					return;
				}
				// process.exit(0);
			});
		}
	}
	setTimeout(loop, 500);
}

function testDelegateTx()
{
	myUtils.httpGet('127.0.0.1', 3091, '/api/delegates/startTime', function(data) {
		console.log("data:", data);
		var dataObj = JSON.parse(data);
		if (dataObj.success === true) {
			startTime = dataObj.startTime;
			currSlot = Math.floor(((new Date()).getTime() - startTime) / (30 * 1000));
			setTimeout(loop, 500);
		}
	});
}

testDelegateTx();
