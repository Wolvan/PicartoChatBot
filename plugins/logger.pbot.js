var api;
var storage;

function handleMsg(data) {
    var now = new Date();
    var key = process.env.PICARTO_CHANNEL + "_" + now.getDate() + "_" + (now.getMonth()+1) + "_" + now.getFullYear();
    var record = storage.getItem(key) || {channel:process.env.PICARTO_CHANNEL,date:now.getDate() + "/" + (now.getMonth()+1) + "/" + now.getFullYear(),messages:[]};
    record.messages.push({username:data.username,color:data.color,msg:data.msg,timestamp:now.getTime()});
    storage.setItem(key,record);
}
function servePage(req,res) {
    var path = req.url.split('/');
    if(path.length > 3 && path[1].toLowerCase() == "logger" && path[3] != ''){
        var record = storage.getItem(path[2] + "_" + path[3]) || false;
        if(record){
            api.jade.renderFile(process.cwd() + '/views/record.jade',{record:record}, function(err,html){
                res.write(html);
            });
        } else {
            api.jade.renderFile(process.cwd() + '/views/404.jade',null, function(err,html){
                res.write(html);
            });
        }
    } else if(path.length > 2 && path[1].toLowerCase() == "logger" && path[2] != ''){
        var regex = new RegExp("^" + path[2]);
        var records = storage.valuesWithKeyMatch(regex);
        if(records.length > 0){
            api.jade.renderFile(process.cwd() + '/views/records.jade',{records:records}, function(err,html){
                res.write(html);
            });
        } else {
            api.jade.renderFile(process.cwd() + '/views/404.jade',null, function(err,html){
                res.write(html);
            });
        }
    } else if(path[1].toLowerCase() == "logger"){
        var allRecords = storage.values() || [] ;
        var channels = {};
        for(record of allRecords){
            if(channels.hasOwnProperty(record.channel)){
                channels[record.channel].records++;
                if(new Date(record.date) > new Date(channels[record.channel].date)){
                    channels[record.channel].date = record.date();
                }
            } else {
                channels[record.channel] = {channel:record.channel,date:record.date,records:1};
            }
        }
        api.jade.renderFile(process.cwd() + '/views/channels.jade',{channels:channels}, function(err,html){
            res.write(html);
        });
    } else {
        if(req.collection == null) req.collection = [];
        req.collection.push(["Logger","/logger/","The logger subsection of the site."]);
    }
}

module.exports = {
    meta_inf: {
        name: "Logger",
        version: "1.0.0",
        description: "Logs picarto chats.",
        author: "Amm"
    },
    load: function (_api, _storage) {
        api = _api;
        storage = _storage;
    },
    start: function () {
        api.Events.on("userMsg", handleMsg);
        api.Events.on("http", servePage);
    },
    stop: function () {
        api.Events.removeListener("userMsg", handleMsg);
        api.Events.onremoveListener("http", servePage);
    }
}