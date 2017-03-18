"use strict";

var nextToken = 1;
var subscriptionMapping = {};

module.exports = function (ethrpc) {
  return {
    getBlockByNumber: ethrpc.getBlockByNumber.bind(ethrpc),
    getBlockByHash: ethrpc.getBlockByHash.bind(ethrpc),
    subscribeToReconnects: ethrpc.internalState.transporter.addReconnectListener.bind(ethrpc.internalState.transporter),
    unsubscribeFromReconnects: ethrpc.internalState.transporter.removeReconnectListener.bind(ethrpc.internalState.transporter),
    subscribeToNewHeads: function (onNewHead, onSubscriptionError) {
      var token = (nextToken++).toString();
      subscriptionMapping[token] = null;
      ethrpc.subscribeNewHeads(function (subscriptionId) {
        if (subscriptionId instanceof Error || subscriptionId.error) return onSubscriptionError(subscriptionId);
        // it is possible the caller already unsubscribed by the time this callback is called, in which case we need to unsubscribe from the remote
        if (subscriptionMapping[token] === undefined) {
          ethrpc.unsubscribe(subscriptionId, function () { });
          return;
        }
        subscriptionMapping[token] = subscriptionId;
        ethrpc.internalState.subscriptions[subscriptionId] = onNewHead;
      });
      return token;
    },
    unsubscribeFromNewHeads: function (token) {
      if (!token) return;
      var subscriptionId = subscriptionMapping[token];
      delete subscriptionMapping[token];
      delete ethrpc.internalState.subscriptions[subscriptionId];
      if (!subscriptionId) return;
      // we don't care about the result, this unsubscribe is just to be nice to the remote host
      ethrpc.unsubscribe(subscriptionId, function () { });
    },
  };
};
