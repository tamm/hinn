var defaults = {
  baseUrl: null,
  clientId: null,
  clientSecret: null,
  grantPath: '/oauth2/token',
  revokePath: '/oauth2/revoke'
};

var requiredKeys = [
  'baseUrl',
  'clientId',
  'grantPath',
  'revokePath'
];

var ngModule = angular.module('oauth2', [
		'ngCookies'
	])
	.config(['$httpProvider', function($httpProvider) {  
		$httpProvider.interceptors.push('oauthInterceptor');
	}])
	.factory('oauthInterceptor', ['$q', '$rootScope', 'OAuthToken', function oauthInterceptor($q, $rootScope, OAuthToken) {
	  return {
	    request: function(config) {
	    	console.log('intercepting request');
	    	console.log(config);
	      config.headers = config.headers || {};

	      // Inject `Authorization` header.
	      if (!config.headers.hasOwnProperty('Authorization') && OAuthToken.getAuthorizationHeader()) {
	        config.headers.Authorization = OAuthToken.getAuthorizationHeader();
	      }

	      return config;
	    },
	    responseError: function(rejection) {
	      // Catch `invalid_request` and `invalid_grant` errors and ensure that the `token` is removed.
	      if (400 === rejection.status && rejection.data &&
	        ('invalid_request' === rejection.data.error || 'invalid_grant' === rejection.data.error)
	      ) {
	        OAuthToken.removeToken();

	        $rootScope.$emit('oauth:error', rejection);
	      }

	      // Catch `invalid_token` and `unauthorized` errors.
	      // The token isn't removed here so it can be refreshed when the `invalid_token` error occurs.
	      if (401 === rejection.status &&
	        (rejection.data && 'invalid_token' === rejection.data.error) ||
	        (rejection.headers('www-authenticate') && 0 === rejection.headers('www-authenticate').indexOf('Bearer'))
	      ) {
	        $rootScope.$emit('oauth:error', rejection);
	      }

	      return $q.reject(rejection);
	    }
	  };
	}])
	.provider('OAuth', function() {

	  /**
	   * Configure.
	   *
	   * @param {object} params - An `object` of params to extend.
	   */

	  this.configure = function(params) {
	    // Can only be configured once.
	    try {
		    if (undefined === config) {
		      throw new Error('Already configured.');
		    }
	    } catch(error) {
	    	console.log('we are happy');
	    	console.log(error);
	    }

	    // Check if is an `object`.
	    if (!(params instanceof Object)) {
	      throw new TypeError('Invalid argument: `config` must be an `Object`.');
	    }

	    // Extend default configuration.
	    config = angular.extend({}, defaults, params);

	    // Check if all required keys are set.
	    angular.forEach(requiredKeys, function(key) {
	      if (!config[key]) {
	        throw new Error('Missing parameter: ${key}.');
	      }
	    });

	    // Remove `baseUrl` trailing slash.
	    if('/' === config.baseUrl.substr(-1)) {
	      config.baseUrl = config.baseUrl.slice(0, -1);
	    }

	    // Add `grantPath` facing slash.
	    if('/' !== config.grantPath[0]) {
	      config.grantPath = '/' + config.grantPath;
	    }

	    // Add 'revokePath' facing slash.
	    if('/' !== config.revokePath[0]) {
	      config.revokePath = '/' + config.revokePath;
	    }

	    return config;
	  };

	  /**
	   * OAuth service.
	   */

	  this.$get = ['$http', 'OAuthToken', function($http, OAuthToken) {
	    var OAuth = {};

	      /**
	       * Check if `OAuthProvider` is configured.
	       */

	      OAuth.constructor = function() {
	        if (!config) {
	          throw new Error('`OAuthProvider` must be configured first.');
	        }
	      }

	      /**
	       * Verifies if the `user` is authenticated or not based on the `token`
	       * cookie.
	       *
	       * @return {boolean}
	       */

	      OAuth.isAuthenticated = function() {
	        return !!OAuthToken.getToken();
	      }

	      /**
	       * Retrieves the `access_token` and stores the `response.data` on cookies
	       * using the `OAuthToken`.
	       *
	       * @param {object} data - Request content, e.g., `username` and `password`.
	       * @param {object} options - Optional configuration.
	       * @return {promise} A response promise.
	       */

	      OAuth.getAccessToken = function(data, options) {
	      	if (false) {
		        data = angular.extend({
		          client_id: config.clientId,
		          grant_type: 'password'
		        }, data);

		        if (null !== config.clientSecret) {
		          data.client_secret = config.clientSecret;
		        }

		        data = queryString.stringify(data);

		        options = angular.extend({
		          headers: {
		            'Authorization': undefined,
		            'Content-Type': 'application/x-www-form-urlencoded'
		          }
		        }, options);

		        return $http.post(config.baseUrl + config.grantPath, data, options).then(function(response) {
		          OAuthToken.setToken(response.data);
		          console.log('GETTOKEN', OAuthToken.getToken())

		          return response;
		        });
      		} else if (config.clientKey && config.clientSecret) {
		        data = angular.extend({
		          // client_id: config.clientId,
		          grant_type: 'client_credentials',
		          scope: 'test1'
		        }, data);

		        if (null !== config.clientSecret) {
		          data.client_secret = config.clientSecret;
		        }

		        data = queryString.stringify(data);
		        var authorization = 'Basic ' + window.btoa(config.clientKey + ':' + config.clientSecret);
		        console.log(authorization)
		        console.log('OUw0SFk5T2Zkc2c0UTRKSWJYWV8ydWdxVnI4YTpOdEc1Y3ZERkthc0MxTnlEdEdsOWJveVJmTVlh')

		        options = angular.extend({
		          headers: {
		            'Authorization': authorization,
		            'Content-Type': 'application/x-www-form-urlencoded'
		          }
		        }, options);

		        return $http.post(config.baseUrl + config.grantPath, data, options).then(function(response) {
		          OAuthToken.setToken(response.data);

		          return response;
		        });      		}
	      };

	      /**
	       * Retrieves the `refresh_token` and stores the `response.data` on cookies
	       * using the `OAuthToken`.
	       *
	       * @param {object} data - Request content.
	       * @param {object} options - Optional configuration.
	       * @return {promise} A response promise.
	       */

	      OAuth.getRefreshToken = function(data, options) {
	        data = angular.extend({
	          client_id: config.clientId,
	          grant_type: 'refresh_token',
	          refresh_token: OAuthToken.getRefreshToken(),
	        }, data);

	        if (null !== config.clientSecret) {
	          data.client_secret = config.clientSecret;
	        }

	        data = queryString.stringify(data);

	        options = angular.extend({
	          headers: {
	            'Authorization': undefined,
	            'Content-Type': 'application/x-www-form-urlencoded'
	          }
	        }, options);

	        return $http.post(config.baseUrl + config.grantPath, data, options).then(function(response) {
	          OAuthToken.setToken(response.data);

	          return response;
	        });
	      }

	      /**
	       * Revokes the `token` and removes the stored `token` from cookies
	       * using the `OAuthToken`.
	       *
	       * @param {object} data - Request content.
	       * @param {object} options - Optional configuration.
	       * @return {promise} A response promise.
	       */

	      OAuth.revokeToken = function(data, options) {
	        var refreshToken = OAuthToken.getRefreshToken();

	        data = angular.extend({
	          client_id: config.clientId,
	          token: refreshToken ? refreshToken : OAuthToken.getAccessToken(),
	          token_type_hint: refreshToken ? 'refresh_token' : 'access_token'
	        }, data);

	        if (null !== config.clientSecret) {
	          data.client_secret = config.clientSecret;
	        }

	        data = queryString.stringify(data);

	        options = angular.extend({
	          headers: {
	            'Content-Type': 'application/x-www-form-urlencoded'
	          }
	        }, options);

	        return $http.post(config.baseUrl + config.revokePath, data, options).then(function(response) {
	          OAuthToken.removeToken();

	          return response;
	        });
	      }

	    return OAuth;
	  }];
	})
	.provider('OAuthToken', function() {
	  var config = {
	    name: 'token',
	    options: {
	      // secure: true
	    }
	  };

	  /**
	   * Configure.
	   *
	   * @param {object} params - An `object` of params to extend.
	   */

	  this.configure = function(params) {
	    // Check if is an `object`.
	    if (!(params instanceof Object)) {
	      throw new TypeError('Invalid argument: `config` must be an `Object`.');
	    }

	    // Extend default configuration.
	    angular.extend(config, params);

	    return config;
	  };

	  /**
	   * OAuthToken service.
	   */

	  this.$get = ['$cookies', function($cookies) {
	    var OAuthToken = {};

	      /**
	       * Set token.
	       */

	      OAuthToken.setToken = function(data) {
	        return $cookies.putObject(config.name, data, config.options);
	      };

	      /**
	       * Get token.
	       */

	      OAuthToken.getToken = function() {
	        return $cookies.getObject(config.name);
	      }

	      /**
	       * Get accessToken.
	       */

	      OAuthToken.getAccessToken = function() {
	        return this.getToken() ? this.getToken().access_token : undefined;
	      }

	      /**
	       * Get authorizationHeader.
	       */

	      OAuthToken.getAuthorizationHeader = function() {
	      	if (!(this.getTokenType() && this.getAccessToken())) {
	          return;
	        }
	        return this.getTokenType().charAt(0).toUpperCase() + this.getTokenType().substr(1) + ' ' + this.getAccessToken();
	      }

	      /**
	       * Get refreshToken.
	       */

	      OAuthToken.getRefreshToken = function() {
	        return this.getToken() ? this.getToken().refresh_token : undefined;
	      }

	      /**
	       * Get tokenType.
	       */

	      OAuthToken.getTokenType = function() {
	        return this.getToken() ? this.getToken().token_type : undefined;
	      }

	      /**
	       * Remove token.
	       */

	      OAuthToken.removeToken = function() {
	        return $cookies.remove(config.name, config.options);
	      }
	    

	    return OAuthToken;
	  }];
});