"use strict";

var Notifier = require("../utilities/notifier.js");
var BlockStream = require("../block-management/block-stream.js");

function LogStream(transport, blockStream) {
  var nextFilterToken = 1;
  var filters = {};
  var logsByBlock = {};

  this.addFilterTopics = function (contractAddress, firstPosition, secondPosition, thirdPosition) {
    var token = (nextFilterToken++).toString();
    filters[token] = { contractAddress: contractAddress || null, topics: [firstPosition, secondPosition, thirdPosition] };
    return token;
  }.bind(this);

  this.removeFilterTopics = function (token) {
    delete filters[token];
  }.bind(this);

  var onNewLog = function (newBlock, newLog) {
    // we'll handle log removal client side
    if (log.removed) return;
    // we expect all logs to be part of newBlock, but geth doesn't guarantee this so throw away anything that isn't a match
    // FIXME: there is a race condition here where a re-org away from a block and back could result in never getting the logs for this block!
    if (log.blockHash !== newBlock.hash) return;
    this.notifySubscribers(log, null);
  }.bind(this);

  var onNewLogs = function (newBlock, error, newLogs) {
    // CONSIDER: can we handle this error better?  is there any way to recover healthily (we have missed some logs if we get this error)
    if (error) throw error;
    if (!(newLogs instanceof Array)) throw new Error("Expected getLogs to return an array.");
    newLogs.forEach(onNewLog.bind(this, newBlock));
  }.bind(this);

  var onNewBlock = function (newBlock) {
    Object.keys(filters).forEach(function (key) {
      var filter = filters[key];
      transport.getLogs(newBlock.number, newBlock.number, filter.contractAddress, filter.topics, onNewLog.bind(this, newBlock));
    });
  }.bind(this);

  var removeLog = function (log) {
    // add this for consistency with Ethereum JSON-RPC log removal syntax
    log.removed = true;
    this.notifySubscribers(null, log);
  }.bind(this);

  var onRemovedBlock = function (removedBlock) {
    var logs = logsByBlock[removedBlock.hash];
    logs.forEach(removeLog);
    delete logsByBlock[removedBlock.hash];
  }.bind(this);

  var onBlock = function (newBlock, removedBlock) {
    if ((newBlock && removedBlock) || (!newBlock && !removedBlock)) throw new Error("Expected either newBlock or removedBlock, but not neither and not both.");
    if (newBlock) {
      onNewBlock(newBlock);
    } else if (removedBlock) {
      onRemovedBlock(removedBlock);
    }
    // TODO: prune old logs
    // TODO: iterate over all logs, look at block number in log, compare with block number we just recevied, delete log if it is from a very old block
  }.bind(this);

  blockStream.subscribe(onBlock);
}
