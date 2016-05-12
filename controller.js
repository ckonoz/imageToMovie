/*
 * Corinne Konoza
 * Tuesday May 10, 2016
 *
 * This file should export a function that can take a series of images (jpeg, png, etc.)
 * and convert them to a video (in the specified format) by giving the duration the image
 * should appear (to a minimum of 1/30th i.e. 30 frames per second)
 */

var allowedFormats = ["hls", "mp4"];
var _ = require("underscore");
var async = require("async");
var videoshow = require("videoshow");
var fs = require("fs");
var gm = require("gm");
var AWS = require('aws-sdk');
var ffmpeg = require("ffmpeg");
var config = require('./config.js');
var imageMagick = gm.subClass({
  imageMagick: true
});
var s3 = new AWS.S3({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey
});


//TODO:
// * provide an array of s3 keys and pull images from There
// * movie should be added to s3 when done
// * add option delete, if true then delete s3 images after creating the movie


// options- title, format, duration, size
exports.imageToMovieS3 = function(s3KeyArray, options, fn) {

  // validate inputs given
  if (!_.isArray(imageArray)) {
    return fn('An array of images must be provided to complete this action', null);
  }

  if (!_.isString(imageArrayDirectory)) {
    return fn('Please provide a valid directory for your image array', null);
  }

  if (options.format && (!_.isString(options.format) || (allowedFormats.indexOf(options.format) < 0))) {
    return fn('Please provide a valid video format', null);
  }

  if (options.title && !_.isString(options.title)) {
    return fn('Please provide a valid title for your video', null);
  }

  if (options.duration && (!_.isNumber(options.duration) || options.duration < 30)) {
    return fn('Please provide a valid duration', null);
  }

  if (options.size && !_.isNumber(options.size)) {
    return fn('Please provide a valid video size', null);
  }

  options.format = options.format || 'mp4';
  options.title = options.title || 'video';
  options.duration = options.duration || 50;
  options.size = options.size || 200;

  var jpgImageArray = [];

  // go through each image in array and convert to buffer for easy conversion to movie
  // also make sure all images are the same size
  async.each(imageArray, function(imageFile, callback) {
      fs.readFile(imageArrayDirectory + imageFile, function(err, data) {
        if (err) {
          return callback('There was an issue processing your files.'); // Fail if the file can't be read.
        }

        var magick = imageMagick(data); // should now be a buffer
        // check size
        magick.size(function(err, specs) {
          if (err || !_.isObject(specs)) {
            var error = "Could not get image size.";
            logger.error(error, err, specs)
            return res.status(500).json({
              errors: [{
                title: error,
                status: 500
              }]
            })
          }

          if (specs.width !== specs.height) {
            var min = Math.min(specs.width, specs.height);
            if (specs.width > specs.height) {
              var x = specs.height * .25;
              var y = 0;
              magick.crop(min, min, x, y);
            } else if (specs.height > specs.width) {
              var x = 0;
              var y = specs.width * .25;
              magick.crop(min, min, x, y);
            } else { // image is a square
              magick.crop(min, min, 0, 0);
            }
          }

          magick.resize(options.size, options.size).stream(function(err, stdout, stderr) {
            if (err) {
              var error = "Could not export image.";
              logger.error(error, err)
              return res.status(500).json({
                errors: [{
                  title: error,
                  status: 500
                }]
              })
            }
            var buffer = new Buffer(0);
            stdout.on('data', function(d) {
              buffer = Buffer.concat([buffer, d]);
            });
            stdout.on('end', function() {
              fs.writeFile(imageArrayDirectory + options.size + imageFile, buffer, function(err) {
                if (err) {
                  return callback('There was an issue saving your files in the new format'); // Fail if the file can't be saved.
                }

                jpgImageArray.push(imageArrayDirectory + options.size + imageFile);
                callback();
              });
            });
          });
        });
      });
    },
    function(err) {
      if (err) {
        return fn(err, null);
      }

      var videoTitle = options.title + '.' + options.format;
      var videoOptions = {
        fps: options.duration,
        transition: false,
        videoBitrate: 1024,
        videoCodec: 'libx264',
        format: options.format
      }

      videoshow(jpgImageArray, videoOptions)
        .save(imageArrayDirectory + videoTitle)
        .on('error', function(err, stdout, stderr) {
          return fn(err, null);
        })
        .on('end', function(output) {
          return fn(null, output);
        })
    });
}