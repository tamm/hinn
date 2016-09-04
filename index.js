global.__base = __dirname + '/';
var fs = require('fs');

var express = require('express');
var app = express();
var router = express.Router();
var routes = require('./routes');
var https = require('https');

app.use('/static', express.static(__base + 'public'));
app.set('view engine', 'pug');

app.use('/', routes);

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
	https.createServer({
	    key: privateKey,
	    cert: certificate
	}, app).listen(443);
} else {
	app.listen(8080, function () {
	  console.log('Hinn Med listening on port 8080!');
	});
}

module.exports = router;
