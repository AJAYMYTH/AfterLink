const fs = require('fs');
const path = require('path');
const os = require('os');

function getRcPath() {
  return path.join(os.homedir(), '.afterlinkrc');
}

function loadRc() {
  const rcPath = getRcPath();
  if (!fs.existsSync(rcPath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(rcPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Warning: Failed to parse ${rcPath}: ${err.message}`);
    return {};
  }
}

function getProfile(profileName) {
  const rc = loadRc();
  if (!profileName || profileName === 'default') {
    return rc.default || {};
  }
  return rc[profileName] || {};
}

function mergeWithProfile(options, profileName) {
  const profile = getProfile(profileName);
  return {
    host: options.host || profile.host || 'localhost',
    port: options.port || profile.port || 4000,
    tls: options.tls || profile.tls || false,
    auth: options.auth || profile.auth || null,
  };
}

module.exports = { getRcPath, loadRc, getProfile, mergeWithProfile };
