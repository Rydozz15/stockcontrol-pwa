/**
 * Master E2E Harness Index
 */

const expiry = require('./expiry');
const models = require('./models');
const waste = require('./waste');
const store = require('./store');
const workspace = require('./workspace');
const contingency = require('./contingency');
const scanner = require('./scanner');
const ui = require('./ui');
const pwa = require('./pwa');

module.exports = {
  ...expiry,
  ...models,
  ...waste,
  ...store,
  ...workspace,
  ...contingency,
  ...scanner,
  ...ui,
  ...pwa
};
