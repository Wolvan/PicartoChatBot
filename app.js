#!/usr/bin/env node
'use strict';

var io = require("socket.io-client");
var entities = require("entities");
var request = require("sync-request");
var commander = require("commander");
var EventEmitter = require("events");
var storage = require("node-persist");
var picarto = require("./modules/picarto.js");
var http = require('http');
var jade = require('jade');
var config = require("./config.json") || {};

var socket;
var plugin_loader;
var api = {};
var socket = {};
var store = storage.create({ dir: process.cwd() + "/storage/main_app" });
var inputLog = [];
store.initSync();

api.version = "1.2.1";
api.Events = new EventEmitter;
api.Events.setMaxListeners(0);
api.readOnly = {};
api.jade = jade;

api.sharedStorage = storage.create({ dir: process.cwd() + "/storage/shared_storage" });
api.sharedStorage.initSync();

api.permissions_manager = {
    PERMISSION_USER: 1,
    PERMISSION_ADMIN: 2,
    PERMISSION_MOD: 4,
    PERMISSION_PTVADMIN: 8,
    __permsCache: {},
    __defaultLevel: 6,
    getPerm: function (channel, pId, defaultPermLevel) {
        channel = channel.toLowerCase();
        this.__permsCache = store.getItem("permissions") || {};
        this.__permsCache[channel] = this.__permsCache[channel] || {};
        return this.__permsCache[channel][pId] = (typeof this.__permsCache[channel][pId] !== 'undefined') ? this.__permsCache[channel][pId] : {id: pId, level: (typeof defaultPermLevel !== 'undefined' ? defaultPermLevel : this.PERMISSION_ADMIN | this.PERMISSION_MOD), whitelist: [], blacklist: []};
    },
    savePerms: function () {
        store.setItem("permissions", this.__permsCache);
    },
    isOwner: function (userData) {
        return userData.username.toLowerCase() === userData.channel.toLowerCase();
    },
    userHasPermission: function (user, pId, defaultPermLevel) { // !onblacklist && (permLevelCheck || (onwhitelist && registered))
        var p = this.getPerm(user.channel.toLowerCase(), pId, defaultPermLevel);
        return !(p.blacklist.indexOf(user.username) !== -1) && ((p.level & this.getUserPermissionLevel(user) !== 0) || ((p.whitelist.indexOf(user.username) !== -1) && user.registered));
    },
    getUserPermissionLevel: function (userData) {
        return (!(userData.admin || userData.mod || userData.ptvadmin) * this.PERMISSION_USER) +
                (userData.admin * this.PERMISSION_ADMIN) +
                (userData.mod * this.PERMISSION_MOD) +
                (userData.ptvadmin * this.PERMISSION_PTVADMIN);
    },
    addPermissionLevel: function (channel, permissionId, level) {
        var perm = this.getPerm(channel, permissionId);
        perm.level = perm.level | level;
        this.savePerms();
    },
    removePermissionLevel: function (channel, permissionId, level) {
        var perm = this.getPerm(channel, permissionId);
        perm.level = perm.level ^ (perm.level & level);
        this.savePerms();
    },
    whitelistUser: function (channel, permissionId, username) {
        var perm = this.getPerm(channel, permissionId);
        if (perm.whitelist.indexOf(username.toLowerCase()) === -1) {
            perm.whitelist.push(username.toLowerCase());
        }
        this.savePerms();
    },
    unwhitelistUser: function (channel, permissionId, username) {
        var perm = this.getPerm(channel, permissionId);
        if ((index = perm.whitelist.indexOf(username.toLowerCase())) === -1) {
            perm.whitelist.splice(index, 1);
        }
        this.savePerms();
    },
    blacklistUser: function (channel, permissionId, username) {
        var perm = this.getPerm(channel, permissionId);
        if (perm.blacklist.indexOf(username.toLowerCase()) === -1) {
            perm.blacklist.push(username.toLowerCase());
        }
        this.savePerms();
    },
    unblacklistUser: function (channel, permissionId, username) {
        var perm = this.getPerm(channel, permissionId);
        if ((index = perm.blacklist.indexOf(username.toLowerCase())) === -1) {
            perm.blacklist.splice(index, 1);
        }
        this.savePerms();
    }
};

