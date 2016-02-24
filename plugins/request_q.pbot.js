var api;
var storage;

function getReq(msg){ 
    var users = storage.getItem("request_store") || [{username:msg.username, requests:[]}];
    for(var user in users){
        if(msg.username.toLowerCase() == users[parseInt(user)].username.toLowerCase()) return users[user].requests;
    }
    return [];
}
function delReq(msg,index){
    var users = storage.getItem("request_store") || [{username:msg.username, requests:[]}];
    for(var user in users){
        if(msg.username.toLowerCase() == users[user].username.toLowerCase()){
            var requests = users[user].requests;
            var removed = requests.splice(index, 1)[0];
            users[user].requests = requests;
            storage.setItem("request_store", users);
            return removed;
        }
    }
}
function addReq(msg,request){ 
    var users = storage.getItem("request_store") || [{username:msg.username, requests:[]}];
    for(var user in users){
        if(msg.username.toLowerCase() == users[user].username.toLowerCase()){
            if(user.length > 25){
                api.Messages.send("Too many requests, maximum of 25");
            }
            users[user].requests.push(request);
            storage.setItem("request_store", users);
            return;
        }
    }
    users.push({username:msg.username,requests:[request]});
    storage.setItem("request_store", users);
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
            var user = data.msg.split(" ");
            if (user[2]) {
                var requests = getReq({ username: user[2] });
            } else {
                var requests = getReq(data);
            }
            api.Messages.send("There currently " + (requests.length !== 1 ? "are" : "is") + " " + (!requests.length ? "no" : requests.length) + " request" + (requests.length !== 1 ? "s" : "") + " in the queue" + (requests.length ? ":" : "."));
            for (var i = 0; i < requests.length; i++) {
                setTimeout(function (index, request) {
                    if (index < 10) {
                        api.Messages.send((index + 1) + " - " + request);
                    }
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
        } else if (args[0].toLowerCase() === "delete" || args[0].toLowerCase() === "del" || args[0].toLowerCase() === "rm" || args[0].toLowerCase() === "remove") {
            args.splice(0, 1);
            var index = parseInt(args[0]) - 1;
            var removed = delReq(data, index);
            removed ? api.Messages.send("Removed request '" + removed + "'") : api.Messages.send("Request with index " + (index + 1) + " not found.");
        } else if (parseInt(args[0])) {
            var requests = getReq(data);
            var index = parseInt(args[0]) - 1;
            requests[index] ? api.Messages.send("Request " + (index + 1) + ": " + requests[index]) : api.Messages.send("Request with index " + (index + 1) + " not found.");
        } else {
            if (args[0].toLowerCase() === "add") args.splice(0, 1);
            addReq(data,args.join(" "));
            api.Messages.send("Added request '" + args.join(" ") + "'");
        }
    }
}

function servePage(req,res) {
    var path = req.url.split('/');
    if(path.length > 2 && path[1].toLowerCase() == "request"){
        var requests = getReq({username: path[2]});
        if(path.length > 3 && path[3].toLowerCase() == 'json'){
            res.write(JSON.stringify(requests));
        }else{
            api.jade.renderFile(process.cwd() + '/views/request.jade',{requests:requests}, function(err,html){
                res.write(html);
            });
        }
    } else if(path.length > 1 && path[1].toLowerCase() == "request"){
        res.writeHead(301,
            {Location: '/'}
        );
    }else{
        if(req.collection == null) req.collection = [];
        req.collection.push(["Request","/request/[picarto username]","Displays [uername]'s requests"]);
    }
}
module.exports = {
    meta_inf: {
        name: "Request Queue",
        version: "2.0.0",
        description: "Store requests for later.",
        author: "Wolvan & Amm"
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
        api.Events.removeListener("http", servePage);
    },
    unload: function() {
        api.Events.removeListener("requestq_addRequestToQ", addRequestToQEvent);
    }
}
