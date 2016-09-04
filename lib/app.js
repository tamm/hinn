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
		};

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
				date: now.toISOString().slice(0,10),
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
				});

		};
	}]);


