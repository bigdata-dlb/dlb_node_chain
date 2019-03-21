function testHttp1()
{
	var http = require('http');
	http.createServer(function(req, res) {
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('Hello world!');
	}).listen(3000);
	console.log('Server started on localhost:3000; press Ctrl-C to terminate...');
}

// testHttp1();

function testHttp2()
{
	var http = require('http');
	http.createServer(function(req, res) {
		// 规范化url，去掉查询字符串、可选的反斜杠，并把它变成小写
		var path = req.url.replace(/\/?(?:\?.*)?$/, '').toLowerCase();
		switch(path) {
			case '':
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('Homepage');
				break;
			case '/about':
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('About');
				break;
			default:
				res.writeHead(404, { 'Content-Type': 'text/plain' });
				res.end('Not Found');
				break;
		}
	}).listen(3000);
	console.log('Server started on localhost:3000; press Ctrl-C to terminate...');
}

// testHttp2();

function testExpress1()
{
	var express = require('express');
	var app = express();
	app.set('port', 3000);
	//a6a1dd2fgy1fu3dy0jh5yg208c088qvb.gif

	//设置static需放置在所有设置路由之前
	app.use(express.static(__dirname + '/public'));
	app.use(require('body-parser')());

	var handlebars = require('express3-handlebars').create({defaultLayout: 'main'});
	app.engine('handlebars', handlebars.engine);
	app.set('view engine', 'handlebars');

	// app.use(express.static(__dirname + '/public'));

	app.get('/', function(req, res) {
		// res.type('text/plain');
		// res.send('Meadowlark travel');
		res.render('home');
	});

	app.get('/newsletter', function(req, res) {
		// 我们会在后面学到CSRF……目前，只提供一个虚拟值
		res.render('newsletter', {csrf: 'CSRF token goes here'});
	});

	app.get('/headers', function(req, res) {
		res.type('text/plain');
		var s = '';
		for (var name in req.headers)
			s += name + ': ' + req.headers[name] + '\n';
		res.send(s);
	});

	var fortunes = [
		"Conquer your fears or they will conquer you.",
		"Rivers need springs.",
		"Do not fear what you don't know.",
		"You will have a pleasant surprise.",
		"Whenever possible, keep it simple.",
	];

	app.get('/about', function(req, res) {
		// res.type('text/plain');
		// res.send('About meadowlark travel');
		var randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
		res.render('about', {fortune: randomFortune});
	});

	app.post('/process', function(req, res){
		console.log('Form (from querystring): ' + req.query.form);
		console.log('CSRF token (from hidden form field): ' + req.body._csrf);
		console.log('Name (from visible form field): ' + req.body.name);
		console.log('Email (from visible form field): ' + req.body.email);
		res.redirect(303, '/thank-you');
	});

	// 定制404 页面
	app.use(function(req, res) {
		// res.type('text/plain');
		res.status(404);
		// res.send('404 - Not found');
		res.render('404');
	});

	// 定制500 页面
	app.use(function(err, req, res, next){
		console.error(err.stack);
		// res.type('text/plain');
		res.status(500);
		// res.send('500 - Server Error');
		res.render('500');
	});

	app.listen(app.get('port'), function() {
		console.log( 'Express started on http://localhost:' +	app.get('port') + '; press Ctrl-C to terminate.' );
	})
}

// testExpress1();

function sendHttpGetRequest() {
	var http = require('http');
	var options = {
		host: '127.0.0.1',
		port: 3091,
		path: '/api/transactions'
	};

	http.get(options, function(res) {
		console.log('Got response: ' + res.statusCode);
		res.setEncoding('utf-8');
		res.on('data', function(data) {
			console.log('DATA: ', data.toString());
		})
	})
}

// sendHttpGetRequest();

function sendHttpPostRequest(param) {
	var http = require('http');
	var contents = JSON.stringify(param);
 
	var options = {
    	host:'127.0.0.1',
    	port: 3091,
    	path: '/api/transactions/',
    	method:'POST',
    	headers:{
        	'Content-Type':'application/json',
        	// 'Content-Type':'application/x-www-form-urlencoded',
        	'Content-Length':contents.length
    	}
	}
 
	var req = http.request(options, function(res){
    	res.setEncoding('utf8');
    	res.on('data',function(data){
        	console.log("data:",data);
    	});
	});
 
	req.write(contents);
	req.end();
}

function testConcat()
{
	var str1 = "Hello ";
	var str2 = "world!";
	var n = str1.concat(str2);
	console.log(n);

	var arr1 = [1,2,3,4,5];
	var arr2 = [6,5,3];
	var arr3 = arr1.concat(arr2);
	console.log(arr3);

	var hash = {};
    arr3 = arr3.reduce(function(item, next) {
        if (!hash[next]) {
          hash[next] = true;
          item.push(next);
        }
        return item
      }, []);
	console.log(arr3);
}

// testConcat();

// 注意了公钥字符串前面不能加0x
function generatePublicKey(secret) {
	var	crypto = require('crypto');
	var ed = require('ed25519');
	var hash = crypto.createHash('sha256').update(secret, 'utf8').digest();
	var keypair = ed.MakeKeypair(hash);
	// console.log('publicKey: ' + keypair.publicKey.toString('hex'));
	// return '0x' + keypair.publicKey.toString('hex');
	return keypair.publicKey.toString('hex');
}

function generateRandomSecret(length) {
	var secret = require("randomstring").generate({length: length, readable: true, charset: 'alphanumeric'});
	// console.log('secret: ' + secret);
	return secret;
}

// generateRandomSecret(81);

function testNumber()
{
	console.log(Number.MAX_VALUE);
	console.log(Number.MIN_VALUE);

	var sum = 0;
	for (var i = 1022; i > 0; i--) {
		sum += Math.pow(2, i);
	}
	console.log(sum);

	var a = 100.789;
	console.log(String(a));
	console.log(a.toString());

	var b = 1.7976931348623157e+308;
	console.log(String(b));
	console.log(b.toString());
}

