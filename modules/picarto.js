'use strict';

var serverAddr = "wss://nd2.picarto.tv/";

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
	Timer: 34,
	MonitorData: 35,
	ChatLevel: 36
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
	34: "Timer",
	35: "MonitorData",
	36: "ChatLevel"
};

var request = require("request");
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
	return stream;
}

function getToken(stream, cookieJar) {
	var cookieJar = cookieJar || request.jar();
	return new Promise(function (resolve, reject) {
		request({
			uri: "https://picarto.tv/" + getChannel(stream),
			jar: cookieJar,
			headers: {'Referer': 'https://www.picarto.tv/'}
		}, function (error, response, body) {

			if (error) {
				reject(error);
				return;
			}

			if (!response || (response.statusCode !== 200 && response.statusCode !== 302)) {
				reject(new Error('Unexpected status code while fetching auth token: ' + response.statusCode));
				return;
			}

			var authToken = getTokenFromHTML(body);
			if (!authToken) {
				reject( new Error('Error parsing auth token'));
			} else {
				resolve(authToken);
			}
		});
	});
}

function getAuthedCookieJar(username, password) {
	var cookieJar = request.jar();
	return new Promise(function (resolve, reject) {
		request({
			uri: 'https://picarto.tv/process/login',
			method: 'POST',
			form: {username: username, password: password, staylogged: true},
			jar: cookieJar,
			headers: {'Referer': 'https://www.picarto.tv/'}
		}, function (error, response, body) {
			
			if (error) {
				reject(error);
				return;
			}

			if (!response || (response.statusCode !== 200 && response.statusCode !== 302)) {
				reject(new Error('Unexpected status code while logging in: ' + response.statusCode));
				return;
			}
			
			var loginResult;
			try {
				loginResult = JSON.parse(body);
			}
			catch(e) {
				
				reject(new Error('Error parsing login response: ' + body));
				return;
			}
			
			if (loginResult.loginstatus) {
				resolve(cookieJar);
			} else {
				reject(new Error('Invalid username or password'));
			}
		});
	});
}

function getAuthedToken(stream, username, password) {
	return getAuthedCookieJar(username, password).then(function (cookieJar) {
		return getToken(stream, cookieJar);
	});
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
	
	picarto.sendSignal = function (signalname, data) {
		if (!picarto.state.Connected) return;

		var signalID = TypeDataMapping[signalname];
		if (!signalID) return;

		var protobuf = new picarto.protocol[signalname](data || {});
		var rawData = protobuf.toBuffer();
		var binaryData = new Uint8Array(rawData.length + 1);
		binaryData[0] = signalID;
		binaryData.set(rawData, 1);

		picarto.WebSocket.send(binaryData.buffer);
	}

	picarto.connect = function() {
		if (picarto.state.Connected || picarto.state.Connecting || picarto.state.Reconnecting) return;
		
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
	picarto.disconnect = function () {
		picarto.options.preventReconnect = true;
		
		if (picarto.state.Reconnecting) {
			clearTimeout(picarto.reconnectTimer);
			picarto.state.Reconnecting = false;
		} else if (picarto.state.Connecting || picarto.state.Connected) {
			picarto.state.Reconnecting = false;
			picarto.WebSocket.close();
		}
	}
}

module.exports = picarto_connection;
module.exports.getTokenFromHTML = getTokenFromHTML;
module.exports.getChannel = getChannel;
module.exports.getToken = getToken;
module.exports.getAuthedCookieJar = getAuthedCookieJar;
module.exports.getAuthedToken = getAuthedToken;
module.exports.protocol = ProtoBufJS.loadProtoFile("./resources/picarto_protocol.proto").build();
module.exports.DataTypeMapping = DataTypeMapping;
module.exports.TypeDataMapping = TypeDataMapping;
