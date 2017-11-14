Date.prototype.stdTimezoneOffset = function() {
    var jan = new Date(this.getFullYear(), 0, 1);
    var jul = new Date(this.getFullYear(), 6, 1);
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
};

Date.prototype.dst = function() {
    return this.getTimezoneOffset() < this.stdTimezoneOffset();
};

var debug = function (message) {
    console.log(message);
    // var debuginfo = document.createElement('div');
    // debuginfo.innerHTML = new Date().toISOString().slice(5,19) + ': ' + message;
    // document.getElementById('debug').appendChild(debuginfo);
};

var app = angular.module('Hinn', [
    'ngRoute',
    'ngMaterial',
    'ngMdIcons',
    'oauth2',
    'angularMoment'
    ])
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
            debug('oauth:error ' + rejection);
            console.log('caught an error', rejection);
          // Ignore `invalid_grant` error - should be catched on `LoginController`.
          if ('invalid_grant' === rejection.data.error) {
            debug('invalid_grant');
            return;
          }

          // Refresh token when a `invalid_token` error occurs.
          if ('invalid_token' === rejection.data.error && 'invalid_client' === rejection.data.error) {
            debug('invalid_token');
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
            debug('didnt react to oauth:error at all');
        });
    }])
    .controller('HinnController', [
        '$rootScope',
        '$location',
        '$scope',
        '$http',
        'OAuth',
        'OAuthToken',
        '$mdDialog',
        '$q',
        '$interval',
        '$timeout',
        '$mdToast',
        function(
            $rootScope,
            $location,
            $scope,
            $http,
            OAuth,
            OAuthToken,
            $mdDialog,
            $q,
            $interval,
            $timeout,
            $mdToast) {
        var vasttrafikApiUrl = 'https://api.vasttrafik.se/bin/rest.exe/v2';
        var localApiUrl = '/api';

        var isAuthenticated =  OAuth.isAuthenticated();
        $rootScope.token = OAuth.getAccessToken();
        $rootScope.token.then(function(token){
            refreshTime = ((token.expiresAt - new Date().getTime())) - 100;

            $timeout(handleToken, refreshTime);
        });

        if (!isAuthenticated) {
            $rootScope.token.then(function(token){
                $timeout(function () {
                    location.reload();
                });
            });
        }

        var maxDeparturesPerLine = 4;

        var storageKeys = {};
        storageKeys.recentLocations = 'hinn.recentLocations';
        $rootScope.recentLocations = JSON.parse(localStorage.getItem(storageKeys.recentLocations)) || [];
        storageKeys.allStops = 'hinn.allStops';
        $rootScope.allStops = JSON.parse(localStorage.getItem(storageKeys.allStops)) || [];

        $scope.departureBoard = false;

        debug('started controller');

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

        $scope.NearbyStops = [];
        $scope.$watch('NearbyStops', function (NearbyStops) {
            if (NearbyStops && NearbyStops.LocationList && NearbyStops.LocationList.StopLocation) {

                var stops = [];
                NearbyStops.LocationList.StopLocation.forEach(function(stop) {
                    if (!stop.hasOwnProperty('track')) {
                        var recentLocationIndex = findWithAttr($rootScope.recentLocations, 'id', stop.id);
                        var recentLocation = false;
                        if (recentLocationIndex >= 0) {
                            recentLocation = $rootScope.recentLocations[recentLocationIndex];
                        }
                        if (recentLocation) {
                            stop = recentLocation;
                            stop.recentLocation = true;
                        }

                        stops.push(stop);
                    }
                });

                stops.sort(orderByIsRecentLocation);

                $scope.nearbyStops = stops;
            } else {
                $scope.nearbyStops = [];
                $scope.nearbyStopsStatus = stops;
            }
        });

        $rootScope.trips = $rootScope.trips || [];
        $scope.$watch('trips', function (trips) {
            console.log('trips watch', trips);
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
        }, true);

        navigator.geolocation.getCurrentPosition(function(pos){
            $scope.location = {coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
            }};

            getNearbyLocations();
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

        var getNearbyLocations = function () {
            var locationUrl = vasttrafikApiUrl + '/location.nearbystops';
            params = {
                'format': 'json',
                'originCoordLong': $scope.location.coords.longitude,
                'originCoordLat': $scope.location.coords.latitude,
                'maxNo': 30
            };

            $http.get(locationUrl, {
                params: params
            }).then(function(response) {
                $scope.NearbyStops = response.data;
                console.log('nearbystops',$scope.NearbyStops);
                $rootScope.loading = false;
            });
        };

        var getLocationById = function (location) {
            var locationUrl = localApiUrl + '/location.id';
            params = {
                'format': 'json',
                'locationId': location.id
            };

            return $http.get(locationUrl, {
                params: params
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
                scope: $scope,
                templateUrl: 'selectDestination.html',
                parent: angular.element(document.body),
                targetEvent: ev,
                preserveScope: true,
                clickOutsideToClose:true,
                fullscreen: true // Only for -xs, -sm breakpoints.
            });
        };

        $scope.openSelectOrigin = function(ev) {
            console.log('openSelectOrigin');

            $mdDialog.show({
                scope: $scope,
                templateUrl: 'selectOrigin.html',
                parent: angular.element(document.body),
                targetEvent: ev,
                preserveScope: true,
                clickOutsideToClose:true,
                fullscreen: true // Only for -xs, -sm breakpoints.
            });
        };

        $scope.selectOrigin = function (stop) {
            console.log('selectOrigin');
            $interval.cancel($rootScope.getDeparturesInterval);
            $rootScope.loading = true;
            $scope.origin = stop;
            $mdDialog.hide();
            saveRecentLocation(stop);
        };

        var updateLocation = function (newVal) {
            console.log('updateLocation');
            if ($scope.origin) {
                $location.search('origin', $scope.origin.id);
                getDepartures().then(function () {
                    $interval.cancel($rootScope.getDeparturesInterval);
                    $rootScope.getDeparturesInterval = $interval(getDepartures, 60 * 1000);
                });
            } else {
                $location.search('origin', undefined);
            }
            if ($scope.destination) {
                $location.search('destination', $scope.destination.id);
            } else {
                $location.search('destination', undefined);
            }
            if ($scope.departure) {
                $location.search('departure', $scope.departure.id);
                if ($scope.departure.stopid) {
                    $scope.departureLocation = {
                        id: $scope.departure.stopid
                    };
                    getLocationById($scope.departureLocation).then(function(response) {
                        console.log('getLocationById departure',response.data);
                        $scope.departureLocation = response.data;
                    }, function (err) {
                        console.log(err);
                    });
                }
            } else {
                $location.search('departure', undefined);
            }
        };
        var initOriginAndDestination = function () {
            var search = $location.search();
            if (!$scope.origin && search.origin) {
                $scope.origin = {
                    id: search.origin
                };
                getLocationById($scope.origin).then(function(response) {
                    console.log('getLocationById origin',response.data);
                    $scope.origin = response.data;
                }, function (err) {
                    console.log(err);
                });
            }

            if (!$scope.destination && search.destination) {
                $scope.destination = {
                    id: search.destination
                };
                getLocationById($scope.destination).then(function(response) {
                    console.log('getLocationById destination',response.data);
                    $scope.destination = response.data;
                });
            }

            if (!$scope.departure && search.departure) {
                $scope.departure = {
                    id: search.departure
                };
                if ($scope.departure.stopid) {
                    $scope.departureLocation = {
                        id: $scope.departure.stopid
                    };
                    getLocationById($scope.departureLocation).then(function(response) {
                        console.log('getLocationById departure',response.data);
                        $scope.departureLocation = response.data;
                    });
                }
            }

            $scope.$watch('origin', updateLocation, true);
            $scope.$watch('destination', updateLocation, true);
            $scope.$watch('departure', updateLocation, true);
        };

        initOriginAndDestination();

        $scope.removeOrigin = function () {
            console.log('removeOrigin');
            $interval.cancel($rootScope.getDeparturesInterval);
            $scope.departureBoard = false;
            $scope.origin = false;
            updateLocation();
        };

        $scope.selectDeparture = function (departureBoardLine) {
            console.log('selectDeparture', departureBoardLine);
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
            console.log('close mdDialog');
            $mdDialog.hide();
        };

        var deg2rad = function(deg) {
          return deg * (Math.PI/180);
        };

        var getDistanceFromLatLonInKm = function(lat1,lon1,lat2,lon2) {
          var R = 6371; // Radius of the earth in km
          var dLat = deg2rad(lat2-lat1);  // deg2rad below
          var dLon = deg2rad(lon2-lon1);
          var a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
            ;
          var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          var d = R * c; // Distance in km
          return d;
        };

        var distanceBetween = function (from, to) {
            var loc1, loc2;
            if (from && to) {
                if (from.lat) {
                    loc1 = {
                        latitude: from.lat,
                        longitude: from.lon
                    };
                } else if (from.coords) {
                    loc1 = {
                        latitude: from.coords.latitude,
                        longitude: from.coords.longitude
                    };
                }
                if (to.lat) {
                    loc2 = {
                        latitude: to.lat,
                        longitude: to.lon
                    };
                } else if (to.coords) {
                    loc2 = {
                        latitude: to.coords.latitude,
                        longitude: to.coords.longitude
                    };
                }
                if (loc1 && loc2) {
                    return getDistanceFromLatLonInKm(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
                } else {
                    return null;
                }
            } else {
                return null;
            }
        };

        var saveRecentLocation = function (recentLocation) {
            console.log('saveRecentLocation');
            $rootScope.recentLocations = JSON.parse(localStorage.getItem(storageKeys.recentLocations)) || [];

            console.log('$scope.location', $scope.location);

            recentLocation.chosen = [{
                time: new Date(),
                location: $scope.location,
                distance: distanceBetween($scope.location, recentLocation)
            }];

            var existingRecentLocation = false;

            $rootScope.recentLocations.forEach(function(location, index) {
                if (location && location.id === recentLocation.id) {
                    existingRecentLocation = $rootScope.recentLocations.splice(index, 1)[0];
                }
            });

            if (existingRecentLocation) {
                recentLocation.chosen = recentLocation.chosen.concat(existingRecentLocation.chosen);
            }

            recentLocation.choiceDistanceTotal = false;
            recentLocation.choiceDistances = 0;
            if (recentLocation.chosen) {
                recentLocation.chosen.forEach(function(choice) {
                    if (choice.distance !== undefined && choice.distance !== null) {
                        recentLocation.choiceDistanceTotal += choice.distance;
                        recentLocation.choiceDistances += 1;
                    }
                });

                recentLocation.choiceDistance = Math.round((recentLocation.choiceDistanceTotal / recentLocation.choiceDistances) * 100) / 100;
            }

            $rootScope.recentLocations.unshift(recentLocation);

            console.log('recentLocations',$rootScope.recentLocations);

            // $rootScope.recentLocations = $rootScope.recentLocations.slice(0,5);

            localStorage.setItem(storageKeys.recentLocations, JSON.stringify($rootScope.recentLocations));
        };

        $scope.selectDestination = function (stop) {
            console.log('selectDestination', stop);
            $rootScope.loading = true;
            $scope.destination = stop;
            $mdDialog.hide();
            saveRecentLocation(stop);
        };

        $scope.removeDestination = function () {
            console.log('removeDestination');
            $rootScope.loading = true;
            $scope.destination = false;
            getDepartures();
        };

        var orderByMinutesUntilNextDeparture = function (a, b) {
            if (a.minutesUntilNextDeparture == b.minutesUntilNextDeparture) {
                return 0;
            } else if (a.minutesUntilNextDeparture < b.minutesUntilNextDeparture) {
                return -1;
            } else if (b.minutesUntilNextDeparture < a.minutesUntilNextDeparture) {
                return 1;
            }
        }

        var evaluateDepartureBoard = function (departureBoard) {
            console.log('evaluateDepartureBoard');
            if (departureBoard !== undefined && departureBoard.hasOwnProperty('Departure')) {
                var departureBoardLines = [];
                var now = new Date();
                var tracks = [];
                $rootScope.departureBoardTotalDelay = 0;
                $rootScope.departureBoardDelays = 0;
                $rootScope.departureBoardAverageDelay = 0;

                if (!Array.isArray(departureBoard.Departure)) {
                    departureBoard.Departure = [departureBoard.Departure];
                }

                departureBoard.Departure.forEach(function(departure) {
                    if (tracks.indexOf(departure.track) < 0) {
                        tracks.push(departure.track);
                    }
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
                        //  departure.icon = 'directions_ferry';
                        //  break;
                        default:
                            departure.icon = false;
                            departure.showIcon = false;
                    }

                    departure.rtFull = departure.rtDate !== undefined ? departure.rtDate + 'T' + departure.rtTime : departure.date + 'T' + departure.time;
                    departure.rt = moment(departure.rtFull);
                    // departure.rt.setTime(departure.rt.getTime());
                    // if (departure.rt.dst()) {
                    //     departure.rt.setTime(departure.rt.getTime());
                    // }

                    departure.st = moment(departure.date + 'T' + departure.time);
                    // departure.st.setTime(departure.st.getTime());
                    // if (departure.st.dst()) {
                        // departure.st.setTime(departure.st.getTime());
                    // }

                    departure.difference = departure.rt.diff(departure.st, 'minutes')
                    departure.minutesUntil = departure.rt.diff(moment(), 'minutes')
                    departure.delayAverage = departure.difference ? departure.difference : 0;

                    if (departure.difference > 0) {
                        $rootScope.departureBoardTotalDelay += departure.difference;
                        $rootScope.departureBoardDelays += 1;
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
                        stopid: departure.stopid,
                        departures: [departure],
                        trips: [],
                        minutesUntilNextDeparture: departure.minutesUntil
                    };
                    var departureBoardIndex = findWithAttr(departureBoardLines, 'id', id);
                    if (departureBoardIndex > -1) {
                        departureBoardLine = departureBoardLines[departureBoardIndex];
                        departureBoardLine.departures.push(departure);
                    } else {
                        departureBoardLines.push(departureBoardLine);
                    }

                    departureBoardLine.minutesUntilNextDeparture = departureBoardLine.minutesUntilNextDeparture > departure.minutesUntil ? departure.minutesUntil : departureBoardLine.minutesUntilNextDeparture;

                    departureBoardLine.totalDelay = 0;
                    departureBoardLine.numberOfDelayedDepartures = 0;
                    departureBoardLine.departures.forEach(function (eachDeparture) {
                        if (eachDeparture.difference !== 0) {
                            departureBoardLine.totalDelay += eachDeparture.difference;
                            departureBoardLine.numberOfDelayedDepartures += 1;
                        }
                    });
                    departureBoardLine.delayAverage = departureBoardLine.totalDelay !== 0 ? Math.round(departureBoardLine.totalDelay / departureBoardLine.numberOfDelayedDepartures) : 0;
                });

                $scope.showTrack = tracks.length > 2;
                $rootScope.departureBoardAverageDelay = Math.round($rootScope.departureBoardTotalDelay / $rootScope.departureBoardDelays);

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
                                        departureBoardLine.inTripLegs = true;
                                        departureBoardLine.trips.push(trip);
                                    }
                                }
                            });
                        });
                    }
                });

                departureBoardLines.sort(orderByMinutesUntilNextDeparture);

                console.log('departureBoardLines', departureBoardLines);

                $rootScope.departureBoardLines = departureBoardLines;

                // if the departureline isn't selected yet, select it
                if ($scope.departure && !$scope.departure.departures) {
                    console.log('there is a departure', $scope.departure);
                    var line = departureBoardLines[findWithAttr(departureBoardLines, 'id', $scope.departure.id)];
                    console.log('departure line', line);
                    $scope.departure = line;
                }
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
                    id: $scope.origin.id,
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
                        $rootScope.loading = false;
                        resolve('Got departures');
                    });

                if ($scope.destination) {
                    tripParams = {
                        'format': 'json',
                        'useVas': 1, // Vasttågen
                        'useLDTrain': 1, // Long Distance Trains
                        'useRegTrain': 1, // Regional Trains
                        'useBus': 1,
                        'useBoat': 1,
                        'useTram': 1,
                        originId: $scope.origin.id,
                        date: now.toLocaleDateString('sv-SE').slice(0,10),
                        time: now.getHours() + ':' + now.getMinutes(),
                        // maxDeparturesPerLine: maxDeparturesPerLine,
                        // timeSpan: 70,
                        destId: $scope.destination.id
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

        var orderByIsRecentLocation = function (a, b) {
            if (a.recentLocation && b.recentLocation) {
                return 0;
            } else if (a.recentLocation) {
                return -1;
            } else if (b.recentLocation) {
                return 1;
            }
        };

        var preProcessLocations = function (locations) {
            var preProcessedLocations = [];

            locations.forEach(function (location) {
                var recentLocationIndex = findWithAttr($rootScope.recentLocations, 'id', location.id);
                var recentLocation = false;
                if (recentLocationIndex >= 0) {
                    recentLocation = $rootScope.recentLocations[recentLocationIndex];
                }
                if (recentLocation) {
                    location = recentLocation;
                }
                console.log(recentLocationIndex, recentLocation);
                location.recentLocation = recentLocationIndex >= 0;

                preProcessedLocations.push(location);
            });

            preProcessedLocations.sort(orderByIsRecentLocation);

            return preProcessedLocations;
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
                    if (response && response.data && response.data.LocationList) {
                        $scope.locationSearchResult = preProcessLocations(response.data.LocationList.StopLocation);
                    }

                    console.log('location.name', response.data);
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
                        displayString = "&aring;kt";
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


app.config(['$routeProvider', '$locationProvider', function ($routeProvider, $locationProvider) {

    console.log('setup routes')
    $routeProvider
        .when('/', {
            templateUrl: 'origin.html',
            useAsDefault: true,
            reloadOnSearch: false
        }).when('/main', {
            templateUrl: 'main.html'
        }).otherwise({
            redirectTo: '/'
        });

    $locationProvider.html5Mode(true);
}]);