// testNumber();

function testMongoDB1()
{
	var MongoClient = require('mongodb').MongoClient;
	var url = "mongodb://localhost:27017/";
 
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
		if (err) throw err;
		console.log("数据库已创建!");
		var dbase = db.db("dlb_node");
    	dbase.createCollection('test2', function (err, res) {
        	if (err) throw err;
        	console.log("创建集合!");
        	db.close();
    	});
	});
}

// testMongoDB1();

function testMongoDB2()
{
	var MongoClient = require('mongodb').MongoClient;
	var url = "mongodb://localhost:27017/";
 
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
    	if (err) throw err;
    	var dbo = db.db("dlb_node");
    	var myobj = { name: "菜鸟教程", url: "www.runoob", type: 'test' };
    	dbo.collection("test2").insertOne(myobj, function(err, res) {
        	if (err) throw err;
        	console.log("数据插入成功");
        	db.close();
    	});
	});
}

// testMongoDB2();

function testMongoDB3()
{
	var MongoClient = require('mongodb').MongoClient;
	var url = "mongodb://localhost:27017/";
 
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
    	if (err) throw err;
    	var dbo = db.db("dlb_node");
    	var myobj =  [
        	{ name: '菜鸟工具', url: 'https://c.runoob.com', type: 'test'},
        	{ name: 'Google', url: 'https://www.google.com', type: 'test'},
        	{ name: 'Facebook', url: 'https://www.google.com', type: 'test'}
			];
    	dbo.collection("test3").insertMany(myobj, function(err, res) {
        	if (err) throw err;
        	console.log("插入的文档数量为: " + res.insertedCount);
        	db.close();
    	});
	});
}

// testMongoDB3();

function testMongoDB4()
{
	var MongoClient = require('mongodb').MongoClient;
	var url = "mongodb://localhost:27017/";
 
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
    	if (err) throw err;
    	var dbo = db.db("dlb_node");
    	// dbo.collection("test3").find({}).toArray(function(err, result) { // 返回集合中所有数据
    	var aa = "runoob";
    	var findObj = {url:{$exists:true},$where:"(this.url.indexOf('" + aa + "') >= 0)"};
    	dbo.collection("test3").find(findObj).toArray(function(err, result) { // 测试条件查询
        	if (err) throw err;
        	console.log(result);
        	db.close();
    	});
	});
}

// testMongoDB4();

function testMongoDB5()
{
	var MongoClient = require('mongodb').MongoClient;
	var url = "mongodb://localhost:27017/";
 
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
    	if (err) throw err;
    	var dbo = db.db("dlb_node");
    	dbo.collection("account_dlb_balance").find({name: 'Google'}).toArray(function(err, result) { // 返回集合中所有数据
        	if (err) throw err;
        	console.log(result);
        	db.close();
    	});
	});
}

// testMongoDB5();

function testMongoDB6()
{
	var MongoClient = require('mongodb').MongoClient;
	var url = "mongodb://localhost:27017/";
 
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
    	if (err) throw err;
    	var dbo = db.db("dlb_node");
    	var whereStr = {name: 'Google'};  // 查询条件
    	var updateStr = {$set: { "url" : "http://www.GGGGGGG.com" }};
    	dbo.collection("account_dlb_balance").updateMany(whereStr, updateStr, function(err, res) {
        	if (err) throw err;
        	console.log("文档更新成功");
        	console.log(res.result.nModified + " 条文档被更新");
        	db.close();
    	});
	});
}

// testMongoDB6();

function testMongoDB7()
{
	var MongoClient = require('mongodb').MongoClient;
	var url = "mongodb://localhost:27017/";
 
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
    	if (err) throw err;
    	var dbo = db.db("dlb_node");
    	var whereStr = { type: "test" };  // 查询条件
    	dbo.collection("account_dlb_balance").deleteMany(whereStr, function(err, obj) {
        	if (err) throw err;
        	console.log(obj.result.n + " 条文档被删除");
        	db.close();
    	});
	});
}

// testMongoDB7();

function testZschema()
{
	var z_schema = require('z-schema');
	z_schema.registerFormat('publicKey', function (str) {
		try {
			var publicKey = new Buffer(str, "hex");
			return publicKey.length == 32;
		} catch (e) {
			return false;
		}
	});

	var aa = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
	var bb = {a: aa};
	schemaObj = new z_schema();
	schemaObj.validate(aa, {
		type: "string",
		format: "publicKey"
	}, function (err) {
		if (err) {
			console.log('shared.addTransactions ---- 参数校验失败!!!');
			console.log(err[0].message);
		} else {
			console.log('shared.addTransactions ---- 参数校验成功!!!');
		}
	});
}

// testZschema();

function testZschema2()
{
	var z_schema = require('z-schema');
	var cc = [1, 2, 3];
	// console.log(typeof cc);

	z_schema.registerFormat('myList', function (obj) {
		console.log(typeof obj);
		console.log(obj.length);
		if (typeof obj !== 'object' || obj.length <= 0) {
			return false;
		}

		for (i in obj) {
			if (typeof obj[i] !== 'object') {
				return false;
			}

			if (typeof obj[i].a == 'undefined') {
				return false;
			}

			console.log(typeof obj[i].a);
			// console.log(typeof obj[i].b);
		}

		return true;
	});

	var bb = [{a: 1}, {a: false}];
	schemaObj = new z_schema();
	schemaObj.validate(bb, {
		type: "array",
		format: "myList"
	}, function (err) {
		if (err) {
			console.log('shared.addTransactions ---- 参数校验失败!!!');
			console.log(err[0].message);
		} else {
			console.log('shared.addTransactions ---- 参数校验成功!!!');
		}
	});
}

