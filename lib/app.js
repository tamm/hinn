angular.module('Hinn', ['ngMaterial', 'ngMdIcons', 'oauth2', 'angularMoment'])
	.config(['OAuthProvider', function(OAuthProvider) {
		OAuthProvider.configure({
			baseUrl: 'https://api.vasttrafik.se:443',
			clientId: 'Hinn Med',
			clientKey: '9L4HY9Ofdsg4Q4JIbXY_2ugqVr8a',
			clientSecret: 'NtG5cvDFKasC1NyDtGl9boyRfMYa', // optional
			grantPath: '/token',
		});
	}])
	.run(['$rootScope', '$window', 'OAuth', function($rootScope, $window, OAuth) {
		console.log('set up error handling')
	    $rootScope.$on('oauth:error', function(event, rejection) {
	    	console.log('caught an error', rejection)
	      // Ignore `invalid_grant` error - should be catched on `LoginController`.
	      if ('invalid_grant' === rejection.data.error) {
	        return;
	      }

	      // Refresh token when a `invalid_token` error occurs.
	      if ('invalid_token' === rejection.data.error) {
	      	console.log('invalid_token');
	        return OAuth.getRefreshToken();
	      }

	      // Redirect to `/login` with the `error_reason`.
	      // return $window.location.href = '/login?error_reason=' + rejection.data.error;
	    });
	}])
	.controller('HinnController', ['$scope', '$http', 'OAuth', 'OAuthToken', '$mdDialog', '$interval', '$timeout', function($scope, $http, OAuth, OAuthToken, $mdDialog, $interval, $timeout) {
		var vasttrafikApiUrl = 'https://api.vasttrafik.se/bin/rest.exe/v2';

		var isAuthenticated =  OAuth.isAuthenticated();
		var maxDeparturesPerLine = 2;
		var getDeparturesInterval;
        
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

		$scope.loading = true;

		$scope.title = 'Hinn';

		$scope.$watch('NearbyStops', function (NearbyStops) {
			if (NearbyStops) {

				var stops = [];
				NearbyStops.LocationList.StopLocation.forEach(function(stop) {
					if (!stop.hasOwnProperty('track')) {
						stops.push(stop);
					}
				});

				$scope.nearbystops = stops;
			}
		});

		navigator.geolocation.getCurrentPosition(function(pos){
			$scope.location = pos;

			getLocation();
		});

		var getLocation = function () {
			var locationUrl = vasttrafikApiUrl + '/location.nearbystops';
			params = {
				'format': 'json',
				'originCoordLong': $scope.location.coords.longitude,
				'originCoordLat': $scope.location.coords.latitude,
				'maxNo': 25
			};

			$http.get(locationUrl, {
				params: params
			}).then(function(response) {
				$scope.NearbyStops = response.data;
				console.log('nearbystops',$scope.NearbyStops);
				$scope.loading = false;
			});
		};

		var handleToken = function () {
			console.log('handleToken');
			$scope.token = OAuth.getAccessToken();
			$scope.token.then(function(token){
				refreshTime = ((token.expiresAt - new Date().getTime())) - 100;

				$timeout(handleToken, refreshTime);
			});
		};

		$scope.token = OAuth.getAccessToken();

		$scope.token.then(function(token){
			refreshTime = ((token.expiresAt - new Date().getTime())) - 100;

			$timeout(handleToken, refreshTime);

			var systemInfoUrl = vasttrafikApiUrl + '/systeminfo';
			params = {
				'format': 'json',
			};
			$http.get(systemInfoUrl, {
				params: params
			}).then(function(response)
				{
					if (response && response.data && response.data.SystemInfo) {
						$scope.SystemInfo = response.data.SystemInfo;
					}
					console.log('systemInfo',response.data.SystemInfo);
				});
		});

		$scope.people = [
			{name:'tamm'},
			{name:'tamm2'}
		];

		$scope.showInfo = function(ev) {
			console.log('showInfo');

			$mdDialog.show({
		      controller: 'HinnController',
		      templateUrl: 'showInfoDialog.html',
		      parent: angular.element(document.body),
		      targetEvent: ev,
		      clickOutsideToClose:true,
		      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
		    })
		};

		$scope.selectOrigin = function (stop) {
			console.log('selectOrigin', stop);
			$scope.origin = stop;
			getDepartures();
			getDeparturesInterval = $interval(getDepartures, 60 * 1000);
			$scope.loading = true;
		};

		$scope.removeOrigin = function () {
			console.log('removeOrigin');
			$scope.origin = false;
			$scope.departureBoard = false;
			$interval.cancel(getDeparturesInterval);
		};

		$scope.selectDeparture = function (departureBoardLine) {
			console.log('selectDeparture', departureBoardLine.departures[0]);
			$scope.departure = departureBoardLine.departures[0];
		};

		$scope.removeDeparture = function () {
			console.log('removeDeparture');
			$scope.departure = false;
		};

		$scope.$watch('departureBoard', function (departureBoard) {
			if (departureBoard !== undefined && departureBoard.hasOwnProperty('Departure')) {
				var departureBoardLines = [];
				var now = new Date();

				departureBoard.Departure.forEach(function(departure) {
					departure.style = {background: departure.fgColor};
					switch(departure.type){
						case "BUS":
							if (isNaN(departure.sname)) {
								departure.icon = 'directions_bus';
							}
							break;
						case "VAS":
							departure.icon = 'directions_subway';
							break;
						case "LDTRAIN":
							departure.icon = 'directions_train';
							break;
						case "REGTRAIN":
							departure.icon = 'train';
							break;
						case "BOAT":
							departure.icon = 'directions_ferry';
							break;
						case "TRAM":
							departure.icon = 'tram';
							break;
						default:
							departure.icon = false;
					}

					departure.rtFull = departure.rtDate + 'T' + departure.rtTime;
					departure.rt = new Date(departure.rtFull);
					departure.rt.setTime(departure.rt.getTime()-(2*60*60*1000));
					departure.st = new Date(departure.date + 'T' + departure.time);
					departure.st.setTime(departure.st.getTime()-(2*60*60*1000));
					// departure.difference = (departure.rt.getTime() - departure.st.getTime()) / 60 / 1000;
					// departure.minutesUntil = Math.round((departure.rt.getTime() - now.getTime()) / 60 / 1000);
					var direction = departure.direction.split("via");
					departure.directionLine1 = departure.direction;
					if (departure.direction.indexOf("via") > 0) {
						departure.directionLine1 = direction[0].trim();
						departure.directionLine2 = departure.direction.replace(direction[0],'').trim();
					}

					var id = departure.sname + departure.track + departure.direction;

					var departureBoardIndex = findWithAttr(departureBoardLines, 'id', id);
					if (departureBoardIndex > -1) {
						departureBoardLine = departureBoardLines[departureBoardIndex];
						departureBoardLine.departures.push(departure);
					} else {
						departureBoardLines.push({
							id: id,
							departures: [departure]
						});
					}
				});

				departureBoardLines.forEach(function(departureBoardLine) {
					if (departureBoardLine.departures.length < maxDeparturesPerLine) {
						var missingDepartures = maxDeparturesPerLine - departureBoardLine.departures.length;
						for (var i = missingDepartures - 1; i >= 0; i--) {
							departureBoardLine.departures.push({empty: true});
						}
					}
				});
				
				$scope.departureBoardLines = departureBoardLines;
			} else {
				$scope.departureBoardLines = undefined;
			}
		});

		var getDepartures = function() {
			var departureBoardUrl = vasttrafikApiUrl + '/departureBoard';
			var now = new Date();
			params = {
				'format': 'json',
				'useVas': 1, // Vasttågen
				'useLDTrain': 1, // Long Distance Trains
				'useRegTrain': 1, // Regional Trains
				'useBus': 1,
				'useBoat': 1,
				'useTram': 1,
				id: $scope.origin.id,
				date: now.toLocaleDateString('sv-SE').slice(0,10),
				time: now.getHours() + ':' + now.getMinutes(),
				maxDeparturesPerLine: maxDeparturesPerLine,
				timeSpan: 70
			};
			console.log(params)
			if ($scope.destination) {
				params.direction = $scope.destination.id;
			}
			$http.get(departureBoardUrl, {
				params: params
			}).then(function(response)
				{
					if (response && response.data && response.data.DepartureBoard) {
						$scope.departureBoard = response.data.DepartureBoard;
					}
					console.log('departureBoard', response.data.DepartureBoard);
					$scope.loading = false;
				});
		};
	}])
	.directive("minutesUntil", ['$interval', function($interval){
	    return {
	        restrict: "E",
	        link: function(scope,element,attr){
	        	var departure = scope.departure;
				var minutesUntil;
				
				function updateTime() {
					var now = new Date();
					departure.minutesUntil = Math.round((departure.rt.getTime() - now.getTime()) / 60 / 1000);

					var displayString = departure.minutesUntil;

					departure.difference = (departure.rt.getTime() - departure.st.getTime()) / 60 / 1000;

					if (departure.difference !== 0) {
						displayString += " <span class='difference'>(" + departure.difference + ")</span>";
					}

					if (departure.minutesUntil < 1) {
						displayString = "Nu";
					}

					element.html(displayString);
				}

				if (departure.empty === true) {
					departure.minutesUntil = false;
				} else {
					minutesUntil = $interval(updateTime, 10 * 1000);
					updateTime();
				}

				element.on('$destroy', function() {
					$interval.cancel(minutesUntil);
				});
	        },
	    };
	}]);


