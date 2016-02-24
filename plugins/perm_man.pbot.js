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
        if (cmd === '!perm' && pars.length === 4) {
            if (api.permissions_manager.userHasPermission(data, "cmd.perm") || api.permissions_manager.isOwner(data)) {
                switch (pars[2]) {
                    case 'add':
                        console.log(api.permissions_manager.__permsLocalStore);
                        api.permissions_manager.addPermissionLevel(pars[1], parsePermLevel(pars[3]));
                        console.log(api.permissions_manager.__permsLocalStore);
                        console.log(pars[1]);
                        console.log(parsePermLevel(pars[3]));
                        sendMessage("Added " + pars[3] + " to " + pars[1], whisper ? data.username : undefined);
                        break;
                    case 'del':
                    case 'rem':
                    case 'delete':
                    case 'remove':
                        api.permissions_manager.removePermissionLevel(pars[1], parsePermLevel(pars[3]));
                        sendMessage("Removed " + pars[3] + " from " + pars[1], whisper ? data.username : undefined);
                        break;
                    case 'whitelist':
                        pars[3].split(',').forEach(function (un) {
                            api.permissions_manager.whitelistUser(pars[1], un);
                        });
                        sendMessage("Whitelisted " + pars[3] + " for " + pars[1], whisper ? data.username : undefined);
                        break;
                    case 'unwhitelist':
                        pars[3].split(',').forEach(function (un) {
                            api.permissions_manager.unwhitelistUser(pars[1], un);
                        });
                        sendMessage("Unwhitelisted " + pars[3] + " for " + pars[1], whisper ? data.username : undefined);
                        break;
                    case 'blacklist':
                        pars[3].split(',').forEach(function (un) {
                            api.permissions_manager.blacklistUser(pars[1], un);
                        });
                        sendMessage("Blacklisted " + pars[3] + " for " + pars[1], whisper ? data.username : undefined);
                        break;
                    case 'unblacklist':
                        pars[3].split(',').forEach(function (un) {
                            api.permissions_manager.unblacklistUser(pars[1], un);
                        });
                        sendMessage("Unblacklisted " + pars[3] + " for " + pars[1], whisper ? data.username : undefined);
                        break;
                }
            }
            else {
                sendMessage("Sorry, you don't have permission to use this command.", data.username);
            }
        }
    }
}

function sendMessage(txt, whisperUser) {
    if (typeof whisperUser !== 'undefined') {
        api.Messages.whisper(whisperUser, txt);
    } else {
        api.Messages.send(txt);
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