api.user_manager = {
    __currentUserData: {},
    updateUserData: function (data) {
        var channel = data.channel.toLowerCase();
        this.__currentUserData[channel.toLowerCase()] = this.__currentUserData[channel.toLowerCase()] || {};
        var un = data.username.toLowerCase();
        return this.__currentUserData[channel.toLowerCase()][un] = (typeof this.__currentUserData[channel.toLowerCase()][un] !== 'undefined') ? this.mergeUserData(this.__currentUserData[channel.toLowerCase()][un], data) : data;
    },
    updateUserList: function (channel, data) {
        var fud = {};
        for (var i = 0; i < data.length; ++i) {
            var un = data[i].username.toLowerCase();
            this.__currentUserData[channel.toLowerCase()] = this.__currentUserData[channel.toLowerCase()] || {};
            fud[data.username] = (typeof this.__currentUserData[channel.toLowerCase()][un] !== 'undefined') ? this.mergeUserData(this.__currentUserData[channel.toLowerCase()][un], data[i]) : data[i];
        }
        this.__currentUserData[channel.toLowerCase()] = fud;
    },
    mergeUserData: function (sourceData, additionalData) {
        for (var attrname in additionalData) {
            sourceData[attrname] = additionalData[attrname];
        }
        return sourceData;
    },
    getUserByName: function (channel, username) {
        this.__currentUserData[channel.toLowerCase()] = this.__currentUserData[channel.toLowerCase()] || {};
        return this.__currentUserData[channel.toLowerCase()][username.toLowerCase()];
    }
};

api.timeout_manager = {
    __timeoutMsCache: {},
    __currentTimeoutsTimes: {},
    __defaultMs: 15000,
    getTimeoutTime: function (id) {
        return this.__currentTimeoutsTimes[id] = (typeof this.__currentTimeoutsTimes[id] !== 'undefined') ? this.__currentTimeoutsTimes[id] : 0;
    },
    checkTimeout: function (id, defaultMs) {
        if (Date.now() - this.getTimeoutTime(id) > this.getTimeoutMs(id, defaultMs)) {
            this.__currentTimeoutsTimes[id] = Date.now();
            return true;
        }
        return false;
    },
    getTimeRemaining: function (id, defaultMs) {
        return Math.max(0, (this.getTimeoutMs(id, defaultMs) - (Date.now() - this.getTimeoutTime(id))));
    },
    setTimeout: function(id, ms) {
        this.__timeoutMsCache[id] = ms;
        this.saveTimeoutMs();
    },
    clearTimeout: function(id) {
        this.__currentTimeoutsTimes[id] = 0;
    },
    getTimeoutMs: function (id, defaultMs) {
        this.__timeoutMsCache = api.sharedStorage.getItem("timeouts") || {};
        return (typeof this.__timeoutMsCache[id] !== 'undefined') ? this.__timeoutMsCache[id] : (typeof defaultMs !== 'undefined' ? defaultMs : this.__defaultMs);
    },
    saveTimeoutMs: function () {
        api.sharedStorage.setItem("timeouts", this.__timeoutMsCache);
    }
};

