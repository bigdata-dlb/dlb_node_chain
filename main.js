var program = require('commander');
var Logger = require('./logger.js');
var async = require('async');
var z_schema = require('z-schema');
var path = require('path');
var Sequence = require('./helpers/sequence.js');
var utils = require('./helpers/utils.js');
var util = require('util');
// var packageJson = require('./package.json');

// process.stdin.resume();

program
	.version('0.0.1')
	.option('-c, --config <path>', 'Config file path')
	.option('-p, --port <port>', 'Listening port number')
	.option('-a, --address <ip>', 'Listening host name or ip')
	.option('-b, --blockchain <path>', 'Blockchain db path')
	.option('-x, --peers [peers...]', 'Peers list')
	.option('-l, --log <level>', 'Log level')
	.parse(process.argv);

// console.log(typeof gc);
// if (typeof gc !== 'undefined') {
// 	setInterval(function () {
// 		gc();
// 	}, 60000);
// }

appConfig = {port:3091, address: '0.0.0.0', consoleLogLevel:"info", fileLogLevel:"info",
	dapp:{masterrequired:false}, ssl:{enabled:false},
	modules: {
		// "server": "./modules/server.js",
		"accounts": "./modules/accounts.js",
		"transactions": "./modules/transactions.js",
		"blocks": "./modules/blocks.js",
		"data": "./modules/data.js",
		"transport": "./modules/transport.js",
		"peer": "./modules/peer.js",
		"delegates": "./modules/delegates.js",
	},
	special_accounts: [],
	// special_accounts: [
	// 	"happy come now friend meaning I beautiful together kind air morning love philosophy",
	// 	"let both sides for first time formulate serious and precise proposals the inspect",
	// 	"so my ask not what your country can do you however different we may be new dignity",
	// 	"is of national consecration certain that on this day fellow expect truth participate",
	// 	"level human rights then take case black man before nations respect women fully reason",
	// 	"people are fighting have to stick tongue in cheek never clearly comprehended upon at",
	// 	"just want give little briefing guerrilla warfare because know takes heart universal",
	// 	"his dream peace after World War shattered hard reality power politics Woodrow Wilson",
	// 	"order things cannot always endure registered protest against it recognize truly enjoy",
	// 	"accommodation such as hotels restaurants theaters retail stores without being forced",
	// 	"resort demonstrations street generosity should able unite regardless party or clear"
	// ],
	peers: {
		myself: {host: '6nnrih.natappfree.cc', port: 80},
		peerList: [{host: 'dlb.natapp1.cc', port: 80}],
		// peerList: [],
		broadcast: false
	},
	accounts: [],
	api: {access: {whiteList: []}}};

// if (program.peers) {
// 	if (typeof program.peers === 'string') {
// 		appConfig.peers.list = program.peers.split(',').map(function (peer) {
// 			peer = peer.split(":");
// 			return {
// 				ip: peer.shift(),
// 				port: peer.shift() || appConfig.port
// 			};
// 		});
// 	} else {
// 		appConfig.peers.list = [];
// 	}
// }

var logger = new Logger({echo: appConfig.consoleLogLevel, errorLevel: appConfig.fileLogLevel});
logger.info(appConfig);

process.on('error', function (err) {
	logger.fatal('Domain master', { message: err.message, stack: err.stack });
	process.exit(0);
});

