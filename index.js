global.__base = __dirname + '/';

var express = require('express');
var app = express();
var router = express.Router();
var routes = require('./routes');
var https = require('https');

app.use('/static', express.static(__base + 'public'));
app.set('view engine', 'pug');

app.use('/', routes);

// app.listen(8080, function () {
//   console.log('Example app listening on port 8080!');
// });

var privateKey = fs.readFileSync( 'ssl/privatekey.pem' );
var certificate = fs.readFileSync( 'ssl/certificate.pem' );

https.createServer({
    key: privateKey,
    cert: certificate
}, app).listen(443);

module.exports = router;
