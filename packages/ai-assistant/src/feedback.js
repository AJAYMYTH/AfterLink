const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const FEEDBACK_FILE = path.join(ROOT_DIR, 'data', 'feedback.json');

/**
 * Logs user feedback to feedback.json
 * @param {Object} entry - { query, response, confidence, helpful, sources }
 */
function logFeedback({ query, response, confidence, helpful, sources }) {
  try {
    const dir = path.dirname(FEEDBACK_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let logs = [];
    if (fs.existsSync(FEEDBACK_FILE)) {
      try {
        logs = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));
        if (!Array.isArray(logs)) logs = [];
      } catch (err) {
        logs = [];
      }
    }

    const newLog = {
      query,
      response,
      confidence,
      helpful: helpful.toLowerCase() === 'y' || helpful.toLowerCase() === 'yes',
      timestamp: new Date().toISOString(),
      sources
    };

    logs.push(newLog);
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(logs, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`[AI-Feedback] Failed to save feedback: ${err.message}`);
    return false;
  }
}

module.exports = {
  logFeedback
};