// testZschema2();

function upsertDlbBalance(data)
{
	var MongoClient = require('mongodb').MongoClient;
	var url = "mongodb://localhost:27017/";
 
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
    	if (err) throw err;
    	var dbo = db.db("dlb_node");
    	var dlb_balance_collection = dbo.collection("account_dlb_balance");
    	dlb_balance_collection.find({publicKey: data.publicKey}).toArray(function(err, result) {
        	if (err) throw err;
        	if (result && result.length > 1) {
        		throw Error('Duplicate record!');
        	};

        	console.log('upsertDlbBalance -- result = ', result);
        	if (result && result.length > 0) {
        		var updateStr = {$set: {dlbBalance: data.dlbBalance}};
				dlb_balance_collection.updateOne({publicKey: data.publicKey}, updateStr, function(err, res) {
					if (err) throw err;
        			console.log('upsertDlbBalance -- 更新成功');
        			db.close();
				});
        	} else {
				dlb_balance_collection.insertOne(data, function(err, res) {
        			if (err) throw err;
        			console.log('upsertDlbBalance -- 插入成功');
        			db.close();
    			});
        	}
    	});
	});
}

function getDlbBalance(publicKey, cb)
{
	var MongoClient = require('mongodb').MongoClient;
	var url = "mongodb://localhost:27017/";
 
	MongoClient.connect(url, {useNewUrlParser: true}, function(err, db) {
    	if (err) throw err;
    	var dbo = db.db("dlb_node");
    	var dlb_balance_collection = dbo.collection("account_dlb_balance");
    	dlb_balance_collection.find({'publicKey': publicKey}).toArray(function(err, result) {
        	if (err) throw err;
        	if (result && result.length > 1) {
        		throw Error('Duplicate record!');
        	};
        	db.close();

        	console.log('getDlbBalance -- result = ', result);
        	if (result && result.length > 0) {
        		cb(null, result[0].dlbBalance);
        	} else {
				cb('Cannot find the record!');
        	}
    	});
	});
}

function main() {
	var specialAccountsArray = require('./special-accounts.json');
	// 我的第一个账号secret，以后的创世区块的接收70亿个DLB的账号也是这个
	var myFirstSecret = specialAccountsArray.accounts[0];	//'happy come now friend meaning I beautiful together kind air morning love philosophy';
	// console.log(myFirstSecret);
	myFirstPublicKey = generatePublicKey(myFirstSecret);
	// console.log(myFirstPublicKey);
	var mySecondSecret = specialAccountsArray.accounts[1];
	mySecondPublicKey = generatePublicKey(mySecondSecret);

	var param = {secret: myFirstSecret, amount: 99, recipientPublicKey: mySecondPublicKey, publicKey: myFirstPublicKey};
	// sendHttpPostRequest(param);

	getDlbBalance({publicKey: myFirstPublicKey}, function(err) {});
	// getDlbBalance({publicKey: mySecondPublicKey}, function(err) {});
}

// main();

function testUploadData()
{
	var	crypto = require('crypto');
	var ed = require('ed25519');
	var myUtils = require('./helpers/utils.js');
	var specialAccountsArray = require('./special-accounts.json');

	var myFirstSecret = specialAccountsArray.accounts[0];
	myFirstPublicKey = generatePublicKey(myFirstSecret);

	var rawTxt1 = require("randomstring").generate({length: 200, readable: true, charset: 'alphanumeric'});
	console.log(rawTxt1);
	var dataHash1 = crypto.createHash('sha256').update(rawTxt1, 'utf8').digest();

	var content = {secret: myFirstSecret, publicKey: myFirstPublicKey, dataHash: dataHash1.toString('hex'),
		dataType: 88, dataAmount: 200};
	myUtils.httpPost('127.0.0.1', 3091, '/api/data/uploadData', content, function(data) {
		console.log("data:",data);
	});
}

// testUploadData();

function testAddDelegate() {
	var	crypto = require('crypto');
	var ed = require('ed25519');
	var	async = require('async');
	var myUtils = require('./helpers/utils.js');
	var specialAccountsArray = require('./special-accounts.json');

	var my1stSecret = specialAccountsArray.accounts[0];
	var my1stPublicKey = generatePublicKey(my1stSecret);

	async.eachSeries(specialAccountsArray.accounts, function (secret, cb) {
		var publicKey = generatePublicKey(secret);
		var content = {secret: secret, publicKey: publicKey, applyDelegate: true};
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
			return;
		}

		myUtils.httpGet('127.0.0.1', 3091, '/api/delegates/', function(data) {
			console.log("data:", data);
			var dataObj = JSON.parse(data);
			if (dataObj.success === true) {
				var content = {secret: my1stSecret, publicKey: my1stPublicKey, votesList: []};
				for (i in dataObj.delegates) {
					var voteItem = {delegate: dataObj.delegates[i].publicKey, vote: 10000}
					content.votesList.push(voteItem);
				}

				myUtils.httpPost('127.0.0.1', 3091, '/api/delegates/voteDelegate', content, function(data) {
					console.log("data:", data);
				});
			}
		});
	});
}

// testAddDelegate();

function createTestDelegates()
{
	var delegates = [];
	for (i = 0; i < 10; i++) {
		var delegate = {};
		delegate.secret = generateRandomSecret(100);
		delegate.publicKey = generatePublicKey(delegate.secret);
		delegates.push(delegate);
	}
	console.log(JSON.stringify(delegates));
}

// createTestDelegates();

function testVVV()
{
	var delegatesNum = 11;
	for (var i = 0; i < 100; i++) {
		currentSlot = i;
		var startSlotOfCurrentRound = delegatesNum * Math.floor(currentSlot / delegatesNum);
		var param2 = {from: startSlotOfCurrentRound, to: currentSlot + 1};
		console.log(JSON.stringify(param2));
	}
}

