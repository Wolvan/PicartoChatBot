var api;

function newMessage(data) {
    handleMessage(data, false);
}
function newWhisper(data) {
    handleMessage(data, true);
}

function parsePermLevel(str) {
    lvl = 0;
    lvls = str.split(',').filter(function (v, i, s) {
        return s.indexOf(v) === i;
    });
    for (var i = 0; i < lvls.length; ++i) {
        switch (lvls[i]) {
            case "user":
            case "users":
                lvl += api.permissions_manager.PERMISSION_USER;
                break;
            case "mod":
            case "mods":
                lvl += api.permissions_manager.PERMISSION_MOD;
                break;
            case "admin":
            case "admins":
                lvl += api.permissions_manager.PERMISSION_ADMIN;
                break;
            case "padmin":
            case "padmins":
                lvl += api.permissions_manager.PERMISSION_PTVADMIN;
                break;
        }
    }
    return lvl;
}

function handleMessage(data, whisper) {
    if (data.msg.toLowerCase().startsWith("!")) {
        var pars = data.msg.split(' ');
        var cmd = pars[0].toLowerCase();
        if (cmd === '!perm') {
            if (api.permissions_manager.userHasPermission(data, "cmd.perm") || api.permissions_manager.isOwner(data)) {
                if (pars.length === 4) {
                    switch (pars[2]) {
                        case 'add':
                            api.permissions_manager.addPermissionLevel(data.channel, pars[1], parsePermLevel(pars[3]));
                            sendMessage("Added " + pars[3] + " to " + pars[1], whisper ? data.username : undefined, data.channel);
                            break;
                        case 'del':
                        case 'rem':
                        case 'delete':
                        case 'remove':
                            api.permissions_manager.removePermissionLevel(data.channel, pars[1], parsePermLevel(pars[3]));
                            sendMessage("Removed " + pars[3] + " from " + pars[1], whisper ? data.username : undefined, data.channel);
                            break;
                        case 'whitelist':
                            pars[3].split(',').forEach(function (un) {
                                api.permissions_manager.whitelistUser(data.channel, pars[1], un);
                            });
                            sendMessage("Whitelisted " + pars[3] + " for " + pars[1], whisper ? data.username : undefined, data.channel);
                            break;
                        case 'unwhitelist':
                            pars[3].split(',').forEach(function (un) {
                                api.permissions_manager.unwhitelistUser(data.channel, pars[1], un);
                            });
                            sendMessage("Unwhitelisted " + pars[3] + " for " + pars[1], whisper ? data.username : undefined, data.channel);
                            break;
                        case 'blacklist':
                            pars[3].split(',').forEach(function (un) {
                                api.permissions_manager.blacklistUser(data.channel, pars[1], un);
                            });
                            sendMessage("Blacklisted " + pars[3] + " for " + pars[1], whisper ? data.username : undefined, data.channel);
                            break;
                        case 'unblacklist':
                            pars[3].split(',').forEach(function (un) {
                                api.permissions_manager.unblacklistUser(data.channel, pars[1], un);
                            });
                            sendMessage("Unblacklisted " + pars[3] + " for " + pars[1], whisper ? data.username : undefined, data.channel);
                            break;
                    }
                } else {
                    sendMessage("Usage: !perm <permId> <add|del> <permLevel>  |  !perm <permId> <(un)whitelist|(un)blacklist> <username>  ", data.username, data.channel);
                }
            } else {
                sendMessage("Sorry, you don't have permission to use this command.", data.username, data.channel);
            }
        }
    }
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
        name: "Permissions Manager",
        version: "1.0.0",
        description: "Manages Permissions",
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