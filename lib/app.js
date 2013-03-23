var express = require('express'),
    util = require('util'),
    fs = require('fs'),
    path = require('path'),
    exec = require('child_process').exec,
    mime = require('mime'),
    utils = require('./utils'),
    app = express(),
    updateSchedule = {};

var CLONE_COMMAND = 'git clone git@github.com:%s/%s.git';
var UPDATE_COMMAND = 'git pull';
var CHECKOUT_COMMAND = 'git checkout %s';

/**
 * No op command for repository
 */
function noopRepoCommand(userDir, user, repo, tree, callback) {
  callback();
}

/**
 * Clone the repository
 */
function cloneRepo(userDir, user, repo, tree, callback) {
  console.log('    Cloning repo : %s/%s', user, repo);
  // Clone the repo or fail
  var command = util.format(CLONE_COMMAND, user, repo);
  exec(command, { cwd: userDir }, function(err, stdout, stderr) {
    if(err) {
      if(stderr.indexOf('Repository not found.') !== -1) {
        var notFound = new Error('Repository not found');
        notFound.name = 'NotFound';
        return callback(notFound);
      }
      return callback(err);
    }
    var repoDir = path.resolve(userDir, repo);
    checkoutRepoTree(repoDir, tree, callback);
  });
}

/**
 * Update the repository
 */
function updateRepo(userDir, user, repo, tree, callback) {
  console.log('    Updating repo : %s/%s', user, repo);
  var command = UPDATE_COMMAND;
  var repoDir = path.resolve(userDir, repo);
  exec(command, { cwd: repoDir }, function(err, stdout, stderr) {
    if(err) {
      return callback(err);
    }
    checkoutRepoTree(repoDir, tree, callback);
  });
}

/**
 * Checkout the repository's tree
 */
function checkoutRepoTree(repoDir, tree, callback) {
  var command = util.format(CHECKOUT_COMMAND, tree);
  exec(command, { cwd: repoDir }, function(err, stdout, stderr) {
    if(err) {
      if(stderr.indexOf('did not match any file(s)') !== -1) {
        var notFound = new Error('Tree not found');
        notFound.name = 'NotFound';
        return callback(err);
      }
      return callback(err);
    }
    callback();
  });
}

/**
 * Serve a file from a repo
 */
function serveFile(userDir, repo, reqPath, res) {
  var fileToServe = path.join(userDir, repo, reqPath);
  if(!utils.isFile(fileToServe)) {
    return res.send(404, 'File not found');
  }
  res.type(mime.lookup(fileToServe));
  return res.send(200, fs.readFileSync(fileToServe, { encoding: 'utf-8' }));
};

app.get('/:user/:repo/:tree/*', function(req, res) {
  var user = req.params.user,
      repo = req.params.repo,
      tree = req.params.tree; // Branch/tag/commit
  var userDir = path.resolve(app.COMPONENTS_PATH, user),
      repoDir = path.resolve(userDir, repo);
  var repoKey = util.format('%s/%s', user, repo);
  var repoCommand = noopRepoCommand;
  var reqPath = req.params[0];
  // Check if the repo exists
  if(!utils.isDir(repoDir)) {
    // Create the user directory
    utils.ensureDir(userDir);
    // Set to clone the repo
    repoCommand = cloneRepo;
  } else {
    // Check update schedule if we need to update the repo.
    if(updateSchedule[repoKey] === undefined) {
      repoCommand = updateRepo;
    }
  }
  repoCommand(userDir, user, repo, tree, function(err) {
    if(updateSchedule[repoKey] === undefined) {
      updateSchedule[repoKey] = new Date();
    }
    if(err) {
      if(err.name == 'NotFound') {
        return res.send(404, 'Repo not found');
      }
      return res.send(500, 'Internal Server Error\n\n' + err.message);
    }
    // Serve the requested file
    serveFile(userDir, repo, reqPath, res);
  });
});

module.exports = app;
