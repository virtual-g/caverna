"use strict";

const { TABLES_TABLE, CONNECTIONS_COLUMN, CONNECTIONS_TABLE, STATUS_COLUMN, TABLE_ID } = require('./resources.js');

const AWS = require('aws-sdk');
const DDB = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});

// ********************** TABLES **********************
const getTable = async (tableId) => {
    const params = {
        TableName: TABLES_TABLE,
        Key: { tableId: tableId }
    };
    const result = await DDB.get(params).promise();
    return result.Item;
};

const getConnections = async (tableId) => {
    const params = {
        TableName: TABLES_TABLE,
        Key: { tableId: tableId },
        ProjectionExpression: CONNECTIONS_COLUMN
    };
    const result = await DDB.get(params).promise();
    return Object.keys(result.Item[CONNECTIONS_COLUMN]);
};

const updateTableGameStatus =  async (tableId, status) => {
    const params = {
        TableName: TABLES_TABLE,
        Key: { tableId: tableId },
        UpdateExpression: "SET #a = :vals",
        ExpressionAttributeNames: {'#a' : STATUS_COLUMN},
        ExpressionAttributeValues: { ":vals": status },
        ReturnValues: "UPDATED_NEW"
    };
    return await DDB.update(params).promise();
};

const updateTableAddConnection =  async (tableId, connectionId, name) => {
    const params = {
        TableName: TABLES_TABLE,
        Key: { tableId: tableId },
        UpdateExpression: "set connections.#id = :player",
        ExpressionAttributeNames: { '#id' : connectionId },
        ExpressionAttributeValues: { ":player": { 'name': name } },
        ReturnValues: "UPDATED_NEW"
    };
    return await DDB.update(params).promise();
};

const updateTableRemoveConnection =  async (tableId, connectionId) => {
    const params = {
        TableName: TABLES_TABLE,
        Key: { tableId: tableId },
        UpdateExpression: "REMOVE connections.#id",
        ExpressionAttributeNames: { '#id' : connectionId },
        ReturnValues: "UPDATED_NEW"
    };
    return await DDB.update(params).promise();
};

// ********************** CONNECTIONS **********************
const addConnection =  async (tableId, connectionId, name) => {
    await addConnectionToTableMapping(tableId, connectionId);
    await updateTableAddConnection(tableId, connectionId, name);
};

const deleteConnection =  async (tableId, connectionId) => {
    await deleteConnectionToTableMapping(connectionId);
    await updateTableRemoveConnection(tableId, connectionId);
};

const getTableIdFromConnection = async (connectionId) => {
    const params = {
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId: connectionId },
        ProjectionExpression: TABLE_ID
    };
    const result = await DDB.get(params).promise();
    return result.Item[TABLE_ID];
};

const addConnectionToTableMapping = async (tableId, connectionId) => {
    const params = {
        TableName: CONNECTIONS_TABLE,
        Item: {
            connectionId: connectionId,
            tableId: tableId
        },
    };
    return await DDB.put(params).promise();
};

const deleteConnectionToTableMapping = async (connectionId) => {
    const params = {
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId: connectionId }
    };

    return await DDB.delete(params).promise();
};

module.exports = {
    getTable,
    getTableIdFromConnection,
    updateTableGameStatus,
    getConnections,
    addConnection,
    deleteConnection
};
