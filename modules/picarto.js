'use strict';

var serverAddr = "http://pika.tech/";

var TypeDataMapping = {
    AdminControl: 0,
    Ban: 1,
    ChatMessage: 2,
    ClearHistory: 3,
    ClearUserMessages: 4,
    Color: 5,
    CommandHelp: 6,
    Control: 7,
    GlobalMessage: 8,
    IgnoresUpdated: 9,
    Kick: 10,
    Mod: 11,
    ModList: 12,
    ModifyIgnores: 13,
    Multistream: 14,
    NewMessage: 15,
    OnlineState: 16,
    PollInit: 17,
    PollResult: 18,
    PollUpdate: 19,
    PollVote: 20,
    PollVoteResponse: 21,
    RaffleInit: 22,
    RaffleRun: 23,
    RemoveMessage: 24,
    ServerMessage: 25,
    UnBan: 26,
    UserList: 27,
    Whisper: 28,
    SetName: 29,
    NameConfirmation: 30,
    ModTools: 31,
    PollEnd: 32,
    Reminder: 33,
    Timer: 34
};

var DataTypeMapping = {
    0: 'AdminControl',
    1: 'Ban',
    2: 'ChatMessage',
    3: 'ClearHistory',
    4: 'ClearUserMessages',
    5: 'Color',
    6: 'CommandHelp',
    7: 'Control',
    8: 'GlobalMessage',
    9: 'IgnoresUpdated',
    10: 'Kick',
    11: 'Mod',
    12: 'ModList',
    13: 'ModifyIgnores',
    14: 'Multistream',
    15: 'NewMessage',
    16: 'OnlineState',
    17: 'PollInit',
    18: 'PollResult',
    19: 'PollUpdate',
    20: 'PollVote',
    21: 'PollVoteResponse',
    22: 'RaffleInit',
    23: 'RaffleRun',
    24: 'RemoveMessage',
    25: 'ServerMessage',
    26: 'UnBan',
    27: 'UserList',
    28: 'Whisper',
    29: 'SetName',
    30: 'NameConfirmation',
    31: 'ModTools',
    32: 'PollEnd',
    33: 'Reminder',
    34: 'Timer'
};

var jsdom = require("jsdom");
var Promise = require("bluebird");
var ProtoBufJS = require("protobufjs");
var ws = require("ws");
var EventEmitter2 = require("eventemitter2").EventEmitter2;
var defaultEE2Options = {
    wildcard: true,
    newListener: false,
    maxListeners: 0
};

function getTokenFromHTML(body) {
    var func = body.match(/initChatVariables(.*);/)[0];
    var getLastApostrophe = func.lastIndexOf("'");
    var token = func.substring(func.lastIndexOf("'", getLastApostrophe - 1) + 1, getLastApostrophe);
    return token;
}

function getChannel(stream) {
    if (stream.indexOf("picarto.tv") !== -1) {
        stream = stream.substring(stream.lastIndexOf("/") + 1);
    }
    return stream
}

function getToken(stream) {
    return new Promise(function (resolve, reject) {
        jsdom.env({
            url: "https://picarto.tv/" + getChannel(stream),
            features: {
                FetchExternalResources: ["script"],
                ProcessExternalResources: ["script"]
            },
            done: function (error, window) {
                if (error) { console.log(error); reject("jsdom error"); }
                try {
                    var $ = window.$;
                    resolve({
                        token: getTokenFromHTML($("body").html()), 
                        readOnly: true
                    });
                } catch (e) {
                    reject("channelDoesNotExist");
                }
            }
        });
    })
}

function picarto_connection(_token, _debug) {
    var picarto = this;
    picarto.protobuilder = ProtoBufJS.loadProtoFile("./resources/picarto_protocol.proto");
    picarto.protocol = picarto.protobuilder.build();
    picarto.Events = new EventEmitter2(defaultEE2Options);
    picarto.WebSocket = null;
    picarto.state = {
        Reconnecting: false,
        Connecting: false,
        Connected: false
    };
    picarto.options = {
        preventReconnect: false,
        reconnectTimeout: 5,
        token: encodeURIComponent(_token),
        srvAdr: serverAddr,
        debug: _debug
    };
    picarto.Events.onAny(function dbg(event, data) {
        if (picarto.options.debug) {
            console.log("PicartoDebug: %s %s", event, JSON.stringify(data) || "null");
        }
    });
    picarto.chat_state = {
        users: [],
        canTalk: false
    };
}

