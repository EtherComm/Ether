const { addArgs, removeArgs } = require("./utils/functions");
const manifest = require("./settings/manifest.json");

const express = require("express");
const app = express();
const { WebSocketServer } = require("ws");
const Logger = require("./utils/Logger");
const IrisLogger = new Logger();

let arguments;
let args = [arguments].forEach(x => x);

app.listen(manifest.schema.server.config.port, () => {
    IrisLogger.Debug.DEBUG(`Listening on Port ${manifest.schema.server.config.port}`);
}); 

const ws = new WebSocketServer({
    port: process.env.WS || manifest.schema.server.config.ws
}, IrisLogger.Debug.DEBUG(`Listening on Port ${manifest.schema.server.config.ws}`)); 

ws.on("connection", client => {
    client.on("message", (message, binary) => {
        [...ws.clients]
            .filter(c => c !== client)
            .forEach(c => c.send(binary ? message.toString() : message));
    });
})

if (args === arguments) {
    return addArgs(args);
} else {
    return removeArgs(args);
};