var modules = [];
async.auto({
	logger: function (cb) {
		cb(null, logger);
	},

	public: function (cb) {
		cb(null, path.join(__dirname, 'public'));
	},

	scheme: function (cb) {
		z_schema.registerFormat("hex", function (str) {
			try {
				new Buffer(str, "hex");
			} catch (e) {
				return false;
			}
			return true;
		});

		z_schema.registerFormat('publicKey', function (str) {
			return utils.isPublicKeyString(str);
		});

		z_schema.registerFormat('hash', function (str) {
			return utils.isHashString(str);
		});

		z_schema.registerFormat('signature', function (str) {
			return utils.isSignatureString(str);
		});

		z_schema.registerFormat('votesList', function (obj) {
			return utils.isVotesList(obj);
		});

		z_schema.registerFormat('useDataList', function (obj) {
			return utils.isUseDataList(obj);
		});

		z_schema.registerFormat('peerList', function (obj) {
			return utils.isPeerList(obj);
		});

		z_schema.registerFormat('hashArray', function (obj) {
			return utils.isHashArray(obj);
		});

		cb(null, new z_schema());
	},

	config: ['logger', function (scope, cb) {
		if (appConfig.dapp.masterrequired && !appConfig.dapp.masterpassword) {
			var randomstring = require("randomstring");
			appConfig.dapp.masterpassword = randomstring.generate({
				length: 20,
				readable: true,
				charset: 'alphanumeric'
			});
			scope.logger.info("masterpassword: "+appConfig.dapp.masterpassword);
			cb(null, appConfig);
		} else {
			cb(null, appConfig);
		}
	}],

	genesisblock: function(cb) {
		cb(null, {
			block: require('./genesisBlock.json')
		});
	},

	network: ['config', function (scope, cb) {
		var express = require('express');
		var app = express();
		var server = require('http').createServer(app);
		var io = require('socket.io')(server);

		if (scope.config.ssl.enabled) {
			var privateKey = fs.readFileSync(scope.config.ssl.options.key);
			var certificate = fs.readFileSync(scope.config.ssl.options.cert);

			var https = require('https').createServer({
				key: privateKey,
				cert: certificate
			}, app);

			var https_io = require('socket.io')(https);
		}

		cb(null, {
			express: express,
			app: app,
			server: server,
			io: io,
			https: https,
			https_io: https_io
		});
	}],

	sequence: ["logger", function (scope, cb) {
		var sequence = new Sequence({
			onWarning: function (current, limit) {
				scope.logger.warn("Main queue", current)
			}
		});
		cb(null, sequence);
	}],

	connect: ['config', 'logger', 'network', function (scope, cb) {
		var path = require('path');
		var bodyParser = require('body-parser');
		var methodOverride = require('method-override');
		// var requestSanitizer = require('./helpers/request-sanitizer');
		var queryParser = require('express-query-int');

		scope.network.app.engine('html', require('ejs').renderFile);
		scope.network.app.use(require('express-domain-middleware'));
		scope.network.app.set('view engine', 'ejs');
		scope.network.app.set('views', path.join(__dirname, 'public'));
		scope.network.app.use(scope.network.express.static(path.join(__dirname, 'public')));
		scope.network.app.use(bodyParser.urlencoded({extended: true, parameterLimit: 5000}));
		scope.network.app.use(bodyParser.json());
		scope.network.app.use(methodOverride());

		var ignore = ['id', 'name', 'lastBlockId', 'blockId', 'username', 'transactionId', 'address', 'recipientId', 'senderId', 'senderUsername', 'recipientUsername', 'previousBlock'];
		scope.network.app.use(queryParser({
			parser: function (value, radix, name) {
				if (ignore.indexOf(name) >= 0) {
					return value;
				}

				if (isNaN(value) || parseInt(value) != value || isNaN(parseInt(value, radix))) {
					return value;
				}

				return parseInt(value);
			}
		}));

		// scope.network.app.use(require('./helpers/zscheme-express.js')(scope.scheme));

		scope.network.app.use(function (req, res, next) {
			console.log(req.url);
			var parts = req.url.split('/');
			var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

			if (parts.length > 1) {
				if (parts[1] == 'api') {
					if (scope.config.api.access.whiteList.length > 0) {
						if (scope.config.api.access.whiteList.indexOf(ip) < 0) {
							res.sendStatus(403);
						} else {
							next();
						}
					} else {
						next();
					}
				} else if (parts[1] == 'peer') {
					if (scope.config.peers.blackList.length > 0) {
						if (scope.config.peers.blackList.indexOf(ip) >= 0) {
							res.sendStatus(403);
						} else {
							next();
						}
					} else {
						next();
					}
				} else {
					next();
				}
			} else {
				next();
			}
		});

		scope.network.server.listen(scope.config.port, scope.config.address, function (err) {
			scope.logger.log("DLB blockchain started: " + scope.config.address + ":" + scope.config.port);

			if (!err) {
				if (scope.config.ssl.enabled) {
					scope.network.https.listen(scope.config.ssl.options.port, scope.config.ssl.options.address, function (err) {
						scope.logger.log("Ebookcoin https started: " + scope.config.ssl.options.address + ":" + scope.config.ssl.options.port);

						cb(err, scope.network);
					});
				} else {
					cb(null, scope.network);
				}
			} else {
				cb(err, scope.network);
			}
		});

	}],

	bus: function (cb) {
		var changeCase = require('change-case');
		var bus = function () {
			this.message = function () {
				var args = [];
				Array.prototype.push.apply(args, arguments);
				var topic = args.shift();
				modules.forEach(function (module) {
					var eventName = 'on' + changeCase.pascalCase(topic);
					if (typeof(module[eventName]) == 'function') {
						module[eventName].apply(module[eventName], args);
					}
				})
			}
		}
		cb(null, new bus)
	},

	mongoDb: function (cb) {
		var mongoDb = require('./helpers/mongoDb.js');
		cb(null, mongoDb);
	},

	logic: ['mongoDb', 'bus', 'scheme', 'logger', 'genesisblock', function (scope, cb) {
		var Transaction = require('./logic/transaction.js');
		var Block = require('./logic/block.js');
		var Account = require('./logic/account.js');

		async.auto({
			bus: function (cb) {
				cb(null, scope.bus);
			},
			mongoDb: function (cb) {
				cb(null, scope.mongoDb);
			},
			scheme: function (cb) {
				cb(null, scope.scheme);
			},
			logger: function (cb) {
				cb(null, scope.logger);
			},
			genesisblock: function (cb) {
				cb(null, {
					block: scope.genesisblock.block
				});
			},
			account: ["mongoDb", "bus", "scheme", 'genesisblock', 'logger', function (scope, cb) {
				new Account(scope, cb);
			}],
			transaction: ["mongoDb", "bus", "scheme", 'genesisblock', 'account', 'logger', function (scope, cb) {
				new Transaction(scope, cb);
			}],
			block: ["mongoDb", "bus", "scheme", 'genesisblock', 'account', "transaction", 'logger', function (scope, cb) {
				new Block(scope, cb);
			}]
		}, cb);
	}],

	modules: ['network', 'connect', 'config', 'logger', 'bus', 'sequence', 'genesisblock', 'logic', 'mongoDb', function (scope, cb) {
		var tasks = {};
		Object.keys(appConfig.modules).forEach(function (name) {
			tasks[name] = function (cb) {
				var d = require('domain').create();

				d.on('error', function (err) {
					scope.logger.fatal('Domain ' + name, {message: err.message, stack: err.stack});
				});

				d.run(function () {
					scope.logger.debug('Loading module', name);
					var Klass = require(appConfig.modules[name]);
					var obj = new Klass(cb, scope);
					modules.push(obj);
				});
			}
		});

		async.parallel(tasks, function (err, results) {
			// console.log(JSON.stringify(results));
			cb(err, results);
		});
	}],

	ready: ['modules', 'bus', function (scope, cb) {
		scope.bus.message("bind", scope.modules);
		cb();
	}]

}, function (err, scope) {
	if (err) {
		logger.fatal(err)
	} else {
		scope.logger.info("Modules ready and launched");

		process.once('cleanup', function () {
			scope.logger.info("Cleaning up...");
			async.eachSeries(modules, function (module, cb) {
				if (typeof(module.cleanup) == 'function'){
					module.cleanup(cb);
				}else{
					setImmediate(cb);
				}
			}, function (err) {
				if (err) {
					scope.logger.error(err);
				} else {
					scope.logger.info("Cleaned up successfully");
				}
				process.exit(1);
			});
		});

		process.once('SIGTERM', function () {
			process.emit('cleanup');
		});

		process.once('exit', function () {
			process.emit('cleanup');
		});

		process.once('SIGINT', function () {
			process.emit('cleanup');
		});
	}
});