function initPluginLoader() {
    var loader_storage = storage.create({ dir: process.cwd() + "/storage/plugin_loader" });
    loader_storage.initSync();
    plugin_loader = require("./modules/plugin_loader.js"); plugin_loader = new plugin_loader(api, loader_storage);
    api.plugin_manager = {
        load: function (file_id, quiet) {
            console.log("[Plugin]Plugin requests loading of " + file_id);
            return plugin_loader.loadPlugin(file_id, quiet);
        },
        unload: function (file_id, quiet) {
            console.log("[Plugin]Plugin requests unloading of " + file_id);
            return plugin_loader.unloadPlugin(file_id, quiet);
        },
        start: function (file_id, quiet) {
            console.log("[Plugin]Plugin requests starting of " + file_id);
            return plugin_loader.startedPlugins(file_id, quiet);
        },
        stop: function (file_id, quiet) {
            console.log("[Plugin]Plugin requests stopping of " + file_id);
            return plugin_loader.stopPlugin(file_id, quiet);
        },
        listPlugins: function () {
            return plugin_loader.listPlugins();
        },
        getPlugin: function (fileID) {
            var plugin = Object.create(plugin_loader.getPlugin(fileID));
            plugin.start = function () { console.log("Plugins are not allowed to call another plugin's start function!"); }
            plugin.stop = function () { console.log("Plugins are not allowed to call another plugin's stop function!"); }
            plugin.load = function () { console.log("Plugins are not allowed to call another plugin's load function!"); }
            plugin.unload = function () { console.log("Plugins are not allowed to call another plugin's unload function!"); }
            return plugin;
        },
        getPluginInfo: function (fileID) {
            return plugin_loader.getPluginInfo(fileID);
        },
        isPluginLoaded: function (fileID) {
            return plugin_loader.isPluginLoaded(fileID);
        },
        listLoadedPlugins: function () {
            return plugin_loader.getLoadedPlugins()
        },
        isPluginRunning: function (fileID) {
            return plugin_loader.isPluginRunning(fileID);
        },
        getStartedPlugins: function () {
            return plugin_loader.getStartedPlugins();
        }
    }
}

function initServer(url) {
    var server = http.createServer(function (req, res) {
        res.writeHead(200);
        api.Events.emit("http", req, res);
        
        var path = req.url.split('/');
        if (path.length < 3 && path[1] == '') {
            api.jade.renderFile(process.cwd() + '/views/index.jade', {
                urls: req.collection.sort(function (a, b) {
                    if (a[0] < b[0]) return -1;
                    if (a[0] > b[0]) return 1;
                    return 0;
                })
            }, function (err, html) {
                res.write(html);
            });
        }
        res.end();
    });
    
    server.listen(url.port, function (error) {
        function waitToPost() {
            if (!SET_PICARTO_LOGIN) {
                if (error) {
                    console.error("Unable to listen on port", url.port, error);
                    return;
                } else {
                    console.log("Enter " + url.url + ":" + url.port + " in a browser to access web functions.");
                }
            } else {
                setTimeout(waitToPost, 1000);
            }
        }
        waitToPost();
    });
}

