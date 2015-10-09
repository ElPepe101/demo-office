// Structure: Source and Target directories
var strctr = require("./structure.json");

var gulp = require('gulp');
var gutil = require('gulp-util');

var bower = require('gulp-bower');

var autoprefixer = require('gulp-autoprefixer');
var minifycss = require('gulp-minify-css');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

var compress = require('gulp-minify-html');

var rename = require("gulp-rename");
var browserSync = require('browser-sync').create();
var notify = require("gulp-notify");
var sourcemaps = require('gulp-sourcemaps');

// Bower compilation & selection
// This defaults to the directory configured in ./.bowerrc
// or to ./bower_components when no .bowerrc could be found.
gulp.task('bower', function() {
  return bower();
});

// CSS compilation
gulp.task('css', function () {
    gulp.src(strctr.src.css)
        .pipe(sourcemaps.init())
            .pipe(autoprefixer())
            .pipe(concat("styles.min.css"))
            .pipe(minifycss().on('error', gutil.log))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(strctr.dist.css))
        .pipe(browserSync.stream())
        .pipe(notify("Minified CSS files"));
});

// JS compilation
gulp.task('js', function() {
    gulp.src(strctr.src.js)
        .pipe(sourcemaps.init())
            .pipe(concat("scripts.min.js"))
            .pipe(uglify().on('error', gutil.log))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(strctr.dist.js).on('error', gutil.log))
        .pipe(notify("Uglified JS files."))
        .pipe(browserSync.stream());
});

// HTML compilation
gulp.task('html', function() {
    gulp.src(strctr.src.html, {base: 'src/'})
        .pipe(compress())
        .pipe(gulp.dest(strctr.dist.html).on('error', gutil.log))
        .pipe(notify("Compressed HTML files."))
        .pipe(browserSync.stream());
});

// Components
gulp.task('css-components', function () {
    gulp.src(strctr.lib.css)
        .pipe(concat("libs.min.css"))
        .pipe(minifycss().on('error', gutil.log))
        .pipe(gulp.dest(strctr.dist.css))
        .pipe(notify("CSS Comps Finished"));
});

gulp.task('js-components', function () {
    gulp.src(strctr.lib.js)
        .pipe(concat("libs.min.js"))
        .pipe(uglify().on('error', gutil.log))
        .pipe(gulp.dest(strctr.dist.js))
        .pipe(notify("JS Comps Finished"));
});

// Static Server + watching scss/html files
gulp.task('serve', ['html', 'css', 'js'], function() {

    browserSync.init({
        proxy: strctr.site + "/",
        port: 8080,
        open: false,
        ui: false,
        //logLevel: "debug",
        logConnections: false,
        logFileChanges: false,
        logSnippet: false,
        online: false,
        notify: false
        // browser: ["google chrome", "firefox"]
    });

    gulp.watch(strctr.src.html, ['html']);
    gulp.watch(strctr.src.css, ['css']);
    gulp.watch(strctr.src.js, ['js']);
});

function string_src(filename, string) {
    var src = require('stream').Readable({ objectMode: true });
    src._read = function () {
        this.push(new gutil.File({ cwd: "", base: "", path: filename, contents: new Buffer(string) }));
        this.push(null);
    };
    return src;
}

// This will populate the router based on structure.json
gulp.task('router', function() {

    var pages = '';
    for(var p in strctr.pages) {
        pages += "\n\t\t.when('" + strctr.pages[p].page + "', {\n";

        if(!! strctr.pages[p].metadata) {
            var metadata = strctr.pages[p].metadata;
            pages += "\t\t\tmetadata: [\n";

            for(var metas in metadata) {
                pages += "\t\t\t\t" + JSON.stringify(metadata[metas]) +",\n";
            }
            pages = pages.replace(/,\s*$/, "") + "\n";
            pages += "\t\t\t],\n";
            delete strctr.pages[p].metadata;
        }

        for(var node in strctr.pages[p]) {
            pages += strctr.pages[p][node] ? "\t\t\t" + node + ": '" + strctr.pages[p][node] + "',\n": '';
        }
        // Remove last comma
        pages = pages.replace(/,\s*$/, "") + "\n";
        pages += "\t\t})";
    }

    var router = "'use strict';\n\n\
app.config(['$routeProvider', '$locationProvider', function ($routeProvider, $locationProvider) {\n\
    $routeProvider\
" + pages + "\n\
        .otherwise({\n\
            redirectTo: '/'\n\
        });\n\n\
    if(window.history && window.history.pushState){\n\
        $locationProvider.html5Mode(true);\n\
    }\n\
}]);";

    string_src("app.router.js", router)
        .pipe(gulp.dest('src/app/'))
        .pipe(notify("Router Created"));
});

// This task will generate sitemap.xml based on structure.json
gulp.task('sitemap', ['router', 'js'], function () {

    var pages = '';
    for(var p in strctr.pages) {
        pages += '<url>\n\
            <loc>http://' + strctr.site + strctr.pages[p].page + '</loc>\n\
            <lastmod>' + Date.now() + '</lastmod>\n\
        </url>';
    }

    var sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n\
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\
        '+ pages +'\n\
    </urlset>';

    string_src("sitemap.xml", sitemap)
        .pipe(gulp.dest(strctr.dist.html))
        .pipe(notify("Sitemap Added"));
});

// And this is for the robots
gulp.task('robots', ['sitemap'], function () {

    var robots = "User-agent: *\n\
Allow: public/\n\
Disallow: cgi-bin/ lib/ app/ logs/\n\
Sitemap: http://" + strctr.site + "/sitemap.xml";

    string_src("robots.txt", robots)
        .pipe(gulp.dest(strctr.dist.html))
        .pipe(notify("Robots Added"));
});

// htacces redirect to index.html
gulp.task('htaccess', function() {

    var htaccess = "RewriteEngine On\n\n\
RewriteCond %{HTTP_USER_AGENT} baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora\\ link\\ preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator [NC,OR]\n\
RewriteCond %{QUERY_STRING} ^_escaped_fragment_=/?(.*)$\n\
RewriteCond %{REQUEST_URI} !^/snapshots/ [NC]\n\
RewriteRule ^(.*)/?$ /snapshots/$1 [L]\n\n\
# If an existing asset or directory is requested go to it as it is\n\
RewriteCond %{DOCUMENT_ROOT}%{REQUEST_URI} -f [OR]\n\
RewriteCond %{DOCUMENT_ROOT}%{REQUEST_URI} -d\n\
RewriteRule ^ - [L]\n\n\
# If the requested resource doesn't exist, use index.html\n\
RewriteRule ^ index.html";

    string_src(".htaccess", htaccess)
        .pipe(gulp.dest(strctr.dist.html))
        .pipe(notify("htaccess Added"));
});

gulp.task('img', function() {

    gulp.src(['./src/assets/img/**/*'], {base: './src/assets/'})
        .pipe(gulp.dest("./dist/public/"));
});

// Default Task
gulp.task('default', ['bower', 'serve', 'css-components', 'js-components', 'img']);
