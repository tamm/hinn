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
	.run(['$rootScope', '$window', 'OAuth', '$mdToast', function($rootScope, $window, OAuth, $mdToast) {
	    $rootScope.$on('oauth:error', function(event, rejection) {
	    	console.log('caught an error', rejection)
	      // Ignore `invalid_grant` error - should be catched on `LoginController`.
	      if ('invalid_grant' === rejection.data.error) {
	        return;
	      }

	      // Refresh token when a `invalid_token` error occurs.
	      if ('invalid_token' === rejection.data.error) {
	      	console.log('invalid_token');
			$rootScope.token = OAuth.getAccessToken();
			$rootScope.loading = false;

		    $mdToast.show(
		      $mdToast.simple()
		        .textContent('Please try that again.')
		        .position({bottom:true})
		        .hideDelay(3000)
		    );

	        return $rootScope.token;
	      }

	      // Redirect to `/login` with the `error_reason`.
	      // return $window.location.href = '/login?error_reason=' + rejection.data.error;
	    });
	}])
	.controller('HinnController', ['$rootScope', '$scope', '$http', 'OAuth', 'OAuthToken', '$mdDialog', '$q', '$interval', '$timeout', '$mdToast', function($rootScope, $scope, $http, OAuth, OAuthToken, $mdDialog, $q, $interval, $timeout, $mdToast) {
		var vasttrafikApiUrl = 'https://api.vasttrafik.se/bin/rest.exe/v2';

		var isAuthenticated =  OAuth.isAuthenticated();
		var maxDeparturesPerLine = 4;

		var storageKeys = {};
		storageKeys.recentLocations = 'hinn.recentLocations';
		$scope.recentLocations = JSON.parse(sessionStorage.getItem(storageKeys.recentLocations)) || [];

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

		$rootScope.loading = true;
		$rootScope.loadingText = 'Loading';

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

		$scope.$watch('trips', function (trips) {
			if (trips) {
				var legs = [];

				trips.forEach(function(trip, index) {
					if (!Array.isArray(trip.Leg)) {
						trip.Leg = [trip.Leg];
					}

					trip.name = 'Trip ' + index;
					trip.Origin = trip.Leg[0].Origin;
					trip.Origin.tFull = new Date(trip.Origin.date + 'T' + trip.Origin.time);
					trip.Origin.tFull.setTime(trip.Origin.tFull.getTime()-(2*60*60*1000));

					trip.Destination = trip.Leg[trip.Leg.length - 1].Destination;
					trip.Destination.tFull = new Date(trip.Destination.date + 'T' + trip.Destination.time);
					trip.Destination.tFull.setTime(trip.Destination.tFull.getTime()-(2*60*60*1000));

					trip.duration = Math.round((trip.Destination.tFull.getTime() - trip.Origin.tFull.getTime()) / 60 / 1000);

					legs = legs.concat(trip.Leg);
				});

				$scope.legs = legs;

				evaluateDepartureBoard($scope.departureBoard);
			}
		});

		navigator.geolocation.getCurrentPosition(function(pos){
			$scope.location = pos;

			getLocation();
		}, function (error) {
			console.log('failed to get location', error);
			$mdToast.show(
		      $mdToast.simple()
		        .textContent(error.message)
		        .position({bottom:true})
		        .hideDelay(3000)
		    );

			$rootScope.loading = false;

			console.log('loading: ', $rootScope.loading);
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
				$rootScope.loading = false;
			});
		};

		var handleToken = function () {
			console.log('handleToken');
			$rootScope.token = OAuth.getAccessToken();
			$rootScope.token.then(function(token){
				refreshTime = ((token.expiresAt - new Date().getTime())) - 100;

				$timeout(handleToken, refreshTime);
			});
		};

		$rootScope.token = OAuth.getAccessToken();

		$rootScope.token.then(function(token){
			refreshTime = ((token.expiresAt - new Date().getTime())) - 100;

			$timeout(handleToken, refreshTime);
		});

		$scope.people = [
			{name:'tamm'},
			{name:'tamm2'}
		];

		var getSystemInfo = function () {
			var systemInfoUrl = vasttrafikApiUrl + '/systeminfo';
			params = {
				'format': 'json',
			};
			$http.get(systemInfoUrl, {
				params: params
			}).then(function(response)
				{
					if (response && response.data && response.data.SystemInfo) {
						$rootScope.SystemInfo = response.data.SystemInfo;
					}
					console.log('systemInfo',response.data.SystemInfo);
				});
		};
		$scope.showInfo = function(ev) {
			console.log('showInfo');
			getSystemInfo();

			$mdDialog.show({
		    	controller: 'HinnController',
		    	templateUrl: 'showInfoDialog.html',
		    	parent: angular.element(document.body),
		    	targetEvent: ev,
		    	clickOutsideToClose:true,
		    	fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
		    });
		};

		$scope.openSelectDestination = function(ev) {
			console.log('openSelectDestination');

			$mdDialog.show({
				controller: 'HinnController',
				templateUrl: 'selectDestination.html',
				parent: angular.element(document.body),
				targetEvent: ev,
				clickOutsideToClose:true,
				fullscreen: true // Only for -xs, -sm breakpoints.
		    });
		};

		$scope.openSelectOrigin = function(ev) {
			console.log('openSelectOrigin');

			$mdDialog.show({
				controller: 'HinnController',
				templateUrl: 'selectOrigin.html',
				parent: angular.element(document.body),
				targetEvent: ev,
				clickOutsideToClose:true,
				fullscreen: true // Only for -xs, -sm breakpoints.
		    });
		};

		$scope.selectOrigin = function (stop) {
			console.log('selectOrigin');
			$rootScope.origin = stop;
			$interval.cancel($rootScope.getDeparturesInterval);
			saveRecentLocation(stop);
			$rootScope.loading = true;

			getDepartures().then(function () {
				$rootScope.getDeparturesInterval = $interval(getDepartures, 60 * 1000);
				$mdDialog.hide();
			});
		};

		$scope.removeOrigin = function () {
			console.log('removeOrigin');
			$rootScope.origin = false;
			$scope.departureBoard = false;
			$interval.cancel($rootScope.getDeparturesInterval);
		};

		$scope.selectDeparture = function (departureBoardLine) {
			console.log('selectDeparture');
			$scope.departure = departureBoardLine;
		};

		$scope.removeDeparture = function () {
			console.log('removeDeparture');
			$scope.departure = false;
		};

		$scope.searchLocations = function (stop) {
			$rootScope.loading = true;
			searchLocations();
		};

		$rootScope.closeDialog = function () {
			$mdDialog.hide();
		};

		var saveRecentLocation = function (stop) {
			console.log('saveRecentLocation');
			$scope.recentLocations = JSON.parse(sessionStorage.getItem(storageKeys.recentLocations)) || [];
			
			$scope.recentLocations.forEach(function(location, index) {
				if (location && location.id === stop.id) {
					$scope.recentLocations.splice(index, 1);
				}
			});
			
			$scope.recentLocations.unshift(stop);

			$scope.recentLocations = $scope.recentLocations.slice(0,5);

			sessionStorage.setItem(storageKeys.recentLocations, JSON.stringify($scope.recentLocations));
		};

		$scope.selectDestination = function (stop) {
			console.log('selectDestination', stop);
			$rootScope.destination = stop;
			$mdDialog.hide();
			getDepartures();
			$rootScope.loading = true;
			saveRecentLocation(stop);
		};

		$scope.removeDestination = function () {
			console.log('removeDestination');
			$rootScope.destination = false;
			getDepartures();
			$rootScope.loading = true;
		};

		var evaluateDepartureBoard = function (departureBoard) {
			console.log('evaluateDepartureBoard');
			if (departureBoard !== undefined && departureBoard.hasOwnProperty('Departure')) {
				var departureBoardLines = [];
				var now = new Date();
				var departureBoardTotalDelay = 0;
				var departureBoardDelays = 0;

				if (!Array.isArray(departureBoard.Departure)) {
					departureBoard.Departure = [departureBoard.Departure];
				}

				departureBoard.Departure.forEach(function(departure) {
					departure.style = {
						background: departure.fgColor,
						color: departure.bgColor
					};
					switch(departure.type){
						case "BUS":
							if (isNaN(departure.sname)) {
								departure.icon = 'directions_bus';
							}
							departure.showIcon = false;
							break;
						case "VAS":
							departure.icon = 'directions_subway';
							departure.showIcon = true;
							break;
						case "LDTRAIN":
							departure.icon = 'directions_train';
							departure.showIcon = true;
							break;
						case "REGTRAIN":
							departure.icon = 'train';
							departure.showIcon = true;
							break;
						// case "BOAT":
						// 	departure.icon = 'directions_ferry';
						// 	break;
						default:
							departure.icon = false;
							departure.showIcon = false;
					}

					departure.rtFull = departure.rtDate !== undefined ? departure.rtDate + 'T' + departure.rtTime : departure.date + 'T' + departure.time;
					departure.rt = new Date(departure.rtFull);
					departure.rt.setTime(departure.rt.getTime()-(2*60*60*1000));
					departure.st = new Date(departure.date + 'T' + departure.time);
					departure.st.setTime(departure.st.getTime()-(2*60*60*1000));
					departure.difference = (departure.rt.getTime() - departure.st.getTime()) / 60 / 1000;
					departure.minutesUntil = Math.round((departure.rt.getTime() - now.getTime()) / 60 / 1000);
					departure.delayAverage = departure.difference ? departure.difference : 0;

					if (departure.difference > 0) {
						departureBoardTotalDelay += departure.difference;
						departureBoardDelays += 1;
					}

					var direction = departure.direction.split("via");
					departure.directionLine1 = departure.direction;
					if (departure.direction.indexOf("via") > 0) {
						departure.directionLine1 = direction[0].trim();
						departure.directionLine2 = departure.direction.replace(direction[0],'').trim();
					}

					var id = departure.sname + departure.direction;

					var departureBoardLine = {
						id: id,
						departures: [departure],
						trips: []
					};
					var departureBoardIndex = findWithAttr(departureBoardLines, 'id', id);
					if (departureBoardIndex > -1) {
						departureBoardLine = departureBoardLines[departureBoardIndex];
						departureBoardLine.departures.push(departure);
					} else {
						departureBoardLines.push(departureBoardLine);
					}

					departureBoardLine.totalDelay = 0;
					departureBoardLine.departures.forEach(function (eachDeparture) {
						departureBoardLine.totalDelay += eachDeparture.difference;
					});
					departureBoardLine.delayAverage = departureBoardLine.totalDelay / departureBoardLine.departures.length;
				});
				
				console.log('departureBoardTotalDelay',departureBoardTotalDelay, departureBoardDelays, departureBoardTotalDelay / departureBoardDelays);

				departureBoardLines.forEach(function(departureBoardLine) {
					if (departureBoardLine.departures.length < maxDeparturesPerLine) {
						var missingDepartures = maxDeparturesPerLine - departureBoardLine.departures.length;
						for (var i = missingDepartures - 1; i >= 0; i--) {
							departureBoardLine.departures.push({empty: true});
						}
					}

					departureBoardLine.inTripLegs = false;
					if ($scope.trips) {					
						$scope.trips.forEach(function(trip) {
							trip.Leg.forEach(function(leg) {
								if (leg.type !== "WALK") {
									var id = leg.sname + leg.direction;
									if (id === departureBoardLine.id) {
										console.log('match');
										departureBoardLine.inTripLegs = true;
										departureBoardLine.trips.push(trip);
									}
								}
							});
						});
					}
				});
				
				console.log('departureBoardLines', departureBoardLines);

				$rootScope.departureBoardLines = departureBoardLines;
			} else {
				$rootScope.departureBoardLines = undefined;
			}
		};

		$scope.$watch('departureBoard', evaluateDepartureBoard);

		var getDepartures = function() {
			var departureBoardUrl = vasttrafikApiUrl + '/departureBoard';
			var tripUrl = vasttrafikApiUrl + '/trip';
			var now = new Date();

			var getDeparturesPromise = $q(function (resolve, reject) {			
				departureBoardParams = {
					'format': 'json',
					'useVas': 1, // Vasttågen
					'useLDTrain': 1, // Long Distance Trains
					'useRegTrain': 1, // Regional Trains
					'useBus': 1,
					'useBoat': 1,
					'useTram': 1,
					id: $rootScope.origin.id,
					date: now.toLocaleDateString('sv-SE').slice(0,10),
					time: now.getHours() + ':' + now.getMinutes(),
					maxDeparturesPerLine: maxDeparturesPerLine,
					timeSpan: 370
				};
				$http.get(departureBoardUrl, {
					params: departureBoardParams
				}).then(function(response)
					{
						if (response && response.data && response.data.DepartureBoard) {
							response.data.DepartureBoard.localVersion = Math.random(6);
							$scope.departureBoard = response.data.DepartureBoard;
						}
						console.log($scope.departureBoard);
						$rootScope.loading = false;
						resolve('Got departures');
					});

				if ($rootScope.destination) {
					tripParams = {
						'format': 'json',
						'useVas': 1, // Vasttågen
						'useLDTrain': 1, // Long Distance Trains
						'useRegTrain': 1, // Regional Trains
						'useBus': 1,
						'useBoat': 1,
						'useTram': 1,
						originId: $rootScope.origin.id,
						date: now.toLocaleDateString('sv-SE').slice(0,10),
						time: now.getHours() + ':' + now.getMinutes(),
						// maxDeparturesPerLine: maxDeparturesPerLine,
						// timeSpan: 70,
						destId: $rootScope.destination.id
					};
					$http.get(tripUrl, {
						params: tripParams
					}).then(function(response)
						{
							if (response && response.data && response.data) {
								$rootScope.trips = response.data.TripList.Trip;
							}
							console.log('trips', response.data.TripList.Trip);
							resolve('Got trips');
						});
				}
			});

			return getDeparturesPromise;
		};

		var searchLocations = function() {
			var locationSearchUrl = vasttrafikApiUrl + '/location.name';
			var now = new Date();
			params = {
				'format': 'json',
				'input': $scope.searchQuery
			};
			$http.get(locationSearchUrl, {
				params: params
			}).then(function(response)
				{
					if (response && response.data) {
						$scope.locations = response.data;
					}

					console.log('location.name', response.data);
					console.log($scope.locations);
					$rootScope.loading = false;
				});
		};
	}])
	.directive("minutesUntil", ['$interval', function($interval){
	    return {
	        restrict: "E",
	        link: function(scope, element, attr){
	        	var departure = scope.departure;
				var minutesUntil;
				
				function updateTime() {
					var now = new Date();

					var displayString = departure.minutesUntil < 60 ? departure.minutesUntil : (Math.round(departure.minutesUntil / 60) + 'h');

					if (departure.difference !== 0) {
						displayString += " <span class='difference'>(" + departure.difference + ")</span>";
					}

					if (departure.minutesUntil < 1) {
						displayString = "Nu";
					}

					if (departure.minutesUntil < 0) {
						displayString = "Åkt";
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


