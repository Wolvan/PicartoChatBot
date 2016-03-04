var api;
var storage;

function handleMsg(data) {
    if (!data.fromAlias) {
        var now = new Date();
        var key = data.channel + "_" + now.getDate() + "_" + (now.getMonth()+1) + "_" + now.getFullYear();
        var record = storage.getItem(key) || {channel:data.channel,date:now.getDate() + "/" + (now.getMonth()+1) + "/" + now.getFullYear(),messages:[]};
        record.messages.push({username:data.username,color:data.color,msg:data.msg,timestamp:now.getTime()});
        storage.setItem(key,record);
    }
}
function servePage(req,res) {
    var path = req.url.split('/');
    if(path.length > 3 && path[1].toLowerCase() == "logger" && path[3] != ''){
        var record = storage.getItem(path[2] + "_" + path[3]) || false;
        if(record){
            api.jade.renderFile(process.cwd() + '/views/record.jade',{record:record, page: {title: record.channel + " " + record.date, breadcrumb: [["/", "Home"], ["/logger", "Chat Logger"], ["/logger/" + record.channel, record.channel], ["", record.date]]}}, function(err,html){
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
            api.jade.renderFile(process.cwd() + '/views/records.jade',{records:records, page: {title: records[0].channel + " Chat Logs" , breadcrumb: [["/", "Home"], ["/logger", "Chat Logger"], ["", records[0].channel]]}}, function(err,html){
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
        for(record in allRecords){
            if(channels.hasOwnProperty(allRecords[record].channel)){
                channels[allRecords[record].channel].records++;
                if(new Date(allRecords[record].date) > new Date(channels[allRecords[record].channel].date)){
                    channels[allRecords[record].channel].date = allRecords[record].date();
                }
            } else {
                channels[allRecords[record].channel] = {channel:allRecords[record].channel,date:allRecords[record].date,records:1};
            }
        }
        api.jade.renderFile(process.cwd() + '/views/channels.jade',{url: '/logger/', channels:channels, page: {title: "Chat Logs", breadcrumb: [["/", "Home"], ["/logger", "Chat Logger"]]}}, function(err,html){
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
        version: "1.0.1",
        description: "Logs picarto chats.",
        author: "Amm",
        storage_options: {
            interval: 5000
        }
    },
    load: function (_api, _storage) {
        api = _api;
        storage = _storage;
    },
    start: function () {
        api.Events.on("userMsg", handleMsg);
        api.Events.on("userMsgDuplicate", handleMsg);
        api.Events.on("http", servePage);
    },
    stop: function () {
        api.Events.removeListener("userMsg", handleMsg);
        api.Events.removeListener("userMsgDuplicate", handleMsg);
        api.Events.removeListener("http", servePage);
    }
}
