var gulp = require('gulp');
var minify = require('gulp-minify');
var stylus = require('gulp-stylus');
var rename = require('gulp-rename');
var watch = require('gulp-watch');
var plumber = require('gulp-plumber');

gulp.task('default', ['build']);
gulp.task('watch', ['build', 'watch']);
gulp.task('build', ['compress', 'compress-angular']);


gulp.task('watch', function () {
    // Endless stream mode 
    return watch(['lib/*.js', 'modules/**/index.js', 'views/*.html'], function (events, done) {
      gulp.start('compress');
    });
});

gulp.task('compress', function() {
  gulp.src([
  'lib/*.js'
  ])
    .pipe(plumber())
    .pipe(minify({
        ext:{
            src:'-debug.js',
            min:'.js'
        },
        exclude: ['tasks'],
        ignoreFiles: ['.combo.js', '-min.js']
    }))
    .pipe(gulp.dest('build'));
  gulp.src([
  'modules/**/index.js'
  ])
    .pipe(plumber())
    .pipe(minify({
        ext:{
            src:'-debug.js',
            min:'.js'
        },
        exclude: ['tasks'],
        ignoreFiles: ['.combo.js', '-min.js']
    }))
    .pipe(rename(function (path) {
        console.log('path', path);
        if (path.extname) {
            if (path.dirname === '.') {
                path.dirname = '';
            }
            path.basename = path.dirname;
            path.dirname = '';
            console.log('path-new', path);
        }
    }))
    .pipe(gulp.dest('build'));
  gulp.src([
  'views/*.html'
  ])
    .pipe(plumber())
    .pipe(minify())
    .pipe(gulp.dest('build'));});

gulp.task('compress-angular', function() {
// angular
  gulp.src([
    'node_modules/moment/moment.js',
    'node_modules/angular/angular.js',
    'node_modules/angular-aria/angular-aria.js',
    'node_modules/angular-animate/angular-animate.js',
    'node_modules/angular-material/angular-material.js',
    'node_modules/angular-moment/angular-moment.js',
    'node_modules/angular-material-icons/angular-material-icons.js',
    'node_modules/angular-cookies/angular-cookies.min.js',
    'node_modules/angular-route/angular-route.js',
    'node_modules/query-string/query-string.js',
    'node_modules/angular-oauth2/dist/angular-oauth2.min.js'
  ])
    .pipe(plumber())
    .pipe(minify({
        ext:{
            min:'.js'
        },
        exclude: ['tasks'],
        ignoreFiles: ['.combo.js', '-min.js']
    }))
    .pipe(gulp.dest('./build/angular'));

  gulp.src([
    'node_modules/angular-material/angular-material.css',
    'node_modules/angular-material-icons/angular-material-icons.css',
    ])
    .pipe(plumber())
    .pipe(stylus({
      compress: true
    }))
    .pipe(gulp.dest('./build/angular'));
});