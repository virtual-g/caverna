"use strict";

const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.AWS_REGION });
const DDB = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
const APIGW = new AWS.ApiGatewayManagementApi({apiVersion: '2018-11-29', endpoint: process.env.ENDPOINT});

const { success, error } = require('./utils.js');

const CONNECT = "CONNECT";
const DISCONNECT = "DISCONNECT";
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const LOBBIES_TABLE = process.env.LOBBIES_TABLE;
const GAMES_TABLE = process.env.GAMES_TABLE;

// wscat -c wss://e8n9ravuvg.execute-api.us-west-1.amazonaws.com/dev?lobbyId=1
// Handles adding and deleting connections
const connectionManager =  async (event) => {
    const eventType = event.requestContext.eventType;
    const connectionId = event.requestContext.connectionId;
    try {
        if (eventType === CONNECT) {
            await addConnection(String(event.queryStringParameters.lobbyId), connectionId);
            return success(CONNECT);
        } else if (eventType === DISCONNECT) {
            // Note: the disconnect event will not have the lobbyId, so must retrieve it.
            const lobbyId = await getLobbyId(connectionId);
            await deleteConnection(lobbyId, connectionId);
            return success(DISCONNECT);
        }
    } catch (err) {
        return error(err);
    }
};

// Default response if message sent without a defined action type
const defaultMessage = async (event) => {
    console.log(JSON.stringify(event,null,2));
    return success("invalid action type");
}

// {"action": "sendMessage", "name": "Greg", "data": "hello there!"}
// Sends a message to the other connections
const sendMessage = async (event) => {
    const senderConnectionId = event.requestContext.connectionId;
    const message = JSON.parse(event.body);
    const lobbyId = String(message.lobbyId);
    const data = message.data;

    try {
        const connections = await getConnections(lobbyId);
        const postCalls = connections.map(async (connectionId) => {
            try {
                if (connectionId !== senderConnectionId) await send(connectionId, data);
                return;
            } catch (err) {
                if (err.statusCode === 410) return await deleteConnection(connectionId);
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

const getConnections = async (lobbyId) => {
    const params = {
        TableName: LOBBIES_TABLE,
        Key: { lobbyId: lobbyId },
        ProjectionExpression: 'Connections'
    };
    const result = await DDB.get(params).promise();
    return result.Item.Connections.values;
};

const getLobbyId = async (connectionId) => {
    const params = {
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId: connectionId },
        ProjectionExpression: 'lobbyId'
    };
    const result = await DDB.get(params).promise();
    return result.Item.lobbyId;
};

const addConnection =  async (lobbyId, connectionId) => {
    const params = {
        TableName: CONNECTIONS_TABLE,
        Item: {
            connectionId: connectionId,
            lobbyId: lobbyId
        },
    };
    await DDB.put(params).promise();

    const params2 = {
        TableName: LOBBIES_TABLE,
        Key: { lobbyId: lobbyId },
        UpdateExpression: "ADD #a :vals",
        ExpressionAttributeNames: {'#a' : 'Connections'},
        ExpressionAttributeValues: { ":vals": DDB.createSet([ connectionId ]) },
        ReturnValues: "UPDATED_NEW"
    };
    return await DDB.update(params2).promise();
};

const deleteConnection =  async (lobbyId, connectionId) => {
    const params = {
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId: connectionId }
    };

    await DDB.delete(params).promise();

    const params2 = {
        TableName: LOBBIES_TABLE,
        Key: { lobbyId: lobbyId },
        UpdateExpression: "DELETE #a :vals",
        ExpressionAttributeNames: {'#a' : 'Connections'},
        ExpressionAttributeValues: { ":vals": DDB.createSet([ connectionId ]) },
        ReturnValues: "UPDATED_NEW"
    };
    return await DDB.update(params2).promise();
};

module.exports = {
    connectionManager,
    defaultMessage,
    sendMessage,
    addConnection,
    deleteConnection
};

/*
When a game is setup in a lobby, create a set containing the originator's connectionId:
var params = {
  TableName : LOBBIES_TABLE,
  Key: { lobbyId: lobbyId },
  UpdateExpression: "set Connections= :vals",
  ExpressionAttributeValues: { ":vals": DDB.createSet([ connectionId ]) }
};*/