function initSocket(token,channel) {
    // Connect all the socket events with the EventEmitter of the API
    socket[channel.toLowerCase()] = io.connect("https://nd1.picarto.tv:443", {
        secure: true,
        forceNew: true,
        query: "token=" + token
    }).on("connect", function () {
        console.log("Connected to " + channel);
        api.Events.emit("connected");
    }).on("disconnect", function (reason) {
        console.log("Disconnected from " + channel);
        api.Events.emit("disconnected", reason);
    }).on("reconnect", function () {
        connected();
        api.Events.emit("reconnected");
    }).on("reconnect_attempt", function () {
        api.Events.emit("reconnect_attempt");
    }).on("chatMode", function (data) {
        api.Events.emit("chatMode", data);
    }).on("srvMsg", function (data) {
        api.Events.emit("srvMsg", data);
    }).on("channelUsers", function (data) {
        api.user_manager.updateUserList(channel, data);
        api.Events.emit("channelUsers", data, channel);
    }).on("userMsg", function (data) {
        if(inputLog.indexOf(data.id) == -1){
            inputLog.push(data.id);
            if(inputLog.length > 50) inputLog.shift();
            data.msg = entities.decode(data.msg);
            data.channel = channel;
            data.whisper = false;
            api.Events.emit("userMsg", api.user_manager.updateUserData(data));
        }
    }).on("meMsg", function (data) {
        api.Events.emit("meMsg", data);
    }).on("globalMsg", function (data) {
        api.Events.emit("globalMsg", data);
    }).on("clearChat", function () {
        api.Events.emit("clearChat");
    }).on("commandHelp", function () {
        api.Events.emit("commandHelp");
    }).on("modToolsVisible", function (modToolsEnabled) {
        api.Events.emit("modToolsVisible", modToolsEnabled);
    }).on("modList", function (data) {
        api.Events.emit("modList", data);
    }).on("whisper", function (data) {
        if(inputLog.indexOf(data.id) == -1){
            inputLog.push(data.id);
            if(inputLog.length > 50) inputLog.shift();
            data.msg = entities.decode(data.msg);
            data.channel = channel;
            data.whisper = true;
            api.Events.emit("whisper", api.user_manager.updateUserData(data));
        }
    }).on("color", function (data) {
        api.Events.emit("color", data);
    }).on("onlineState", function (data) {
        api.Events.emit("onlineState", data);
    }).on("raffleUsers", function (data) {
        api.Events.emit("raffleUsers", data);
    }).on("wonRaffle", function (data) {
        api.Events.emit("wonRaffle", data);
    }).on("runPoll", function () {
        api.Events.emit("runPoll");
    }).on("showPoll", function (data) {
        api.Events.emit("showPoll", data);
    }).on("pollVotes", function (data) {
        api.Events.emit("pollVotes", data)
    }).on("voteResponse", function () {
        api.Events.emit("voteResponse");
    }).on("finishPoll", function (data) {
        api.Events.emit("finishPoll", data);
    }).on("gameMode", function (data) {
        api.Events.emit("gameMode", data);
    }).on("adultMode", function (data) {
        api.Events.emit("adultMode", data);
    }).on("commissionsAvailable", function (data) {
        api.Events.emit("commissionsAvailable", data);
    }).on("clearUser", function (data) {
        api.Events.emit("clearUser", data);
    }).on("removeMsg", function (data) {
        api.Events.emit("removeMsg", data);
    }).on("warnAdult", function () {
        api.Events.emit("warnAdult");
    }).on("warnGaming", function () {
        api.Events.emit("warnGaming");
    }).on("warnMovies", function () {
        api.Events.emit("warnMovies");
    }).on("multiStatus", function (data) {
        api.Events.emit("multiStatus", data);
    });
    
    api.Messages = {
        send: function (message,channel) {
            if(typeof channel == 'undefined'){
                channel = Object.keys(socket)[0];
            } else if(typeof socket[channel.toLowerCase()] === 'undefined' || socket[channel.toLowerCase()].disconnected) {
                console.log("Failed to send, channel is not connected");
                return;
            } 
            if (api.readOnly[channel.toLowerCase()]) {
                console.log("Bot runs in ReadOnly Mode. Messages can not be sent");
                return;
            }
            if (message.length > 255) {
                socket[channel.toLowerCase()].emit("chatMsg", {
                    msg: "This message was too long for Picarto: " + message.length + " characters. Sorry."
                });
                console.log("This message was too long for Picarto: " + message.length + " characters. Sorry.");
                return;
            }
            socket[channel.toLowerCase()].emit("chatMsg", {
                msg: message.toString()
            });
        },
        whisper: function (to, message,channel) {
            if(typeof channel == 'undefined'){
                channel = Object.keys(socket)[0];
            } else if(typeof socket[channel.toLowerCase()] === 'undefined'  || socket[channel.toLowerCase()].disconnected) {
                console.log("Failed to send, channel is not connected");
                return;
            } 
            if (api.readOnly[channel.toLowerCase()]) {
                console.log("Bot runs in ReadOnly Mode. Messages can not be sent");
                return;
            }
            if ((message.length + 4 + to.length) > 255) {
                socket[channel.toLowerCase()].emit("chatMsg", {
                    msg: "/w " + to + " This message was too long for Picarto: " + message.length + " characters. Sorry."
                });
                console.log("This message was too long for Picarto: " + message.length + " characters. Sorry.");
                return;
            }
            socket[channel.toLowerCase()].emit("chatMsg", {
                msg: "/w " + to + " " + message.toString()
            });
        }
    }
    api.setColor = function (color,channel) {
        if(typeof channel == 'undefined'){
                channel = Object.keys(socket)[0];
        }
        if (color.startsWith("#")) {
            color = color.substring(1);
        }
        socket[channel.toLowerCase()].emit("setColor", color.toUpperCase());
    }
}

initPluginLoader();
// Load all Plugins in the ./plugins directory
api.Events.setMaxListeners(plugin_loader.listPlugins().length);
var quiet_loading = true;
plugin_loader.listPlugins().forEach(function (item) {
    var plugin_state = plugin_loader.getInitialPluginState(item);
    if (plugin_state === "running" || plugin_state === "loaded") {
        plugin_loader.loadPlugin(item, quiet_loading);
    }
    if (plugin_state === "running") {
       plugin_loader.startPlugin(item, quiet_loading);
    }
});

