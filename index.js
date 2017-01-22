global.__base = __dirname + '/';
var fs = require('fs');

var express = require('express');
var app = express();
var router = express.Router();
// var routes = require('./routes');
var https = require('https');
var request = require('request');
var btoa = require('btoa');


var apiConfig = {
	baseUrl: 'https://api.vasttrafik.se:443',
	clientId: 'Hinn Med',
	clientKey: '9L4HY9Ofdsg4Q4JIbXY_2ugqVr8a',
	clientSecret: 'NtG5cvDFKasC1NyDtGl9boyRfMYa', // optional
	grantPath: '/token',
	allLocationsPath: '/location.allstops',
	apiUrl: 'https://api.vasttrafik.se/bin/rest.exe/v2',
	allLocationsFile: 'build/allLocations.json'
};

var findWithAttr = function (array, attr1, value) {
    for (var i = 0; i < array.length; i += 1) {
        if (array[i][attr1]) {
            if (array[i][attr1] === value) {
                return i;
            }
        }
    }
    return -1;
};

app.use('/views', express.static(__base + 'views'));
app.get('/api*', function(req, res, next){
	console.log('API: ' + req.url);
	if (fs.existsSync(__base + apiConfig.allLocationsFile)) {
		var allLocations = JSON.parse(fs.readFileSync(__base + apiConfig.allLocationsFile));

		var stops = allLocations.LocationList.StopLocation;

		var stop = stops[findWithAttr(stops, 'id', req.query.locationId)];

		if (stop) {
  			res.send(stop);
		}
	} else {
  		res.send({'name': 'test', 'id': req.query.locationId});
	}
});
router.get('*', function(req, res, next){
	console.log('ROUTER: ' + req.url);
  	res.sendFile(__base + 'views/index.html');
	// next();
});
app.get('*', function(req, res, next){
	console.log('GET: ' + req.url);
	next();
});
app.use('/', express.static(__base + 'build'));
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

var prefetch = function () {
	if (fs.existsSync(__base + apiConfig.allLocationsFile)) {
		console.log('found allLocationsFile');
	} else {
		console.log('Get allLocationsFile from API');
		request(
			{
				url: apiConfig.baseUrl + apiConfig.grantPath,
				method: 'POST',
				headers: {
					'Authorization': 'Basic ' + btoa(apiConfig.clientKey + ':' + apiConfig.clientSecret)
				},
				qs: {
					grant_type: 'client_credentials'
					// scope: 'prefetch'
				},
			},
			function(err,httpResponse,body) {
				if (body) {
					var data = JSON.parse(body);
					apiConfig.access_token = data.access_token;
					console.log(data.access_token)
					request({
						url: apiConfig.apiUrl + apiConfig.allLocationsPath,
						headers: {
							'Authorization': 'Bearer ' + apiConfig.access_token,
						},
						qs: {
							format: 'json'
						}
					}, function (err, response, body) {
						fs.writeFileSync(__base + apiConfig.allLocationsFile, body);
						console.log('created allLocationsFile');
					});
				}
			}
		);
	}
};

prefetch();

module.exports = router;
