import gulp from 'gulp';
import deploy from 'gulp-gh-pages';

let preprocessor = 'sass'; // Preprocessor (sass, less, styl); 'sass' also works with the Scss syntax in blocks/ folder.
let fileswatch = 'html,htm,txt,json,md,woff2'; // List of file extensions for watching & hard reload

import browserSync from 'browser-sync';
import bssi from 'browsersync-ssi';
import ssi from 'ssi';
import webpackStream from 'webpack-stream';
import webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';
import gulpSass from 'gulp-sass';
import dartSass from 'sass';
import sassglob from 'gulp-sass-glob';
const sass = gulpSass(dartSass);
import less from 'gulp-less';
import lessglob from 'gulp-less-glob';
import styl from 'gulp-stylus';
import stylglob from 'gulp-noop';
import postCss from 'gulp-postcss';
import cssnano from 'cssnano';
import autoprefixer from 'autoprefixer';
import imagemin from 'gulp-imagemin';
import changed from 'gulp-changed';
import concat from 'gulp-concat';
import rsync from 'gulp-rsync';
import { deleteAsync } from 'del';

function browsersync() {
  browserSync.init({
    server: {
      baseDir: 'app/',
      middleware: bssi({ baseDir: 'app/', ext: '.html' }),
    },
    ghostMode: { clicks: false },
    notify: false,
    online: true,
    // tunnel: 'yousutename', // Attempt to use the URL https://yousutename.loca.lt
  });
}

function scripts() {
  return gulp
    .src(['app/js/*.js', '!app/js/*.min.js'])
    .pipe(
      webpackStream(
        {
          mode: 'production',
          performance: { hints: false },
          plugins: [
            new webpack.ProvidePlugin({ $: 'jquery', jQuery: 'jquery', 'window.jQuery': 'jquery' }), // jQuery (npm i jquery)
          ],
          module: {
            rules: [
              {
                test: /\.m?js$/,
                exclude: /(node_modules)/,
                use: {
                  loader: 'babel-loader',
                  options: {
                    presets: ['@babel/preset-env'],
                    plugins: ['babel-plugin-root-import'],
                  },
                },
              },
            ],
          },
          optimization: {
            minimize: true,
            minimizer: [
              new TerserPlugin({
                terserOptions: { format: { comments: false } },
                extractComments: false,
              }),
            ],
          },
        },
        webpack
      ).on('error', (err) => {
        this.emit('end');
      })
    )
    .pipe(concat('app.min.js'))
    .pipe(gulp.dest('app/js'))
    .pipe(browserSync.stream());
}

function styles() {
  return gulp
    .src([`app/styles/${preprocessor}/*.*`, `!app/styles/${preprocessor}/_*.*`])
    .pipe(eval(`${preprocessor}glob`)())
    .pipe(eval(preprocessor)({ 'include css': true }))
    .pipe(
      postCss([
        autoprefixer({ grid: 'autoplace' }),
        cssnano({ preset: ['default', { discardComments: { removeAll: true } }] }),
      ])
    )
    .pipe(concat('app.min.css'))
    .pipe(gulp.dest('app/css'))
    .pipe(browserSync.stream());
}

function images() {
  return gulp
    .src(['app/images/src/**/*'])
    .pipe(changed('app/images/dist'))
    .pipe(imagemin())
    .pipe(gulp.dest('app/images/dist'))
    .pipe(browserSync.stream());
}

function buildcopy() {
  return gulp
    .src([
      '{app/js,app/css}/*.min.*',
      'app/images/**/*.*',
      '!app/images/src/**/*',
      'app/fonts/**/*',
    ], { base: 'app/' })
    .pipe(gulp.dest('dist'));
}

async function buildhtml() {
  let includes = new ssi('app/', 'dist/', '/**/*.html');
  includes.compile();
  await deleteAsync('dist/parts', { force: true });
}

async function cleandist() {
  await deleteAsync('dist/**/*', { force: true });
}

function deployToGHPages() {
  return gulp.src('./dist/**/*') // Path to your build folder
    .pipe(deploy());
}

function startwatch() {
  gulp.watch(`app/styles/${preprocessor}/**/*`, { usePolling: true }, styles);
  gulp.watch(['app/js/**/*.js', '!app/js/**/*.min.js'], { usePolling: true }, scripts);
  gulp.watch('app/images/src/**/*', { usePolling: true }, images);
  gulp.watch(`app/**/*.{${fileswatch}}`, { usePolling: true }).on('change', browserSync.reload);
}

export { scripts, styles, images, deployToGHPages };
export let assets = gulp.series(scripts, styles, images);
export let build = gulp.series(cleandist, images, scripts, styles, buildcopy, buildhtml);

export default gulp.series(scripts, styles, images, gulp.parallel(browsersync, startwatch));
