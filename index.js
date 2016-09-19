global.__base = __dirname + '/';
var fs = require('fs');

var express = require('express');
var app = express();
var router = express.Router();
// var routes = require('./routes');
var https = require('https');

app.get('*', function(req, res, next){
	console.log('GET: ' + req.url);
	next();
});
app.use('/', express.static(__base + 'public'));
// app.set('view engine', 'pug');

// app.use('/', routes);

router.get('/DD1765F8594A8FE76CD0DA42C4CA8401.txt', function (req, res) {
  res.sendFile(__base + 'DD1765F8594A8FE76CD0DA42C4CA8401.txt');
});

try {
	var privateKey = fs.readFileSync( '/ssl/privatekey.pem' );
} catch (error) {
	console.log(error);
}
try {
	var certificate = fs.readFileSync( '/ssl/certificate.pem' );
} catch (error) {
	console.log(error);
}

if (privateKey && certificate) {
	  console.log('Hinn Med listening on port 443!');
	var server = https.createServer({
	    key: privateKey,
	    cert: certificate
	}, app).listen(443);
	server.on('error', function (e) {
	  // Handle your error here
	  console.log(e);
	});
} else {
	app.listen(8080, function () {
	  console.log('Hinn Med listening on port 8080!');
	});
}

module.exports = router;
