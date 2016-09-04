angular.module('HinnMed', ['ngMaterial', 'ngMdIcons', 'oauth2', 'angularMoment'])
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
	    $rootScope.$on('oauth:error', function(event, rejection) {
	      // Ignore `invalid_grant` error - should be catched on `LoginController`.
	      if ('invalid_grant' === rejection.data.error) {
	        return;
	      }

	      // Refresh token when a `invalid_token` error occurs.
	      if ('invalid_token' === rejection.data.error) {
	        return OAuth.getRefreshToken();
	      }

	      // Redirect to `/login` with the `error_reason`.
	      // return $window.location.href = '/login?error_reason=' + rejection.data.error;
	    });
	}])
	.controller('HinnMedController', ['$scope', '$http', 'OAuth', '$mdDialog', function($scope, $http, OAuth, $mdDialog) {
		var vasttrafikApiUrl = 'https://api.vasttrafik.se/bin/rest.exe/v2';

		var isAuthenticated =  OAuth.isAuthenticated();
		var token = OAuth.getAccessToken();

		$scope.loading = true;

		$scope.title = 'Hinn Med';

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

		token.then(function(){
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
		      controller: 'HinnMedController',
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
			getDepartures(stop.id);
			$scope.loading = true;
		};

		$scope.removeOrigin = function () {
			console.log('removeOrigin');
			$scope.origin = false;
			$scope.departureBoard = false;
		};

		$scope.$watch('departureBoard', function (departureBoard) {
			if (departureBoard !== undefined && departureBoard.hasOwnProperty('Departure')) {
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
					var rt = new Date(departure.rtDate + 'T' + departure.rtTime);
					var st = new Date(departure.date + 'T' + departure.time);
					departure.difference = (st.getTime() - rt.getTime()) / 60 / 1000;
				});
				
				$scope.departures = departureBoard.Departure;
			} else {
				$scope.departures = undefined;
			}
		});

		var getDepartures = function(origin, destination) {
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
				id: origin,
				date: now.toLocaleDateString('sv-SE').slice(0,10),
				time: now.toTimeString().slice(0,5)
			};
			if (destination) {
				params.direction = destination;
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
	}]);


