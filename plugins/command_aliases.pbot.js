var api;
var storage;

function handleMessage(data) {
    if (data.msg.startsWith("!")) {
        var pars = data.msg.split(' ');
        var cmd = pars[0].toLowerCase();

        var commands = storage.getItem("commands") || {};

        if (cmd === '!addalias' || cmd === '!setalias') {
            if (api.permissions_manager.userHasPermission(data, "cmd.addalias") || api.permissions_manager.isOwner(data)) {
                if (pars.length > 2) {
                    commands[pars[1].toLowerCase().replace(/^!/, '')] = pars.slice(2).join(' ');
                    storage.setItem("commands", commands);
                    sendMessage(data, "Added '!" + pars[1].toLowerCase().replace(/^!/, '') + "' command.", true);
                } else {
                    sendMessage(data, "Usage: !addalias <command> <cmdmessage...>", true);
                }
            } else {
                sendMessage(data, "Sorry, you don't have permission to use this command.", true);
            }

        } else if (cmd === '!delalias') {
            if (api.permissions_manager.userHasPermission(data, "cmd.delalias") || api.permissions_manager.isOwner(data)) {
                if (pars.length > 1) {
                    delete commands[pars[1].toLowerCase().replace(/^!/, '')];
                    storage.setItem("commands", commands);
                    sendMessage(data, "Removed '!" + pars[1].toLowerCase().replace(/^!/, '') + "' command.", true);
                } else {
                    sendMessage(data, "Usage: !delalias <command>", true);
                }
            } else {
                sendMessage(data, "Sorry, you don't have permission to use this command.", true);
            }

        } else if (cmd === '!lsalias') {
            if (api.permissions_manager.userHasPermission(data, "cmd.lsalias") || api.permissions_manager.isOwner(data)) {
                var resp = "Saved Aliases:\n  |  ";
                for (var msg in commands) {
                    resp += "!" + msg + " - " + commands[msg].substr(0, 20) + (commands[msg].length > 20 ? "..." : "") + "\n  |  ";
                }
                sendMessage(data, resp, data.whisper);
            } else {
                sendMessage(data, "Sorry, you don't have permission to use this command.", true);
            }

        } else if (typeof commands[cmd.replace(/^!/, '')] !== 'undefined') {
            msgcmd = cmd.replace(/^!/, '');
            if (api.timeout_manager.checkTimeout("cmd." + msgcmd, 20000) || api.permissions_manager.userHasPermission(data, "timeoutbypass.global") || api.permissions_manager.userHasPermission(data, "timeoutbypass.cmd." + msgcmd)) {
                if (api.permissions_manager.userHasPermission(data, "cmd." + msgcmd) || api.permissions_manager.isOwner(data)) {
                    var newData = api.user_manager.mergeUserData({}, data);
                    newData.msg = commands[cmd.replace(/^!/, '')].replace('$args', pars.slice(1).join(' '));
                    newData.id += '_';
                    newData.fromAlias = true;
                    api.Events.emit(data.whisper ? "whisper" : "userMsg", newData);
                } else {
                    sendMessage(data, "Sorry, you don't have permission to use this command.", true);
                }
            } else {
                sendMessage(data, "Too soon, wait another " + api.timeout_manager.getTimeRemaining("cmd." + msgcmd) / 1000 + " sec. and try again (or whisper me).", true);
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
        name: "Command Aliases",
        version: "1.0.0",
        description: "Allows to create command aliases",
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