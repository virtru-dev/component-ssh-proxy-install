var path = require('path');
var util = require('util');
var app = require('./lib/app');
var utils = require('./lib/utils');
var spawn = require('child_process').spawn;

// Get user home directory
var userHome = utils.getUserHome();

// Components Path (for cloning the data)
var componentsPath = path.resolve(userHome, '.component-priv-repos');

// Ensure the components path exists
utils.ensureDir(componentsPath);

// Set the components path for the app
app.COMPONENTS_PATH = componentsPath;

app.listen(1337);
