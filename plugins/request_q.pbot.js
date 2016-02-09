var api;
var storage;

function addRequestToQEvent(request) {
    var requests = storage.getItem("requests") || [];
    requests.push(request);
    storage.setItem("requests", requests);
    api.Messages.send("Added request '" + request + "'");
}
function handleMsg(data) {
    if (data.msg.toLowerCase().startsWith("!request")) {
        var args = data.msg.split(" ")
        args.splice(0, 1);
        if (!args[0] || args[0].toLowerCase() === "list") {
            var requests = storage.getItem("requests") || [];
            api.Messages.send("There currently " + (requests.length !== 1 ? "are" : "is") + " " + (!requests.length ? "no" : requests.length) + " request" + (requests.length !== 1 ? "s" : "") + " in the queue" + (requests.length ? ":" : "."));
            for (var i = 0; i < requests.length; i++) {
                setTimeout(function (index, request) {
                    api.Messages.send((index + 1) + " - " + request);
                }.bind(this, i, requests[i]), (i + 1) * 1000);
            }
        } else if (args[0] === "?" || args[0].toLowerCase() === "help") {
            api.Messages.send("Add, delete or list requests! You can also raffle a random request!");
        } else if (args[0].toLowerCase() === "raffle") {
            if (!data.mod && !data.admin) {
                api.Messages.send("Only mods or admins can start a raffle.");
                return;
            }
            var requests = storage.getItem("requests") || [];
            if (!requests.length) {
                api.Messages.send("No requests to raffle");
                return;
            }
            api.Messages.send("Do this request: " + requests[Math.floor(Math.random() * requests.length)]);
        } else if (parseInt(args[0]) || args[0].toLowerCase() === "delete") {
            if (!data.mod && !data.admin) {
                api.Messages.send("Only mods or admins can delete requests.");
                return;
            }
            if (args[0].toLowerCase() === "delete") args.splice(0, 1);
            var index = parseInt(args[0]) - 1;
            var requests = storage.getItem("requests") || [];
            var removed = requests.splice(index, 1)[0];
            storage.setItem("requests", requests);
            removed ? api.Messages.send("Removed request '" + removed + "'") : api.Messages.send("Request with index " + (index + 1) + " not found.");
        } else {
            if (!data.mod && !data.admin) {
                api.Messages.send("Only mods or admins can add requests.");
                return;
            }
            if (args[0].toLowerCase() === "add") args.splice(0, 1);
            var requests = storage.getItem("requests") || [];
            requests.push(args.join(" "));
            storage.setItem("requests", requests);
            api.Messages.send("Added request '" + args.join(" ") + "'");
        }
    }
}
module.exports = {
    meta_inf: {
        name: "Request Queue",
        version: "1.0.0",
        description: "Store requests for later.",
        author: "Wolvan"
    },
    load: function (_api, _storage) {
        api = _api;
        storage = _storage;
        api.Events.on("requestq_addRequestToQ", addRequestToQEvent);
    },
    start: function () {
        api.Events.on("userMsg", handleMsg);
    },
    stop: function () {
        api.Events.removeListener("userMsg", handleMsg);
    },
    unload: function() {
        api.Events.removeListener("requestq_addRequestToQ", addRequestToQEvent);
    }
}
