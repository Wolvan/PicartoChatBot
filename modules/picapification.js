"use strict";

var EventEmitter2 = require("eventemitter2").EventEmitter2;
var defaultEE2Options = {
	wildcard: true,
	newListener: false,
	maxListeners: 0
};

/**
 * @constructor
 * @param {picarto} picarto_connector An instance of a picarto 
 */
module.exports = function (picarto_connector) {
	var protocol = picarto_connector.protocol;
	var sendSignal = picarto_connector.sendSignal;
	var Events = picarto_connector.Events;
	
	var api = {};
	
	// Event Emitter that transmits transformed Events to plugins
	api.Events = new EventEmitter2(defaultEE2Options);
	
	/**
	 * @param {string} hexstring Hexadecimal Color string (eg. #FF00FF)
	*/
	api.setColor = function(hexstring) {
		var color = hexstring;
		if (color.charAt(0) === "#") color = color.substring(1);
		sendSignal("Color", {
			color: color
		});
	}
	/**
	 * @param {string} name The name for this connection
	*/
	api.setName = function(name) {
		this.sendSignal("SetName", {
			name: name
		});
	}
	
	/**
	 * @param {string} message The message to send
	*/
	api.sendMessage = function(message) {
		sendSignal("NewMessage", {
			message: message
		});
	}
	/**
	 * @param {string} username The user to receive the message
	 * @param {string} message The message to send
	*/
	api.whisper = function(username, message) {
		// TODO: Fix this. Somehow. Probably ask how whispers are sent exactly
	}
	api.Messages = {
		send: api.sendMessage
		whisper: api.whisper
	}
	
	api.Ignore = {
			/**
			 * @param {string} name The user that should be ignored
			*/
		add: function(name) {
			sendSignal("ModifyIgnores", {
				ignore_name: name,
				is_adding: true
			});
		},
		/**
		 * @param {string} name The user that should be unignored
		*/
		remove: function(name) {
			sendSignal("ModifyIgnores", {
				ignore_name: name,
				is_adding: false
			});
		}
	}
	
	/**
	 * @param {Array<string>} names The usernames that should be in the raffle
	*/
	api.initRaffle = function(names) {
		sendSignal("RaffleInit", {
			names: names
		});
	}
	
	api.Polls = {
		/**
		 * @param {string} question The poll's question
		 * @param {Array<string>} answers The possible answers for the poll
		*/
		init: function(question, answers) {
			sendSignal("PollInit", {
				question: question,
				options: answers,
				host_id: 0, // TODO: FIX THIS
				host_display_name: "null" // TODO: FIX THIS
			});
		},
		/**
		 * @param {int} option The ID of the answer that should be voted for
		*/
		vote: function(option) {
			sendSignal("PollVote", {
				option: option
			});
		},
		/**
		 * End the currently running poll.
		*/
		end: function() {
			sendSignal("PollEnd");
		}
	}
	
	// TODO: Hook Events, transform them and then hand them over to the API's event emitter
	
	return api;
}