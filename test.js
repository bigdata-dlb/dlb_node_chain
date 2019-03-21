// var extend = require('extend');

// _default = {a:1, b:function() {return 20300;}, c:"wor"}
// config = {a:false, d:[2,3,4,5]}
// _default = extend(_default, config, {d:100});
// console.log("sde:::" + _default.b)

// function extend(target, source) {
//     console.log(typeof arguments);
//     console.log(JSON.stringify(arguments));
//     // if (! target || typeof target !== 'object') return target;

//     Array.prototype.slice.call(arguments).forEach(function(source){
//         // if (! source || typeof source !== 'object') return;

//         // util._extend(target, source);
//         console.log(source);
//     });

//     // return target;
// }

// extend({q:0, w:'rr'}, false, [1,2,3])

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var path = require('path');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var requestSanitizer = require('./helpers/request-sanitizer');
var queryParser = require('express-query-int');

app.engine('html', require('ejs').renderFile);
app.use(require('express-domain-middleware'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({extended: true, parameterLimit: 5000}));
app.use(bodyParser.json());
app.use(methodOverride());

var ignore = ['id', 'name', 'lastBlockId', 'blockId', 'username', 'transactionId', 'address', 'recipientId', 'senderId', 'senderUsername', 'recipientUsername', 'previousBlock'];
app.use(queryParser({
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

// app.use(require('./helpers/zscheme-express.js')(scope.scheme));

app.use(function (req, res, next) {
    console.log(req.url);
    var parts = req.url.split('/');
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (parts.length > 1) {
        if (parts[1] == 'api') {
            // if (scope.config.api.access.whiteList.length > 0) {
            //     if (scope.config.api.access.whiteList.indexOf(ip) < 0) {
            //         res.sendStatus(403);
            //     } else {
            //         next();
            //     }
            // } else {
                next();
            // }
        } else if (parts[1] == 'peer') {
            // if (scope.config.peers.blackList.length > 0) {
            //     if (scope.config.peers.blackList.indexOf(ip) >= 0) {
            //         res.sendStatus(403);
            //     } else {
            //         next();
            //     }
            // } else {
                next();
            // }
        } else {
            next();
        }
    } else {
        next();
    }
});

server.listen(3090, "127.0.0.1", function (err) {
    console.log("Ebookcoin started: " + "127.0.0.1" + ":" + 3090);

    // if (!err) {
    //     if (scope.config.ssl.enabled) {
    //         scope.network.https.listen(scope.config.ssl.options.port, scope.config.ssl.options.address, function (err) {
    //             scope.logger.log("Ebookcoin https started: " + scope.config.ssl.options.address + ":" + scope.config.ssl.options.port);

    //             cb(err, scope.network);
    //         });
    //     } else {
    //         cb(null, scope.network);
    //     }
    // } else {
    //     cb(err, scope.network);
    // }
});


