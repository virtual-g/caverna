"use strict";

const success = (body) => {
    return {
        statusCode: 200,
        body: body
    };
};

const error = (body) => {
    console.log(body);
    return {
        statusCode: 500,
        body: JSON.stringify(body)
    };
};

module.exports = {
    success,
    error
};
