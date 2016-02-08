var api;

function userMsg (data) {
    console.log(data.username + ": " + data.msg);
}
function whisper (data) {
    console.log(data.username + " whispered: " + data.msg);
}

module.exports = {
    meta_inf: {
        name: "Message Output",
        version: "1.0.0",
        description: "Read the chat from the bot console.",
        author: "Wolvan"
    },
    load: function (_api) {
        api = _api;
    },
    start: function () {
        api.Events.on("userMsg", userMsg);
        api.Events.on("whisper", whisper);
    },
    stop: function () {
        api.Events.removeListener("userMsg", userMsg);
        api.Events.removeListener("whisper", whisper);
    }
}