var token;
var name;
var channel;
config.http = config.http || {};
if (process.env.PICARTO_TOKEN) token = process.env.PICARTO_TOKEN;
if (process.env.PICARTO_CHANNEL) channel = process.env.PICARTO_CHANNEL;
if (process.env.PICARTO_NAME) name = process.env.PICARTO_NAME;
if (process.env.PICARTO_PORT) config.http.port = process.env.PICARTO_PORT;
if (process.env.PICARTO_URL) config.http.url = process.env.PICARTO_URL;

// Load commandline args as env variables
commander.version(api.version).usage("[options]")
.option("-c, --channel <Picarto Channel>", "Set channel to connect to.")
.option("-n, --botname <Bot name>", "Set the bot's name.")
.option("-t, --token <Token>", "Use an already existing token to login")
.option("-p, --port <Port>","Set a custom port")
.option("-u, --url <URL>","Set a custom URL")
.parse(process.argv);
if (commander.token) token = commander.token;
if (commander.botname) name = commander.botname;
if (commander.channel) channel = commander.channel;
if (commander.port) config.http.port = commander.port;
if (commander.url) config.http.url = commander.url;

if(config.http){
    if(config.http.enabled){
        initServer(config.http);
    } 
} else {
    initServer({url:"http://localhost",port:10001});
}

var SET_PICARTO_LOGIN = 0;
if (token) {
    console.log("Attempting token based connection, please be patient...");
    initSocket(token);
} else if (channel && name) {
    console.log("Attempting to connect, this might take a moment. Please be patient...");
    picarto.getToken(channel, name).then(function (res) {
        initSocket(res.token,channel);
        api.readOnly[channel.toLowerCase()] = res.readOnly;
        if (res.readOnly) console.log("Chat disabled guest login! Establishing ReadOnly Connection.");
    }).catch(function (reason) { console.log("Token acquisition failed: " + reason);});
} else if (channel) {
    console.log("Attempting ReadOnly connection, please be patient...");
    picarto.getROToken(channel).then(function (res) { api.readOnly[channel.toLowerCase()] = res.readOnly; initSocket(res.token,channel); }).catch(function (reason) { console.log("Token acquisition failed: " + reason); });
} else if(config.channels.length === 0 || (config.channels.length === 1 && config.channels[0].channel === "ExampleChannel")) {
    SET_PICARTO_LOGIN = 1;
    console.log("No login information given.");
    process.stdout.write("Channel: ");
}

if(config.channels && config.channels.length && !(config.channels.length === 1 && config.channels[0].channel === "ExampleChannel")){
    config.channels.forEach(function(channel){
        if(channel.enabled){
            picarto.getToken(channel.channel, channel.name).then(function (res) {
                initSocket(res.token,channel.channel);
                api.readOnly[channel.channel.toLowerCase()] = res.readOnly;
                if (res.readOnly) console.log(channel + ": Chat disabled guest login! Establishing ReadOnly Connection.");
            }).catch(function (reason) { console.log(channel.channel + ": Token acquisition failed: " + reason);});
        }
    });
}

