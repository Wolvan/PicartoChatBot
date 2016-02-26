var api;

function newMessage(data) {
    handleMessage(data, false);
}
function newWhisper(data) {
    handleMessage(data, true);
}

function handleMessage(data, whisper) {
    if (data.msg.toLowerCase().startsWith("!")) {
        var pars = data.msg.split(' ');
        var cmd = pars[0].toLowerCase();

        if (cmd === '!settimeout') {
            if (api.permissions_manager.userHasPermission(data, "cmd.settimeout") || api.permissions_manager.isOwner(data)) {
                if (pars.length === 3 && isInt(pars[2])) {
                    api.timeout_manager.setTimeout(data.channel, pars[1], parseInt(pars[2]));
                    sendMessage("Set timeout " + pars[1] + " to " + pars[2], data.username, data.channel);
                } else {
                    sendMessage("Usage: !settimeout <timeoutId> <timeoutMs>", data.username, data.channel);
                }
            } else {
                sendMessage("Sorry, you don't have permission to use this command.", data.username, data.channel);
            }
        }
        if (cmd === '!resettimeout') {
            if (api.permissions_manager.userHasPermission(data, "cmd.resettimeout") || api.permissions_manager.isOwner(data)) {
                if (pars.length === 2) {
                    api.timeout_manager.clearTimeout(data.channel, pars[1]);
                    sendMessage("Cleared timeout " + pars[1], data.username, data.channel);
                } else {
                    sendMessage("Usage: !settimeout <timeoutId>", data.username, data.channel);
                }
            } else {
                sendMessage("Sorry, you don't have permission to use this command.", data.username, data.channel);
            }
        }
    }
}

function isInt(value) {
    return !isNaN(value) && (function (x) {
        return (x | 0) === x;
    })(parseFloat(value));
}

function sendMessage(txt, whisperUser, channel) {
    if (typeof whisperUser !== 'undefined') {
        api.Messages.whisper(whisperUser, txt, channel);
    } else {
        api.Messages.send(txt, channel);
    }
}

module.exports = {
    meta_inf: {
        name: "Timeout Manager",
        version: "1.0.0",
        description: "Manages Timeouts",
        author: "Tschrock (CyberPon3)"
    },
    load: function (_api) {
        api = _api;
    },
    start: function () {
        api.Events.on("userMsg", newMessage);
        api.Events.on("whisper", newWhisper);
    },
    stop: function () {
        api.Events.removeListener("userMsg", newMessage);
        api.Events.removeListener("whisper", newWhisper);
    }
}