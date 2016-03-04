var api;

function handleMessage(data) {
    if (data.msg.toLowerCase().startsWith("!")) {
        var pars = data.msg.split(' ');
        var cmd = pars[0].toLowerCase();

        if (cmd === '!settimeout') {
            if (api.permissions_manager.userHasPermission(data, "cmd.settimeout") || api.permissions_manager.isOwner(data)) {
                if (pars.length === 3 && isInt(pars[2])) {
                    console.log(pars);
                    api.timeout_manager.setTimeout(data.channel, pars[1], parseInt(pars[2]));
                    sendMessage(data, "Set timeout " + pars[1] + " to " + pars[2], true);
                } else {
                    sendMessage(data, "Usage: !settimeout <timeoutId> <timeoutMs>", true);
                }
            } else {
                sendMessage(data, "Sorry, you don't have permission to use this command.", true);
            }
        }
        if (cmd === '!resettimeout') {
            if (api.permissions_manager.userHasPermission(data, "cmd.resettimeout") || api.permissions_manager.isOwner(data)) {
                if (pars.length === 2) {
                    api.timeout_manager.clearTimeout(data.channel, pars[1]);
                    sendMessage(data, "Cleared timeout " + pars[1], true);
                } else {
                    sendMessage(data, "Usage: !settimeout <timeoutId>", true);
                }
            } else {
                sendMessage(data, "Sorry, you don't have permission to use this command.", true);
            }
        }
    }
}

function isInt(value) {
    return !isNaN(value) && (function (x) {
        return (x | 0) === x;
    })(parseFloat(value));
}

function sendMessage(uData, txt, whisper) {
    if (typeof whisper !== 'undefined' && whisper) {
        api.Messages.whisper(uData.username, txt, uData.channel);
    } else {
        api.Messages.send(txt, uData.channel);
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
        api.Events.on("userMsg", handleMessage);
        api.Events.on("whisper", handleMessage);
    },
    stop: function () {
        api.Events.removeListener("userMsg", handleMessage);
        api.Events.removeListener("whisper", handleMessage);
    }
}