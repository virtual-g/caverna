"use strict";

const { ENDPOINT, CONNECTIONS_COLUMN, STARTED, OPEN } = require('./resources.js');

const AWS = require('aws-sdk');
const APIGW = new AWS.ApiGatewayManagementApi({apiVersion: '2018-11-29', endpoint: ENDPOINT});

const { deleteConnection, getConnections, getTable, updateTableGameStatus, } = require('./db.js');
const { success, error } = require('./utils.js');

const send = async (connectionId, senderConnectionId, data) => {
    try {
        if (connectionId !== senderConnectionId) {
            await APIGW.postToConnection({ ConnectionId: connectionId, Data: data }).promise();
        }
    } catch (err) {
        if (err.statusCode === 410) return await deleteConnection(connectionId);
        console.log(JSON.stringify(err));
        throw err;
    }
};

// Default response if message sent without a defined action type
const defaultMessage = async (event) => {
    console.log(JSON.stringify(event,null,2));
    return success("invalid action type");
}

// {"action": "chatMessage", "name": "Greg", "data": "hello there!", "tableId": "A"}
// Sends a chat message to the other connections
const chatMessage = async (event) => {
    const senderConnectionId = event.requestContext.connectionId;
    const message = JSON.parse(event.body);
    const tableId = String(message.tableId);

    try {
        const connections = await getConnections(tableId);
        const postCalls = connections.map(connectionId => send(connectionId, senderConnectionId, event.body));
        await Promise.all(postCalls);
        return success('SENT');
    } catch (err) {
        return error(err);
    }
};

// {"action": "playerJoinMessage", "name": "Greg", "tableId": "A"}
// Sends the current state of the table to all players seated at this table.
const playerJoinMessage = async (event) => {
    const message = JSON.parse(event.body);
    const tableId = String(message.tableId);

    try {
        const table = await getTable(tableId);
        message.table = table;
        const connections = Object.keys(table[CONNECTIONS_COLUMN]);
        const postCalls = connections.map(connectionId => send(connectionId, '', JSON.stringify(message)));
        await Promise.all(postCalls);
        return success('TABLE UPDATE SENT');
    } catch (err) {
        return error(err);
    }
};

// {"action": "startGameMessage", "name": "Greg", "tableId": "A"}
// Sends a message to start the game
const startGameMessage = async (event) => {
    const senderConnectionId = event.requestContext.connectionId;
    const message = JSON.parse(event.body);
    const tableId = String(message.tableId);

    try {
        const table = await getTable(tableId);
        if (table.status === STARTED) {
            return success('ALREADY STARTED');
        }
        await updateTableGameStatus(tableId, STARTED);
        const connections = Object.keys(table[CONNECTIONS_COLUMN]);
        const postCalls = connections.map(connectionId => send(connectionId, '', event.body));
        await Promise.all(postCalls);
        return success('SENT');
    } catch (err) {
        return error(err);
    }
};

// {"action": "endGameMessage", "name": "Greg", "tableId": "A"}
// Sends a message to end the game
const endGameMessage = async (event) => {
    const senderConnectionId = event.requestContext.connectionId;
    const message = JSON.parse(event.body);
    const tableId = String(message.tableId);

    try {
        await updateTableGameStatus(tableId, OPEN);
        const table = await getTable(tableId);
        const connections = Object.keys(table[CONNECTIONS_COLUMN]);
        const postCalls = connections.map(connectionId => send(connectionId, '', event.body));
        await Promise.all(postCalls);
        return success('SENT');
    } catch (err) {
        return error(err);
    }
};

module.exports = {
    defaultMessage,
    chatMessage,
    playerJoinMessage,
    startGameMessage,
    endGameMessage
};
