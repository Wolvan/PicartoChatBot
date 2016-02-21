var api;

function servePage(req,res) {
    var path = req.url.split('/');
    if(path.length > 2 && path[1].toLowerCase() == "last"){
        res.writeHead(301,
            {Location: 'https://data.anonpone.com/api/last/'+path[2]+"/"+path[3]}
        );
    } else if(path.length > 1 && path[1].toLowerCase() == "last"){
        res.writeHead(301,
            {Location: '/'}
        );
    } else {
        if(req.collection == null) req.collection = [];
        req.collection.push(["Last Post","/last/post/[quest shortname]","Displays the last Post Number of the specified quest"]);
        req.collection.push(["Last Post Time","/last/time/[quest shortname]","Displays the time since last post of the specified quest"]);
        req.collection.push(["Last Post Image","/last/image/[quest shortname]","Displays the last image of the specified quest"]);
    }
}

module.exports = {
    meta_inf: {
        name: "Last Items",
        version: "1.0.0",
        description: "Redirects to ",
        author: "Amm"
    },
    load: function (_api) {
        api = _api;
    },
    start: function () {
        api.Events.on("http", servePage);
    },
    stop: function () {
        api.Events.onremoveListener("http", servePage);
    }
}