function plugin_cmd(args) {
    var columnify = require("columnify");
    function printHelp() {
        var commands = {
            "list": "List status of all plugins",
            "load <filename>": "Load a plugin from the /plugins directory",
            "start <filename>": "Start a previously loaded plugin",
            "enable <filename>": "Loads and starts a plugin from the /plugins directory",
            "stop <filename>": "Stop a previously loaded plugin",
            "unload <filename>": "Unload a previously loaded plugin",
            "disable <filename>": "Stops and unloads a previously loaded plugin",
            "reload <filename>": "Fully reload a plugin (Stop->Unload->Load->Start)",
            "clearstorage <filename>": "Clear the Plugins storage. Plugin restarts in the process"
        }
        console.log(
            "\n" +
            "Plugin Loader Commands\n\n" +
            "\tUsage: plugins <subcommand> [arguments]\n\nSubcommands:\n" +
            columnify(commands, {
                columnSplitter: " - ",
                showHeaders: false
            })
        );
    }
    var subcmd = args.splice(0, 1)[0];
    if (subcmd) {
        switch (subcmd.toLowerCase()) {
            case "help":
                printHelp();
                break;
            case "load":
                var file_id = args.splice(0, 1)[0];
                if (file_id) {
                    plugin_loader.loadPlugin(file_id);
                } else {
                    console.log("No Plugin File specified!\n\n\tUsage: plugins load <File Name>\n");
                }
                break;
            case "unload":
                var file_id = args.splice(0, 1)[0];
                if (file_id) {
                    plugin_loader.unloadPlugin(file_id);
                } else {
                    console.log("No Plugin File specified!\n\n\tUsage: plugins unload <File Name>\n");
                }
                break;
            case "start":
                var file_id = args.splice(0, 1)[0];
                if (file_id) {
                    plugin_loader.startPlugin(file_id);
                } else {
                    console.log("No Plugin File specified!\n\n\tUsage: plugins start <File Name>\n");
                }
                break;
            case "stop":
                var file_id = args.splice(0, 1)[0];
                if (file_id) {
                    plugin_loader.stopPlugin(file_id);
                } else {
                    console.log("No Plugin File specified!\n\n\tUsage: plugins stop <File Name>\n");
                }
                break;
            case "enable":
                var file_id = args.splice(0, 1)[0];
                if (file_id) {
                    if (plugin_loader.isPluginLoaded(file_id) && !plugin_loader.isPluginRunning(file_id)) {
                        if (plugin_loader.startPlugin(file_id, true)) {
                            console.log("[PluginLoader]Successfully started Plugin " + file_id);
                        } else {
                            console.log("[PluginLoader]Failed to start Plugin " + file_id + ". Please try 'plugins start " + file_id + "'.");
                        }
                    } else if (!plugin_loader.isPluginLoaded(file_id)) {
                        if (
                            plugin_loader.loadPlugin(file_id, true) &&
                            plugin_loader.startPlugin(file_id, true)
                        ) {
                            console.log("[PluginLoader]Successfully loaded and started Plugin " + file_id);
                        } else {
                            console.log("[PluginLoader]Failed to load or start Plugin " + file_id + ". Please try 'plugins load " + file_id + "' and then 'plugins start " + file_id + "'.");
                        }
                    } else {
                        console.log("[PluginLoader]Plugin " + file_id + " is already running.");
                    }
                } else {
                    console.log("No Plugin File specified!\n\n\tUsage: plugins enable <File Name>\n");
                }
                break;
            case "disable":
                var file_id = args.splice(0, 1)[0];
                if (file_id) {
                    if (plugin_loader.isPluginLoaded(file_id) && !plugin_loader.isPluginRunning(file_id)) {
                        if (plugin_loader.unloadPlugin(file_id, true)) {
                            console.log("[PluginLoader]Successfully unloaded Plugin " + file_id);
                        } else {
                            console.log("[PluginLoader]Failed to unload Plugin " + file_id + ". Please try 'plugins unload " + file_id + "'.");
                        }
                    } else if (plugin_loader.isPluginRunning(file_id)) {
                        if (
                            plugin_loader.stopPlugin(file_id, true) &&
                            plugin_loader.unloadPlugin(file_id, true)
                        ) {
                            console.log("[PluginLoader]Successfully stopped and unloaded Plugin " + file_id);
                        } else {
                            console.log("[PluginLoader]Failed to load or start Plugin " + file_id + ". Please try 'plugins stop " + file_id + "' and then 'plugins unload " + file_id + "'.");
                        }
                    } else {
                        console.log("[PluginLoader]Plugin " + file_id + " is already disabled.");
                    }
                } else {
                    console.log("No Plugin File specified!\n\n\tUsage: plugins enable <File Name>\n");
                }
                break;
            case "reload":
                var file_id = args.splice(0, 1)[0];
                if (file_id) {
                    var isRunning = plugin_loader.isPluginRunning(file_id);
                    if (
                        (!isRunning || plugin_loader.stopPlugin(file_id, true)) &&
                        (!plugin_loader.isPluginLoaded(file_id) || plugin_loader.unloadPlugin(file_id, true)) &&
                        plugin_loader.loadPlugin(file_id, true) &&
                        isRunning ? plugin_loader.startPlugin(file_id, true) : true
                    ) {
                        console.log("[PluginLoader]Plugin " + file_id + " reloaded successfully");
                    } else {
                        console.log("[PluginLoader]Plugin " + file_id + " reload failed! Please reload manually (Stop -> Unload -> Load -> Start).");
                    }
                } else {
                    console.log("No Plugin File specified!\n\n\tUsage: plugins reload <File Name>");
                }
                break;
            case "clearstorage":
                var file_id = args.splice(0, 1)[0];
                if (file_id) {
                    plugin_loader.deleteStorage(file_id);
                } else {
                    console.log("No Plugin File specified!\n\n\tUsage: plugins clearstorage <File Name>");
                }
                break;
            case "list":
                var column_divider = {
                    plugin_name: "------",
                    plugin_version: "-------",
                    plugin_author: "------",
                    plugin_description: "------------",
                    plugin_state: "-----",
                    plugin_file: "----"
                }
                var data = [
                    {
                        plugin_name: "Plugin",
                        plugin_version: "Version",
                        plugin_author: "Author",
                        plugin_description: "Description",
                        plugin_state: "State",
                        plugin_file: "File"
                    },
                    column_divider
                ]
                var plugin_info; var plugin_state; var plugin;
                var list = plugin_loader.listPlugins();
                for (var plugin_index in list) {
                    plugin = list[plugin_index];
                    plugin_info = plugin_loader.getPluginInfo(plugin);
                    if (plugin_loader.isPluginRunning(plugin)) {
                        plugin_state = "Running";
                    } else if (plugin_loader.isPluginLoaded(plugin)) {
                        plugin_state = "Stopped";
                    } else {
                        plugin_state = "Unloaded"
                    }
                    data.push({
                        plugin_name: plugin_info.Name,
                        plugin_version: plugin_info.Version,
                        plugin_author: plugin_info.Author,
                        plugin_description: plugin_info.Description,
                        plugin_state: plugin_state,
                        plugin_file: plugin.replace(/\.pbot\.js/, ""),
                    });
                    data.push(column_divider);
                }
                console.log(
                    "\n" +
                    columnify(data, {
                        columnSplitter: " | ",
                        showHeaders: false,
                        maxLineWidth: "auto",
                        config: {
                            plugin_description: { maxWidth: 20, align: "center" },
                            plugin_author: { maxWidth: 10, align: "center" },
                            plugin_name: { maxWidth: 10 }
                        }
                    })
                );
                break;
            default:
                console.log("Unknown subcommand. Type plugins help for a full list of commands");
                break;
        }
    } else {
        printHelp();
    }
}

