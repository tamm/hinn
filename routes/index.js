const fs = require('fs');
var express = require('express');
var router = express.Router();
var app = express();

router.get('*', function(req, res, next){
	console.log('GET: ' + req.url);
	next();
});

router.get('/', function (req, res) {
  res.sendFile(__base + 'views/index.html');
});
router.get('/showInfoDialog.html', function (req, res) {
  res.sendFile(__base + 'views/showInfoDialog.html');
});

var requiredModules = [];
var modules = fs.readdirSync('modules');
modules.forEach(function(module) {
	var moduleDirPath = 'modules/' + module;
	var moduleFiles = fs.readdirSync(moduleDirPath);

	if (moduleFiles.indexOf('init.js') >= 0) {
		moduleInit = require(__base + moduleDirPath + '/init.js');
		moduleInit();
	}
	if (moduleFiles.indexOf('routes.js') >= 0) {
		requiredModules[module] = require(__base + moduleDirPath + '/routes.js');
		app.use('/' + module + '/static', express.static(moduleDirPath + 'public'));
		router.use('/' + module, requiredModules[module]);
	}
});

module.exports = router;