// testVVV();

function testBlock()
{
	var	crypto = require('crypto');
	var ed = require('ed25519');
	var	async = require('async');
	var myUtils = require('./helpers/utils.js');
	var specialAccountsArray = require('./special-accounts.json');

	var my1stSecret = specialAccountsArray.accounts[0];
	var my1stPublicKey = generatePublicKey(my1stSecret);

	async.waterfall([function(cb) {
		async.eachSeries(specialAccountsArray.accounts, function (secret, cb) {
			var publicKey = generatePublicKey(secret);
			var content = {secret: secret, publicKey: publicKey, applyDelegate: true};
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
		myUtils.httpGet('127.0.0.1', 3091, '/api/delegates/', function(data) {
			console.log("data:", data);
			var dataObj = JSON.parse(data);
			if (dataObj.success !== true) {
				cb('err: ' + data, null);
			} else {
				var content = {secret: my1stSecret, publicKey: my1stPublicKey, votesList: []};
				for (i in dataObj.delegates) {
					var voteItem = {delegate: dataObj.delegates[i].publicKey, vote: Math.ceil(Math.random() * 10000)};
					content.votesList.push(voteItem);
				}
				cb(null, content);
			}
		});
	}, function(arg, cb){
		myUtils.httpPost('127.0.0.1', 3091, '/api/delegates/voteDelegate', arg, function(data) {
			console.log("data:", data);
			cb(null, null);
		});
	}, function(arg, cb) {
		setTimeout(function() {
			var content = {secret: my1stSecret, publicKey: my1stPublicKey};
			myUtils.httpPost('127.0.0.1', 3091, '/api/blocks/generateBlock', content, function(data) {
				console.log("data: ", data);
				cb(null, data);
			});
		}, 10000);
	}], function(err, res) {
		if (err) {
			console.log('err: ', err);
		}
	});
}

// testBlock();

// 随便取随便用
var testSecrets = [
	"byJr8qwy3Lhap9seVvriN7upY5VZpXBbqj5GMp1kiLGTfcyMdqTqsQSp67UmYykBXb966MDLt1KXwgTjnKFPxVYtBwt8kouEfinX",
	"QymgsmGpcpQ5ktQRAW3w9NhDf9TA9PKxSEoGGzZxnREsGSGWYU3ycox5JFk9HAAqoVNkREGEpEwSyJrKHLwcryaodiyxuakTKQU7",
	"X9VBSVdjvMxJvbQFV8yLFGCJRHEFt8r8WHmAkGWDjqdeQ1kyNzbPsPotgbGC1RkzG6daL8UFrh6tbRu1XUrWvcGDwHC7JU9XzNsC",
	"hmLKujshnN5U52JLQr27nVkPmhKZeuns8iUbdSZngw5NW1fvL9iVaVmAZXB8Ux8856JxWaBHMFdmtsuNXzBLFjTQR1Kzth3Wx5Q5",
	"WDqVCoACkA9aB51VEHGbetseBgr6kdWB6pXZkh1RGSR2m7sxkNof8te9dZoARtQ25Prt8REcVaaH6Jhe65MRSW7kB3vsHhee8eRJ",
	"P19n456mDPzS6cNFYvVpUfKZqBKK7c715gfYhJpmSvoh7oDyXxPbJvouTKf7nENNLEJTRARwjLLb4uaxzuCdaYA1reKbFiw9qhz7",
	"s7v9BeVyWGyjqKca4N2M9PkeuFZtjYj5wUvtbNMeGPdctQuP9kcbZxip7g6bnBsHiP8u8AHVNbUFDQgeVUA8Fw54GkJZpcmFHYLY",
	"HnzQbMvuMKehgaxHPr1hXHx9gabfjBGQ4JJLTGJDTBHzSwapkvYzujBZHjLEa9a57HPdFx4gg2qfnEReFpP37TkNngKCkDhLxXbD",
	"xJpRUmRtW3DMECL4cNsp8ayM3S3sYUdcddhi3vQk69RZBX26Ts7MgVFtFT6nzYF4bBDyw5yEEt5dhT73LdBAYdoNufBhXPVNN9fv",
	"1uyDDNM3kvQMgbTZs3rncWWoUv9kzpmdD5mzAYuAsyv1hfo2JRWd8S7tKbH7Sx2M3jSEz1TogrvymNLBphaXiPAaP8J3bQM1CbYc",
	"FSg7uNAUD4vdLgExonnJxdbzg7qAdbgHBcrcTGMFs2EJKbJFDgsx3VEESWxX996kTE4N6EazPG1Pat6YXQKUW6F4MNwFdyQDymD8",
	"rbVwii2W1dJHv9EiCA1xYTChFz9ctLcnp2hCBBH8CRoz93ct35DhGScyjaLcZVZjpo8yhV4LMEMAqsQWi5oqAJ5NEaJ1u1kratGR",
	"mjyc5dbqa97Th9SWfBWgQMymqCMegN3YMPUyZ9keRidTD2wL68MxHTsCZoupsJkR1jq8TALuVyi21btMtYdkCrbYx6cTKGFaH9dq",
	"hT3cbPM1VyFNR7W2m67mBk452qTpXjePQd5MAxpx9vGfmVaSHAbpvopxdH1xEPtvg995jqsfto74ok33KxTjUsQpXsVuHAJB9hE6",
	"roSqJLSfoJXfkLEMEEmyHmepWkKDbbZjyjoWmwKEQqCtC2ckE5dFb9q7LEFBSFJyZ8E5UtCygrVQ5nuTwBsdgDahdHiP5VmjwgvJ",
	"DbtWcWcaYE5VLXX4ULp4ecDBDTUbKNVxPEyrLzbZVkGH6E7Bh9dn8Kip7K4kMv8gnyNjV1uedcjFVf9Y1uCKQ6eKLD26Yet4EFUj",
	"x8xopGAym5UeGs3BKPEGMhh5UiM1TBuQvLiXfPV41krRBi6D8SCZ6GtFoHamYM6w7MEDHbii9FEv6cRSZj7KLLfqQRAyEoxJMV8x",
	"upn2W2n3RBJxUHyp5TAeX342VbrENfSse6XPdPPCnM5nC9MMaPytWSRARPhdeQusUqSrFn8ZNpVYhko5G7vS8Q6N26H2Mha4i6q3",
	"hkpoZQ162ucG1Goym88ntPEwfEwTVXSstMq7dTKQ33pETRFoJtgxfypjU1xLuhWenxyVgCV82KPZAfWr9PS1E8sLz4NNH9xSEA8M",
	"G4GEeFXGzpJ4nDcebLLbmWDf6vQ3QoUwztcXoaXRr3mfAeUtsdBH4ggtjpH9yBwiux56LDPE4wso3TRUXWu5dPkdZjqgXMMMRsE4",
	"tY4wtTFiEHCMJRpJwuAASgxfwk8oUxUAgDTXc8MMuc8wDiuM5cuGGYP7FkC6kBThPaZbFmejQxH2e389enUGkKzmrduAy8V5RGsv",
	"18aLTyLo3CCro5ENuk3BtDkPwXBsQ9YZR8QKZAWJjRV83Stq2yoPn6rgsSeQHzUaH6g5omBHUV3sesMqXhWepign3NbNKea3aLhu",
	"iH4SJorB8zqE2ZAasfRkG7X6jB9sdABVddKBTBhcTPeiojCBbiPdwGchZrzWbgzD8QUumT6H9tE9FTR96Kwtpvo1py1a1apUN1cm",
	"LQjgDRr69SuEFnXa9osRsEeCJZWzLuUggGFE5raBGj6ewk5S7gLJbcwniavxyafFVqEMiDuzffPVeTVYfryoBLimS178wsC4dQhu",
	"ZRnvitYbZP8fv1Xj3csyU4QiaCJEKoGpHorWAbgp7JVdvrWACzP8wxrbhTqaMBM7DBS1wEgerHg5VihALMWLaL73rmuZzATZq9Do",
	"YRNUZkVosW29Mf75ztPmDKbKVbz3mWndzCE5hB7r1W2KrJWPc6Eby9vbeYNcm9qrY1oEUbkx2RvTqf4K22cCxvWTBhUS5m92V4vH",
	"ydVaZyj8n7w81CxUss7SiVLdz85Q4Rh2qGWRa4LzHn9k8yQyQbo75jfjFAJURVGDXLz1Hw6k2vMcqfGVXL9Rty5kkWtVJYjna47J",
	"kCFZEjZpoaq6mPM8NDGzEFCCErY3JtLFhLMZ8A5a7BWcz9vyssbtFNtgawLRpjrv3hd3cSrz1xtDNSi8hedjcJcWDeirxXpf5wKk",
	"yCwwtgB7vTUKSGjpA4xHG4yhZFoAyAkAYwjN7vX3Wy49uhMnn7cf26d5tQj2v325e9Jz7N3onZheYDMUYR7h28mFZ4mBk9MhhmBM",
	"wjhXffmExpxqfXSBo57CSwDDmXQJYcwB2anqYsM8Ch9kdkmyN5HJLu3LQVPvdXhWek6CFeNsLYxbcGihf8YuV7c6zDXQWsgiwVLQ"
];

// 测试向节点发送一个SEND交易，看看打包效果
function testSendTx()
{
	var	crypto = require('crypto');
	var ed = require('ed25519');
	var	async = require('async');
	var myUtils = require('./helpers/utils.js');
	var specialAccountsArray = require('./special-accounts.json');

	var my1stSecret = specialAccountsArray.accounts[0];
	var my1stPublicKey = generatePublicKey(my1stSecret);

	async.waterfall([function(cb){
		async.eachSeries(testSecrets, function (secret, cb) {
			var recipient = generatePublicKey(secret);
			var content = {secret: my1stSecret, publicKey: my1stPublicKey, amount: 1234, recipientPublicKey: recipient};
			myUtils.httpPost('bg6g24.natappfree.cc', 80, '/api/transactions/', content, function(data) {
				console.log("data:",data);
				var dataObj = JSON.parse(data);
				if (dataObj.success !== true) {
					cb('err: ' + data);
				} else {
					// setTimeout(cb, 13000);
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
	}], function(err, res) {
		if (err) {
			console.log(err);
		}
	});
}

// testSendTx();

function createTestSecrets()
{
	var secrets = [];
	for (i = 0; i < 30; i++) {
		secrets.push(generateRandomSecret(100));
	}
	console.log(JSON.stringify(secrets));
}

// createTestSecrets();

function testBlockHeight() {
	var myUtils = require('./helpers/utils.js');
	myUtils.httpGet('127.0.0.1', 3091, '/api/blocks/getBlockByHeight?height=1', function(data) {
		console.log("data:",data);
	});
}

// testBlockHeight()

function testArraySort()
{
	var arr = [8, 4, 12, 0, 34, 29, 17, 5, 87, 102, 66];
	var arr2 = arr.sort(function(a, b) {
		if (a < b)	return 1;
		if (a > b)	return -1;
		return 0;
	});
	console.log(arr2);
}

// testArraySort();

function testCheckDelegate() {
	var myUtils = require('./helpers/utils.js');
	myUtils.httpGet('127.0.0.1', 3091, '/api/delegates/', function(data) {
		console.log("data:",data);
	});
}

// testCheckDelegate();

function getDlbBalance(data, cb) {
	var mongoDb = require('mongodb');
	var mongoUrl = "mongodb://localhost:27017/";
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
        		console.log('Account.prototype.getDlbBalance -- 数据库中有该账户重复的记录：', data.publicKey);
        		return cb('Duplicate data record: ' + data.publicKey);
        	}

        	if (result.length <= 0) {
        		console.log('Account.prototype.getDlbBalance -- 数据库中没有该账户的记录：', data.publicKey);
        		return cb(null, 0);
        	}
        	
        	console.log('Account.prototype.getDlbBalance -- result=', result);
        	cb(null, result[0].dlbBalance);
    	});
	});
}

function getSpecialAccounts()
{
	var specialAccountsArray = require('./special-accounts.json');
	console.log(specialAccountsArray.accounts);
	for (a in specialAccountsArray.accounts) {
		console.log(specialAccountsArray.accounts[a].length);
	}
}

// getSpecialAccounts();

function testBoolean()
{
	var a = true;
	console.log(typeof a === 'boolean');
}

// testBoolean();

function testBufferBoolean()
{
	var a = false;
	var buf = new Buffer(a ? 'true' : 'false', 'utf8');
	console.log(buf);
}
// testBufferBoolean();

function testAsyncSeries()
{
	var async = require('async');
	async.series([
    	function(callback) {
        	// do some stuff ...
        	// callback(null, 'one');
        	console.log('one');
        	callback();
    	},
    	function(callback) {
        	// do some more stuff ...
        	console.log('two');
        	// callback(null, 'two');
    	}
	], function(err, results) {
    	// results is now equal to ['one', 'two']
    	console.log(results);
	});
}

// testAsyncSeries();

function testTypeof()
{
	a = {};
	console.log(typeof a.b);
}

// testTypeof();

function testUtilIsArray()
{
	var a = [1, 2, 3];
	var b = {};

	var util = require('util');
	console.log(util.isArray(b));
}

// testUtilIsArray();

function test222()
{
	var pk1 = generatePublicKey(generateRandomSecret());
	var res = parseInt(pk1.substr(0, 16), 16);
	console.log(res);
}

// test222();

function testSequence()
{
	var Sequence = require('./helpers/sequence.js');
	var sequence = new Sequence({
			onWarning: function (current, limit) {
				console.log("Main queue", current)
			}
		});

	// sequence.add(function(cb) {
	// 	setInterval(function() {
	// 		console.log("" + 1);
	// 	}, 1000);
	// }, function(err, res) {
	// });

	setInterval(function() {
			console.log("" + 1);
		}, 1000);

	setInterval(function() {
			console.log("" + 2);
		}, 1000);

	console.log("" + 3);

	// sequence.add(function(cb) {
	// 	setInterval(function() {
	// 		console.log("" + 2);
	// 	}, 1000);
	// }, function(err, res) {
	// });
}

// testSequence();

var testAccounts = [
{
	"secret":"R5dKCJdf5iuXd1g1xvEDDJ4fgw319L5NA564UzZJf6wGXqzg5CriocZqQstndJB4VhhJcASAembz9ygmsKikpYfcT6CWmHFmbLZ2",
	"publicKey":"69056d74febb7f15c33f1b44aca343799065ad8c4df505058f6a7c4866495f37"
},
{
	"secret":"8bbrrcASmYcKNf7tYhHhiLugtcLL1wziVnoNcS8cE34mkXBvfbLrzVG1LinpHy5yak5vdxKhVkfYZcdc2dfhdCkd9v66MtHdudzx",
	"publicKey":"a378cab04b831a2577298cce706ab0da6748f27cf26a6c10307e736282bfe1d2"
},
{
	"secret":"LhSeTDSEvbr63GNsaWcXQGeNkYA55pCYrH4Ftuk3dTi5ntBjSUVaSc7Y7sfHuwDS6KEQSKePEkZ9uYtrMqW5LHsJAeVcMqwLbbaR",
	"publicKey":"e2ac695c282bea13b5659c32681a1265ddaf5f917eefedea3f6bea3fa9fcb933"
},
{
	"secret":"Chkf9ppx8VUg7L5xmnbkpmGEJvPE6u89tr8JDhdpReRuxkzMdgPiYnXhqvyNtDLx2ew9hYaoWvHpoh8N32iBpkPEH2oMVoTa1CMg",
	"publicKey":"09534dedf97a9c5dc689d0fce17010892c9bf4ac3c4f6bdd311eb08a6e72a72c"
},
{
	"secret":"nPFFLiGHM84vA2kX53KivfYfLRaRpEzNotj5tpzxqn8dbMvME6FrU9fSjAceFWWg7RuxiXj8bh5CaTvKd1gw9HTRA1Z169GBvkfh",
	"publicKey":"66449c236cfd58cf21ce219887a6b5714244c9f6bb4441c083e4c08dd1d007f8"
},
{
	"secret":"aLgvrWBo1u75GPL5kFhfW58xFhr4bouxALMXoQoW9UjFcgomUsiuEnKX9w5LuhZDSUVt4DJKMqV4SzeKN23AmujVRJCRMBVocfnw",
	"publicKey":"6cc63fcf3aa18f22b46b321ee086525d26ccc0dfc828856533d0e7e39a52fb3b"
},
{
	"secret":"PySZjHhZ1HBEvhD5M2xsqpasjdCDw5yr1hpPWJfn6BqtrjbMdrKDd1UmpYkFwpu1GHqx7EhgV3sKoEkRwBPdTdjCyAjzCvS7F5HB",
	"publicKey":"49e2b962383010dc8783edd16f7b8952306fd4f82d6d5c2d310fda36ecd0cb4a"
},
{
	"secret":"eNSqqMpJaHohAWVHQ4bbc4Zaq9UyYR2TuBUnsE8pnePisiSej8kme5KLQ3THy4vmEDVTPD7TmpXiU4xkbUUgjQwDiPVyepF1nWFk",
	"publicKey":"2169aa6ab85c1148b68464c4b7af8469d5658640e6f66c77c8bb9ac74d68e7a5"
},
{
	"secret":"UrNAbQp7CYjfCjj2KbyarpVAY9hUb4tsXFubPGc7aHbRKDHCJUG5E5TGRGkn5mG4TTaeob9GhPdSd7zXVqBGwKhrvj4VzRYyLBm4",
	"publicKey":"2d151d535bafc249fff64212fc48cb7bdc70e5b99d7013facda1689dc86e42b1"
},
{
	"secret":"GpABsyNidLH7pgBg49rFH9sNxEsVxs7NEycUgRZr3Um25WcaSwjoFgjKSyR9N1sH5n5nansRPjoNJ1HbUNJxmVQN31XpuTEMVP1E",
	"publicKey":"93edf9aef37721ed2708622fb7c988b12ab15dcf09f7b20cb7f69c299b4c6e03"
}]

function testRandom()
{
	var i = Math.floor(Math.random() * 100);
	console.log(i);
}

// testRandom();

// 测试多个交易并发
function testManyTx()
{
	var startTime = (new Date()).getTime();
	var	crypto = require('crypto');
	var ed = require('ed25519');
	var	async = require('async');
	var myUtils = require('./helpers/utils.js');
	var specialAccountsArray = require('./special-accounts.json');

	var my1stSecret = specialAccountsArray.accounts[0];
	var my1stPublicKey = generatePublicKey(my1stSecret);

	for (i in testAccounts)
	{
		var recipient = generatePublicKey(testAccounts[i].secret);
		// var c = Math.floor(Math.random() * 100);
		// if (c <= 0) c = 8;
		var content = {secret: my1stSecret, publicKey: my1stPublicKey, amount: 9990000, recipientPublicKey: recipient};
		myUtils.httpPost('127.0.0.1', 3091, '/api/transactions/', content, function(data) {
			console.log("data:",data);
			// var dataObj = JSON.parse(data);
			// if (dataObj.success !== true) {
			// 	cb('err: ' + data);
			// } else {
			// 	//setTimeout(cb, 13000);
			// 	cb();
			// }
		});
	}

	// setTimeout(testManyTx, (Math.floor(Math.random() * 10) + 7) * 1000);
}

// testManyTx();

function testUploadData0()
{
	var	crypto = require('crypto');
	var myUtils = require('./helpers/utils.js');

	var specialAccountsArray = require('./special-accounts.json');

	var my1stSecret = specialAccountsArray.accounts[0];
	var my1stPublicKey = generatePublicKey(my1stSecret);


	var content = {secret: my1stSecret, publicKey: my1stPublicKey, amount: 10000, recipientPublicKey: testAccounts[0].publicKey};
	myUtils.httpPost('192.168.199.168', 3091, '/api/transactions/', content, function(data) {
			console.log("data:",data);
			var dataObj = JSON.parse(data);
			if (dataObj.success !== true) {
				console.log('err: ' + data);
			} else {
				setTimeout(function() {
					var txt0 = generateRandomSecret(120);
					var hash0 = crypto.createHash('sha256').update(txt0, 'utf8').digest().toString('hex');
					var content = {
						secret: testAccounts[0].secret,
						publicKey: testAccounts[0].publicKey,
						dataHash: hash0,
						dataType: 0,	// 纯文本就取值0
						dataAmount: 120
					};
					myUtils.httpPost('192.168.199.168', 3091, '/api/data/uploadData', content, function(data) {
						console.log("data:",data);
					});
				}
					, 10000);
				// cb();
			}
		});
}

// testUploadData0();

function testUploadData()
{
	var my1stSecret = 'happy come now friend meaning I beautiful together kind air morning love philosophy';
	var my1stPublicKey = generatePublicKey(my1stSecret);

	var	crypto = require('crypto');
	var myUtils = require('./helpers/utils.js');
	var txt0 = generateRandomSecret(120);
	var hash0 = crypto.createHash('sha256').update(txt0, 'utf8').digest().toString('hex');
	var content = {
		secret: my1stSecret,
		publicKey: my1stPublicKey,
		dataHash: hash0,
		dataType: '20',	// 纯文本就取值0
		dataAmount: '12045'
	};

	myUtils.httpPost('127.0.0.1', 3091, '/api/data/uploadData', content, function(data) {
		console.log("data:",data);
	});

	console.log("Here");
}

// testUploadData();

var remoteIp = '127.0.0.1';		//'192.168.199.168';

function testUseData()
{
	var	crypto = require('crypto');
	var myUtils = require('./helpers/utils.js');
	var	async = require('async');

	var dataHashArray = [];
	var indexArray = [];
	for (var i = 0; i < 40; i++) {
		indexArray.push(i);
	}

	async.eachSeries(indexArray, function(index, cb) {
		var txt0 = generateRandomSecret(150);
		var hash0 = crypto.createHash('sha256').update(txt0, 'utf8').digest().toString('hex');
		var content = {
			secret: testAccounts[0].secret,
			publicKey: testAccounts[0].publicKey,
			dataHash: hash0,
			dataType: '101',	// 纯文本就取值0
			dataAmount: '150'
		};

		dataHashArray.push(hash0);

		// var txt1 = generateRandomSecret(150);
		// var hash1 = crypto.createHash('sha256').update(txt1, 'utf8').digest().toString('hex');
		// dataHashArray.push(hash1);
		
		myUtils.httpPost(remoteIp, 3091, '/api/data/uploadData', content, function(data) {
			console.log("data:",data);
			setTimeout(cb, 200);
		});
	}, function(err) {
		setTimeout(function() {
			var content = {
				secret: testAccounts[1].secret,
				publicKey: testAccounts[1].publicKey,
				useDataList: []
			};

			for (i in dataHashArray) {
				content.useDataList.push({dataHash: dataHashArray[i], reward: 1});
			}
			// console.log(JSON.stringify(content));

			myUtils.httpPost(remoteIp, 3091, '/api/data/useData', content, function(data) {
				console.log("data:",data);
			});

			setTimeout(testUseData, 5000);
		}, 60000);
	});

	
	
}

testUseData();

function sendHttpGetRequest2() {
	var http = require('http');
	var options = {
		host: 'bg6g24.natappfree.cc',
		// host: '127.0.0.1',
		port: 80,
		path: '/api/delegates/fee?txType=delegate'
	};

	http.get(options, function(res) {
		console.log('Got response: ' + res.statusCode);
		res.setEncoding('utf-8');
		res.on('data', function(data) {
			console.log('DATA: ', data.toString());
		})
	})
}

// sendHttpGetRequest2();

function testQuerystring() {
	var querystring = require('querystring');
	// var obj = {a: 1, b: true, c: 'dfg'};
	// console.log(querystring.stringify(obj));
	var str = 'a=1&b=true&c=dfg';
	var obj = querystring.parse(str);
	console.log(typeof obj.b);
}

// testQuerystring();

function testJsonStr()
{
	// var a = {aa: 257, bb: false, cc: 'huihuio'};
	// console.log(JSON.stringify(a));
	var str = "{\"aa\":257,\"bb\":false,\"cc\":\"huihuio\"}";
	console.log(JSON.parse(str).aa);
}

// testJsonStr();

function sendMoney(recipient)
{
	var	crypto = require('crypto');
	var myUtils = require('./helpers/utils.js');

	var my1stSecret = 'happy come now friend meaning I beautiful together kind air morning love philosophy';
	var my1stPublicKey = generatePublicKey(my1stSecret);


	var content = {secret: my1stSecret, publicKey: my1stPublicKey, amount: 3000000, recipientPublicKey: recipient};
	myUtils.httpPost('127.0.0.1', 3091, '/api/transactions/', content, function(data) {
		console.log("data:",data);
	});
}

// sendMoney('69056d74febb7f15c33f1b44aca343799065ad8c4df505058f6a7c4866495f37');

function testFsExists() {
	require('fs').exists("./special-accounts.json", function(exists) {
		console.log(exists ? "文件存在" : "文件不存在");
	});
}

// testFsExists();

function testArrayIndexOf()
{
	var actedBlockGenerators= [ '010e6c648e3d41795695fda64a3bc8eddd90d6e995a187a8642e620ecbeacd28',
  '24a9bd612b324c5207d92d3d2436e3267dced87487d79a8e5322d0584f0d76ad',
  '2d50853c148f8cd8194e1097799cba7180fb25c54795be517bcc0cbcc464a2f3',
  '010e6c648e3d41795695fda64a3bc8eddd90d6e995a187a8642e620ecbeacd28',
  '010e6c648e3d41795695fda64a3bc8eddd90d6e995a187a8642e620ecbeacd28',
  '010e6c648e3d41795695fda64a3bc8eddd90d6e995a187a8642e620ecbeacd28' ];

  console.log(actedBlockGenerators.indexOf('010e6c648e3d41795695fda64a3bc8eddd90d6e995a187a8642e620ecbeacd28'));
}

// testArrayIndexOf();

function testGetBlockAsync()
{
	var myUtils = require('./helpers/utils.js');
	var queryObj = {hash: "476964c7a37f3bc501e66a7fedff46aeb3202f5db8f6f4c4ce74fa9a80e60a18",
		height: 3, txHashArray: ["17e7f3333b3dacaef0c6cf380bd59a9ce9b986adda27fd7723c603af36dec605","1b08b216dd65cde842f5f8b37348a04933ac6340b5ddfc287413ba79fa2715e6"]};
	// var url = '/api/blocks/getBlockAsync?' + require('querystring').stringify(queryObj);
	var url = '/api/blocks/getBlockAsync?hash=6e7d33418ab729ddad7cc72faf745162ab3b0f086d5b9497edc3f199b97f4561&height=13&txHashArray=401108e08f4fda37317159c04ff23b5257981684f477869e42d28cba6ce611fb&txHashArray=a95e0596cc1aa6da6e6fc8f7a1f51eb3524c40a25844c7112f02144171c7c360&txHashArray=9fad2dabc13010fdcee33010d27441fd24eb7f09d33c1d1655247efb06417673&txHashArray=889a62e76cdb4b53b88b41cb98def3deb3c98427c338611b4c3b1528dfddc68a&txHashArray=35dbc3d823df0da00867daf84e34b24a979a8aaf461a80fa79ecfb735d3cb482&txHashArray=0b58f55846818fdd928ebb1dddfebc77a39afdca2c9ea53a7be97b5d2512774b&txHashArray=5ca6a1be182ef7d7e2185e85f95ec093397b82bdd315910da7760f64f0181878&txHashArray=24ed187fbdae85265e02fbbdc1ff7958bf6ec1332b6c73daa7822a8c011f79fe&txHashArray=6840ef33ffc6653ad8430ca163deea9c89f461e7f4187a289a36c197203a1ffa&txHashArray=0da95f2740ce7702fb5ec3671f674bfa21362f55ec0a40439aa799a822624887&txHashArray=2e1da546aea4537ce044554a2f2dec57f0338a8d824544f1e7c028d6bb2f8529';
	myUtils.httpGet('192.168.199.168', 3091, url, function(resData) {
		console.log(resData);
	});
}

// testGetBlockAsync();

function testBuffer()
{
	var a = '24a9bd612b324c5207d92d3d2436e3267dced87487d79a8e5322d0584f0d76ad';
	var b = Buffer.from(a, 'hex');
	console.log(b.length);
	console.log(typeof b[1]);

	ByteBuffer = require("bytebuffer");
	var c = new ByteBuffer(1, true);
	c.writeByte(0);
	c.flip();
	console.log(c.toBuffer());

}

// testBuffer();