process.stdin.on('readable', function () {
    function printHelp() {
        var columnify = require("columnify");
        var commands = {
            "plugins|pl <subcommand>": "Everything related with plugins can be done here",
            "clear|cls": "Clears the screen",
            "exit|quit": "Shuts the bot down",
            "say <channel> <message>": "Say something as the bot",
            "whisper <channel> <to> <message>": "Whisper to someone as the bot",
            "disconnect <channel>": "Disconnect from Picarto",
            "connect <channel> <name>": "Connect to Picarto again or create a new connection",
            "reconnect <channel>": "Close and re-establish connection",
            "help": "Show this help"
        }
        console.log(
            "\n" +
            "Bot Commands\n\n" +
            "\tUsage: <command> <subcommand> [arguments]\n\n" +
            columnify(commands, {
                columnSplitter: " - ",
                showHeaders: false
            }) + "\n\n" +
            "All Commands that accept subcommands come with a help subcommand\n\n"
        );
    }
    var chunk = process.stdin.read();
    if (chunk !== null) {
        if (SET_PICARTO_LOGIN) {
            if (SET_PICARTO_LOGIN === 1) {
                if (!chunk.toString().trim()) { process.stdout.write("Channel: "); return; }
                process.env.PICARTO_CHANNEL = chunk.toString().trim();
                process.stdout.write("Name (Leave blank for ReadOnly): ");
                SET_PICARTO_LOGIN = 2;
            } else if (SET_PICARTO_LOGIN === 2) {
                if (!chunk.toString().trim()) { 
                    console.log("Attempting ReadOnly connection, please be patient...");
                    picarto.getROToken(process.env.PICARTO_CHANNEL).then(function (res) { initSocket(res.token,process.env.PICARTO_CHANNEL); api.readOnly[process.env.PICARTO_CHANNEL.toLowerCase()] = res.readOnly; }).catch(function (reason) { console.log("Token acquisition failed: " + reason); });
                    SET_PICARTO_LOGIN = 0;
                    return;
                }
                process.env.PICARTO_NAME = chunk.toString().trim();
                SET_PICARTO_LOGIN = 0;
                console.log("Attempting to connect, this might take a moment. Please be patient...");
                picarto.getToken(process.env.PICARTO_CHANNEL, process.env.PICARTO_NAME).then(function (res) {
                    initSocket(res.token,process.env.PICARTO_CHANNEL);
                    api.readOnly[process.env.PICARTO_CHANNEL.toLowerCase()] = res.readOnly;
                    if (res.readOnly) console.log("Chat disabled guest login! Establishing ReadOnly Connection.");
                }).catch(function (reason) { console.log("Token acquisition failed: " + reason); });
            }
            return;
        }
        var input = chunk.toString().trim();
        var args = input.split(" ");
        var cmd = args.splice(0, 1)[0];
        switch (cmd.toLowerCase()) {
            case "plugins":
            case "pl":
            case "plugin":
                plugin_cmd(args);
                break;
            case "clear":
            case "cls":
                require("cli-clear")();
                break;
            case "exit":
            case "quit":
                process.exit();
                break;
            case "say":
                channel = args.shift();
                api.Messages.send(args.join(" "),channel);
                break;
            case "whisper":
            case "w":
                var channel = args.shift();
                var user = args.shift();
                api.Messages.whisper(user, args.join(" "),channel);
                break;
            case "connect":
                if(args[0] && typeof socket[args[0].toLowerCase()] !== 'undefined'){
                    socket[args[0].toLowerCase()].connect();
                } else if(args[0] && args[1]){
                    picarto.getToken(args[0], args[1]).then(function (res) {
                        initSocket(res.token,args[0]);
                        api.readOnly[args[0].toLowerCase()] = res.readOnly;
                        if (res.readOnly) console.log("Chat disabled guest login! Establishing ReadOnly Connection.");
                    }).catch(function (reason) { console.log("Token acquisition failed: " + reason);});
                } else if(args[0]){
                    process.stdout.write("Name (Leave blank for ReadOnly): ");
                    process.env.PICARTO_CHANNEL = args[0];
                    SET_PICARTO_LOGIN = 2;
                } else {
                    process.stdout.write("Channel: ");
                    SET_PICARTO_LOGIN = 1;
                }
                break;
            case "disconnect":
                if(args[0] && typeof socket[args[0].toLowerCase()] !== 'undefined'){
                    socket[args[0].toLowerCase()].disconnect();
                    break;
                }
            case "reconnect":
                if(args[0] && typeof socket[args[0].toLowerCase()] !== 'undefined'){
                    socket[args[0].toLowerCase()].disconnect();
                    socket[args[0].toLowerCase()].connect();
                    break;
                } else if(!args[0]){
                    console.log("Please specify channel");
                } else {
                    console.log("Socket does not exist, please connect first");
                }
                break;
            case "status":
            case "stat":
                console.log("Current Sockets");
                for(var key in socket){
                    if (socket.hasOwnProperty(key)) {
                        console.log("Channel " + key + " is " + (socket[key].connected ? "connected" : "disconnected"));
                    }
                }
                break;
            case "help":
                printHelp();
                break;
            default:
                if (api.Events.listenerCount("command") || api.Events.listenerCount("command#" + cmd.toLowerCase())) {
                    api.Events.emit("command", cmd.toLowerCase(), args);
                    api.Events.emit("command#" + cmd.toLowerCase(), args);
                } else {
                    console.log("\n\nInvalid Command. Use 'help' to get a list of commands.");
                }
                break;
        }
    }
});
