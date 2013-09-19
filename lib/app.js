var express = require('express'),
    util = require('util'),
    fs = require('fs'),
    path = require('path'),
    exec = require('child_process').exec,
    mime = require('mime'),
    utils = require('./utils'),
    app = express(),
    updateSchedule = null;

var CLONE_COMMAND = 'git clone git@github.com:%s/%s.git';
var UPDATE_COMMAND = 'git pull origin %s';
var CHECKOUT_COMMAND = 'git checkout %s';
// REFRESH TIME IN SECONDS
var REFRESH_TIME = 120;

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
    checkoutRepoTree(userDir, user, repo, tree, callback);
  });
}

/**
 * Update the repository
 */
function updateRepo(userDir, user, repo, tree, callback) {
  console.log('    Updating repo : %s/%s', user, repo);
  var command = util.format(UPDATE_COMMAND, tree);
  var repoDir = path.resolve(userDir, repo);
  exec(command, { cwd: repoDir }, function(err, stdout, stderr) {
    if(err) {
      return callback(err);
    }
    checkoutRepoTree(userDir, user, repo, tree, callback);
  });
}

/**
 * Checkout the repository's tree
 */
function checkoutRepoTree(userDir, user, repo, tree, callback) {
  var repoDir = path.resolve(userDir, repo);
  var command = util.format(CHECKOUT_COMMAND, tree);
  exec(command, { cwd: repoDir }, function(err, stdout, stderr) {
    if(err) {
      if(stderr.indexOf('did not match any file(s)') !== -1) {
        var notFound = new Error('Tree not found');
        notFound.name = 'NotFound';
        return callback(notFound);
      }
      return callback(err);
    }
    callback();
  });
}

/**
 * Serve a file from a repo
 */
function serveFile(userDir, repo, filePath, res) {
  var fileToServe = path.join(userDir, repo, filePath);
  if(!utils.isFile(fileToServe)) {
    return res.send(404, 'File not found');
  }
  res.type(mime.lookup(fileToServe));
  try {
    var file = fs.readFileSync(fileToServe);
    return res.send(200, file);
  } catch (e) {
    return res.send(404, 'File not found');
  }
};

/**
 * Save the updateSchedule
 */
function saveUpdateSchedule(componentsPath, updateSchedule) {
  var updateSchedulePath = path.resolve(componentsPath, 'updateSchedule.json');
  fs.writeFileSync(updateSchedulePath, JSON.stringify(updateSchedule));
}

/**
 * Load the update schedule
 */
function loadUpdateSchedule(componentsPath) {
  var updateScheduleSource = '{}';
  var updateSchedulePath = path.resolve(componentsPath, 'updateSchedule.json');
  if(fs.existsSync(updateSchedulePath)) {
    updateScheduleSource = fs.readFileSync(updateSchedulePath, 'utf8');
  }
  return JSON.parse(updateScheduleSource);
}

app.get('/:user/:repo/:tree/*', function(req, res) {
  var user = req.params.user,
      repo = req.params.repo,
      tree = req.params.tree; // Branch/tag/commit
  var userDir = path.resolve(app.COMPONENTS_PATH, user),
      repoDir = path.resolve(userDir, repo);
  // Load the update schedule once it is needed
  if(updateSchedule === null) {
    updateSchedule = loadUpdateSchedule(app.COMPONENTS_PATH);
  }
  var repoKey = util.format('%s/%s', user, repo);
  var repoCommand = checkoutRepoTree;
  var filePath = req.params[0];
  var forceSaveSchedule = false;
  // Check if the repo exists
  if(!utils.isDir(repoDir)) {
    // Create the user directory
    utils.ensureDir(userDir);
    // Set to clone the repo
    repoCommand = cloneRepo;
  } else {
    // Check update schedule if we need to update the repo.
    var lastChecked = updateSchedule[repoKey] || 0;
    var currentTime = new Date().getTime();
    var lastCheckedDelta = currentTime - lastChecked;
    if(lastCheckedDelta > REFRESH_TIME * 1000) {
      repoCommand = updateRepo;
      forceSaveSchedule = true;
    }
  }
  repoCommand(userDir, user, repo, tree, function(err) {
    if(updateSchedule[repoKey] === undefined || forceSaveSchedule) {
      updateSchedule[repoKey] = new Date().getTime();
      saveUpdateSchedule(app.COMPONENTS_PATH, updateSchedule);
    }
    if(err) {
      if(err.name == 'NotFound') {
        return res.send(404, 'Repo not found');
      }
      return res.send(500, 'Internal Server Error\n\n' + err.message);
    }
    // Serve the requested file
    serveFile(userDir, repo, filePath, res);
  });
});

module.exports = app;