picarto_connection.prototype.connect = function() {
    if (this.state.Connected || this.state.Connecting || this.state.Reconnecting) return;
    var picarto = this;
    
    var WS = new ws(picarto.options.srvAdr + "socket?token=" + picarto.options.token);
    picarto.WebSocket = WS;
    WS.binaryType = "arraybuffer";
    picarto.state.Connecting = true;

    WS.on("open", function () {
        var Event = picarto.state.Reconnecting ? "reconnected" : "connected";
        
        picarto.state.Reconnecting = false;
        picarto.state.Connecting = false;
        picarto.state.Connected = true;
        
        picarto.Events.emit(Event);
    });
    WS.on("close", function (code, message) {
        if (picarto.state.Reconnecting) return;
        
        picarto.state.Connected = false;
        picarto.state.Connecting = false;
        
        if (picarto.options.preventReconnect) {
            picarto.state.Reconnecting = false;
            picarto.Events.emit("disconnected", { reason: message, code: code });
        } else {
            picarto.Events.emit("socketClosed", new Error("Unexpected Socket close"));
            picarto.state.Reconnecting = true;
            picarto.reconnectTimer = setTimeout(function () {
                picarto.state.Reconnecting = false;
                picarto.connect();
            }, picarto.options.reconnectTimeout * 1000);
        }
    });
    WS.on("error", function () {
        if (picarto.options.preventReconnect) {
            picarto.options.preventReconnect = false;
            return;
        }
        
        picarto.Events.emit("error", new Error("Websocket Error"));
        
        picarto.state.Connecting = false;
        picarto.state.Connected = false;
        picarto.state.Reconnecting = true;
        
        picarto.reconnectTimer = setTimeout(function () {
            picarto.state.Reconnecting = false;
            picarto.connect();
        }, picarto.options.reconnectTimeout * 1000);
    });
    WS.on("message", function (evt) {
        var data = new Uint8Array(evt);
        var signalName = DataTypeMapping[data[0]];
        if (!signalName) return;

        var output = picarto.protocol[signalName].decode(data.slice(1));
        
        if (signalName == "Control") {
            switch (output.messageType) {
                case picarto.protocol.Control.MessageType.KICK:
                    picarto.options.preventReconnect = true;
                    break;
                case picarto.protocol.Control.MessageType.CAN_TALK:
                    picarto.chat_state.canTalk = output.data_bool;
                    break;
            }
        } else if (signalName == "UserList") {
            picarto.chat_state.users = output.user;
        }
        
        picarto.Events.emit(signalName, output);
    });
}

picarto_connection.prototype.disconnect = function () {
    this.options.preventReconnect = true;
    
    if (this.state.Reconnecting) {
        clearTimeout(this.reconnectTimer);
        this.state.Reconnecting = false;
    } else if (this.state.Connecting || this.state.Connected) {
        this.state.Reconnecting = false;
        this.WebSocket.close();
    }
}

picarto_connection.prototype.sendData = function (signalname, data) {
    if (!this.state.Connected) return;

    var signalID = TypeDataMapping[signalname];
    if (!signalID) return;

    var rawData = data.toBuffer();
    var binaryData = new Uint8Array(rawData.length + 1);
    binaryData[0] = signalID;
    binaryData.set(rawData, 1);

    this.WebSocket.send(binaryData.buffer);
}

picarto_connection.prototype.sendMessage = function (message) {
    this.sendData("NewMessage", new con.protocol["NewMessage"]({
        message: message
    }));
}

picarto_connection.prototype.setName = function (name) {
    this.sendData("SetName", new con.protocol["SetName"]({
        name: name
    }));
}

picarto_connection.prototype.setColor = function (hexstring) {
    var color = hexstring;
    if (color.charAt(0) === "#") color = color.substring(1);
    this.sendData("Color", new con.protocol["Color"]({
        color: color
    }));
}

module.exports = picarto_connection;
module.exports.getTokenFromHTML = getTokenFromHTML;
module.exports.getChannel = getChannel;
module.exports.getToken = getToken;
module.exports.protocol = ProtoBufJS.loadProtoFile("./resources/picarto_protocol.proto").build();
module.exports.DataTypeMapping = DataTypeMapping;
module.exports.TypeDataMapping = TypeDataMapping;
