"use strict";

var Notifier = require("../utilities/notifier.js");
var validateBlock = require("./validate-block.js");

function SubscribingBlockNotifier(transport, onUnrecoverableSubscriptionFailure) {
  Notifier.call(this);

  var reconnectToken = null;
  var subscriptionToken = null;

  this.destroy = function () {
    this.unsubscribeAll();
    if (reconnectToken) transport.unsubscribeFromReconnects(reconnectToken);
    if (subscriptionToken) transport.unsubscribeFromNewHeads(subscriptionToken);
  }.bind(this);

  var onNewHeadsSubscriptionError = function () {
    this.destroy();
    onUnrecoverableSubscriptionFailure();
  }.bind(this);

  var onNewHead = function (newBlock) {
    validateBlock(newBlock);
    this.notifySubscribers(newBlock);
  }.bind(this);

  var setupSubscriptions = function () {
    subscriptionToken = transport.subscribeToNewHeads(onNewHead, onNewHeadsSubscriptionError);
  }.bind(this);

  var onReconnectsSubscriptionError = function () {
    this.destroy();
    onUnrecoverableSubscriptionFailure();
  }.bind(this);

  var onReconnect = function () {
    setupSubscriptions();
  }.bind(this);

  reconnectToken = transport.subscribeToReconnects(onReconnect, onReconnectsSubscriptionError);
  setupSubscriptions();
}

SubscribingBlockNotifier.prototype = Object.create(Notifier.prototype);
SubscribingBlockNotifier.prototype.constructor = SubscribingBlockNotifier;

module.exports = SubscribingBlockNotifier;
