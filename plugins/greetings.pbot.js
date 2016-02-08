var api;
function handleMsg(data, checkWhitelist) {
    var whitelisted = [
        api.channel
    ];
    if (checkWhitelist) { if (whitelisted.indexOf(data.username) === -1) return; }
    if (data.msg.toLowerCase().indexOf("say goodnight") !== -1) {
        api.Messages.send("Goodnight!");
    } else if (data.msg.toLowerCase().indexOf("say goodbye") !== -1) {
        api.Messages.send("Goodbye!");
    } else if (data.msg.toLowerCase().indexOf("say hello") !== -1) {
        api.Messages.send("Hello!");
    }
}
module.exports = {
    meta_inf: {
        name: "Greetings & Goodbyes",
        version: "1.0.0",
        description: "Greets or says goodbye to people on command",
        author: "Wolvan"
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
