global.__base = __dirname + '/';

var express = require('express');
var app = express();
var router = express.Router();
var routes = require('./routes');

app.use('/static', express.static('public'));
app.set('view engine', 'pug');

app.use('/', routes);

app.listen(8080, function () {
  console.log('Example app listening on port 8080!');
});

module.exports = router;