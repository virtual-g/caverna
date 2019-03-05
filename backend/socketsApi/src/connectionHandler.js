"use strict";

const uuid = require('uuid/v4');
const AWS = require('aws-sdk');
const https = require('https');
const sslAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    rejectUnauthorized: true
});
sslAgent.setMaxListeners(0);
AWS.config.update({
    region: process.env.AWS_REGION,
    httpOptions: { agent: sslAgent }
});

const { addConnection, deleteConnection, getTableIdFromConnection} = require('./db.js');
const { success, error } = require('./utils.js');
const { CONNECT, DISCONNECT } = require('./resources.js');

// wscat -c wss://9w0jkjciw8.execute-api.us-west-1.amazonaws.com/dev?tableId=A&name=virtual
// Handles adding and deleting connections
const connectionManager =  async (event) => {
    const eventType = event.requestContext.eventType;
    const connectionId = event.requestContext.connectionId;

    try {
        if (eventType === CONNECT) {
            await addConnection(String(event.queryStringParameters.tableId), connectionId,
                String(event.queryStringParameters.name));
            return success(CONNECT);
        } else if (eventType === DISCONNECT) {
            // Note: the disconnect event will not have the tableId, so must retrieve it.
            const tableId = await getTableIdFromConnection(connectionId);
            await deleteConnection(tableId, connectionId);
            return success(DISCONNECT);
        }
    } catch (err) {
        return error(err);
    }
};

module.exports = {
    connectionManager
};
