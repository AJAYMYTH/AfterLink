const FrameTypes = require('../FrameTypes');

const ERROR_CATEGORIES = [
  'protocol',
  'auth',
  'route',
  'validation',
  'rate_limit',
  'connection',
  'server',
  'compression',
];

class AfterLinkError extends Error {
  constructor({ code, message, category, httpStatus, details, requestId, cause }) {
    super(message, { cause });
    this.name = 'AfterLinkError';
    this.code = code;
    this.category = category;
    this.httpStatus = httpStatus;
    this.details = details;
    this.requestId = requestId;
    this.timestamp = new Date();
  }

  toJSON() {
    const result = {
      code: this.code,
      message: this.message,
      category: this.category,
      httpStatus: this.httpStatus,
    };
    if (this.details !== undefined) result.details = this.details;
    if (this.requestId !== undefined) result.requestId = this.requestId;
    return result;
  }

  toFrame(messageId = 0) {
    const Frame = require('../Frame');
    const Serializer = require('../Serializer');
    const payload = Serializer.encode(this.toJSON());
    return Frame.encode(FrameTypes.ERROR, 0, messageId, payload);
  }
}

function isErrorCategory(value) {
  return ERROR_CATEGORIES.includes(value);
}

module.exports = { AfterLinkError, ERROR_CATEGORIES, isErrorCategory };
