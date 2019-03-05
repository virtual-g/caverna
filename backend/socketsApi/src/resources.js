module.exports = Object.freeze({
    // Environment Variables
    ENDPOINT: process.env.ENDPOINT,
    CONNECTIONS_TABLE: process.env.CONNECTIONS_TABLE,
    TABLES_TABLE: process.env.TABLES_TABLE,
    GAMES_TABLE: process.env.GAMES_TABLE,
    // Dynamo Table Columns
    TABLE_ID : "tableId",
    CONNECTIONS_COLUMN: "connections",
    NAMES_COLUMN: "names",
    STATUS_COLUMN: "status",
    // Strings
    CONNECT: "CONNECT",
    DISCONNECT: "DISCONNECT",
    STARTED: 'STARTED',
    OPEN: 'OPEN'
});
