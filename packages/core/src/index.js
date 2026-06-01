const Frame = require('./Frame');
const FrameTypes = require('./FrameTypes');
const Serializer = require('./Serializer');
const compression = require('./codec/compression');
const errors = require('./errors');
// FIX (Problem 8): Export TcpClient so consumers have a ready-made TCP client
// for testing and custom integrations instead of building raw socket clients.
const TcpClient = require('./TcpClient');

module.exports = {
  Frame,
  FrameTypes,
  Serializer,
  compression,
  errors,
  TcpClient,
};
