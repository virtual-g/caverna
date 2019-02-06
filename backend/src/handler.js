"use strict";

const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.AWS_REGION });
const DDB = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
const APIGW = new AWS.ApiGatewayManagementApi({apiVersion: '2018-11-29', endpoint: process.env.ENDPOINT});

const { success, error } = require('./utils.js');

const CONNECT = "CONNECT";
const DISCONNECT = "DISCONNECT";
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

const connectionManager =  async (event) => {
    const eventType = event.requestContext.eventType;
    const connectionId = event.requestContext.connectionId;

    try {
        if (eventType === CONNECT) {
            await addConnection(connectionId);
            return success(CONNECT);
        } else if (eventType === DISCONNECT) {
            await deleteConnection(connectionId);
            return success(DISCONNECT);
        }
    } catch (err) {
        return error(err);
    }
};

const defaultMessage = async (event) => {
    console.log(JSON.stringify(event,null,2));
    return success("invalid action type");
}

// {"action": "sendMessage", "name": "Greg", "data": "hello there!"}
const sendMessage = async (event) => {
    console.log(JSON.stringify(event,null,2));
    try {
        const connectionData = await DDB.scan({
            TableName: CONNECTIONS_TABLE,
            ProjectionExpression: "connectionId"
        }).promise();

        const postCalls = connectionData.Items.map(async ({ connectionId }) => {
            try {
                return await send(connectionId, JSON.parse(event.body).data);
            } catch (err) {
                if (err.statusCode === 410) {
                    return await deleteConnection(connectionId);
                }
                console.log(JSON.stringify(err));
                throw err;
            }
        });
        await Promise.all(postCalls);
        return success('SENT');
    } catch (err) {
        return error(err);
    }
};

const send = async (connectionId, data) => {
    return await APIGW.postToConnection({ ConnectionId: connectionId, Data: data }).promise();
};

const addConnection =  async (connectionId) => {
    const params = {
        TableName: CONNECTIONS_TABLE,
        Item: { connectionId: connectionId }
    };
    return await DDB.put(params).promise();
};

const deleteConnection =  async (connectionId) => {
    const params = {
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId: connectionId }
    };
    return await DDB.delete(params).promise();
};

module.exports = {
    connectionManager,
    defaultMessage,
    sendMessage,
    addConnection,
    deleteConnection
};
