var api;
function handleMsg(data) {
    if (data.msg.toLowerCase().startsWith("!")) {
        var pars = data.msg.split(' ');
        var cmd = pars[0].toLowerCase();
        
        if(api.permissions_manager.userHasPermission(data, "cmd.perm") || api.permissions_manager.isOwner(data)){
            if (cmd === '!mute') {
                api.Messages.send("Bye...",data.channel);
                api.mute_manager.mute(data.channel);
                console.log(data.channel + " has been muted by " + data.username);
            } else if(cmd === '!unmute') {
                api.mute_manager.unmute(data.channel);
                console.log(data.channel + " has been unmuted by " + data.username);
                api.Messages.send("I'm back!",data.channel);
            }
        }
    }
}
module.exports = {
    meta_inf: {
        name: "Mute",
        version: "1.0.0",
        description: "Allows Streamers and Global Admins to mute the bot",
        author: "Amm"
    },
    load: function (_api) {
        api = _api;
    },
    start: function () {
        api.Events.on("userMsg", handleMsg);
    },
    stop: function () {
        api.Events.removeListener("userMsg", handleMsg);
    }
}
