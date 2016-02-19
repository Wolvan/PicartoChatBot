var api;
var storage;

function getReq(msg){ 
    var users = storage.getItem("requests") || [{username:msg.username, requests:[]}];
    for(var user of users){
        if(msg.username == user.username) return user.requests;
    }
    return [];
}
function delReq(msg,index){
    var users = storage.getItem("requests") || [{username:msg.username, requests:[]}];
    for(var user of users){
        if(msg.username == user.username){
            var requests = user.requests;
            var removed = requests.splice(index, 1)[0];
            user.requests = requests;
            storage.setItem("requests", users);
            return removed;
        }
    }
}
function addReq(msg,request){ 
    var users = storage.getItem("requests") || [{username:msg.username, requests:[]}];
    for(var user of users){
        if(msg.username == user.username){
            user.requests.push(request);
            storage.setItem("requests", users);
            return;
        }
    }
    users.push({username:msg.username,requests:[request]});
    storage.setItem("requests", users);
    return;
}

function addRequestToQEvent(request) {
    addReq({username:"admin"},request);
    api.Messages.send("Added request '" + request + "'");
}
function handleMsg(data) {
    if (data.msg.toLowerCase().startsWith("!request")) {
        var args = data.msg.split(" ")
        args.splice(0, 1);
        if (!args[0] || args[0].toLowerCase() === "list") {
            var requests = getReq(data);
            api.Messages.send("There currently " + (requests.length !== 1 ? "are" : "is") + " " + (!requests.length ? "no" : requests.length) + " request" + (requests.length !== 1 ? "s" : "") + " in the queue" + (requests.length ? ":" : "."));
            for (var i = 0; i < requests.length; i++) {
                setTimeout(function (index, request) {
                    api.Messages.send((index + 1) + " - " + request);
                }.bind(this, i, requests[i]), (i + 1) * 1000);
            }
        } else if (args[0] === "?" || args[0].toLowerCase() === "help") {
            api.Messages.send("Add, delete or list requests! You can also raffle a random request!");
        } else if (args[0].toLowerCase() === "raffle") {
            var requests = getReq(data);
            if (!requests.length) {
                api.Messages.send("No requests to raffle");
                return;
            }
            api.Messages.send("Do this request: " + requests[Math.floor(Math.random() * requests.length)]);
        } else if (parseInt(args[0]) || args[0].toLowerCase() === "delete") {
            if (args[0].toLowerCase() === "delete") args.splice(0, 1);
            var index = parseInt(args[0]) - 1;
            var removed = delReq(data,index);
            removed ? api.Messages.send("Removed request '" + removed + "'") : api.Messages.send("Request with index " + (index + 1) + " not found.");
        } else {
            if (args[0].toLowerCase() === "add") args.splice(0, 1);
            addReq(data,args.join(" "));
            api.Messages.send("Added request '" + args.join(" ") + "'");
        }
    }
}

//busted
function servePage(req,res) {
    var path = req.url.split('/');
    if(path[1] == "request"){
        var requests = storage.getItem("requests") || [];
        var css = "<style> h1 { -webkit-text-stroke: 1px black;color: white;text-shadow: 3px 3px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;}</style>";
        res.write(css);
        res.write("<h1>");
        for(request of requests){
            res.write(request+"<br />")
        }
        res.write("</h1>");
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
        api.Events.on("http", servePage);
    },
    stop: function () {
        api.Events.removeListener("userMsg", handleMsg);
        api.Events.onremoveListener("http", servePage);
    },
    unload: function() {
        api.Events.removeListener("requestq_addRequestToQ", addRequestToQEvent);
    }
}
