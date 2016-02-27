var api;
var storage;

function handleMessage(data) {
    if (data.msg.startsWith("!")) {
        var pars = data.msg.split(' ');
        var cmd = pars[0].toLowerCase();

        var messages = storage.getItem("messages_" + data.channel) || {};

        if (cmd === '!addcmd' || cmd === '!setcmd') {
            if (api.permissions_manager.userHasPermission(data, "cmd.addcmd") || api.permissions_manager.isOwner(data)) {
                if (pars.length > 2) {
                    messages[pars[1].toLowerCase().replace(/^!/, '')] = pars.slice(2).join(' ');
                    storage.setItem("messages_" + data.channel, messages);
                } else {
                    sendMessage(data, "Usage: !addcmd <command> <message...>", true);
                }
            } else {
                sendMessage(data, "Sorry, you don't have permission to use this command.", true);
            }

        } else if (cmd === '!delcmd') {
            if (api.permissions_manager.userHasPermission(data, "cmd.delcmd") || api.permissions_manager.isOwner(data)) {
                if (pars.length > 1) {
                    delete messages[pars[1].toLowerCase().replace(/^!/, '')];
                    storage.setItem("messages_" + data.channel, messages);
                } else {
                    sendMessage(data, "Usage: !delcmd <command>", true);
                }
            } else {
                sendMessage(data, "Sorry, you don't have permission to use this command.", true);
            }

        } else if (cmd === '!lscmd') {
            if (api.permissions_manager.userHasPermission(data, "cmd.lscmd") || api.permissions_manager.isOwner(data)) {
                var resp = "Saved Messages:\n  |  ";
                for (var msg in messages) {
                    resp += "!" + msg + " - " + messages[msg].substr(0, 20) + (messages[msg].length > 20 ? "..." : "") + "\n  |  ";
                }
                sendMessage(data, resp, data.whisper);
            } else {
                sendMessage(data, "Sorry, you don't have permission to use this command.", true);
            }

        } else if (typeof messages[cmd.replace(/^!/, '')] !== 'undefined') {
            msgcmd = cmd.replace(/^!/, '');
            if (data.whisper || api.timeout_manager.checkTimeout(data.channel, "cmd." + msgcmd, 20000) || api.permissions_manager.userHasPermission(data, "timeoutbypass.global") || api.permissions_manager.userHasPermission(data, "timeoutbypass.cmd." + msgcmd)) {
                if (api.permissions_manager.userHasPermission(data, "cmd." + msgcmd) || api.permissions_manager.isOwner(data)) {
                    sendMessage(data, messages[cmd.replace(/^!/, '')], data.whisper);
                } else {
                    sendMessage(data, "Sorry, you don't have permission to use this command.", true);
                }
            } else {
                sendMessage(data, "Too soon, wait another " + api.timeout_manager.getTimeRemaining(data.channel, "cmd." + msgcmd) / 1000 + " sec. and try again (or whisper me).", true);
            }
        }
    }
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
        name: "Custom Commands",
        version: "1.0.0",
        description: "Create commands to say premade messages.",
        author: "Tschrock (CyberPon3)"
    },
    load: function (_api, _storage) {
        api = _api;
        storage = _storage;
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