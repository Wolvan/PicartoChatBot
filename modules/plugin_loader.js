'use strict';

var _plugin_dir = "/plugins";
var fileExtension = ".pbot.js";

var fs = require("fs");
var reload = require("require-reload");
var node_persist = require("node-persist");
var EventEmitter2 = require("eventemitter2").EventEmitter2;
var EE2 = new EventEmitter2({
	wildcard: true,
	newListener: false,
	maxListeners: 0
});

function injectDependencies(deps) {
    var packageJSON = reload("../package.json");
    var injectedEntries = 0;
    for (var dep in deps) {
        if (!packageJSON.dependencies[dep]) {
            packageJSON.dependencies[dep] = deps[dep];
            console.log("Injecting " + dep + " (" + deps[dep] + ")");
            injectedEntries++;
        }
    }
    if (injectedEntries) {
        fs.writeFileSync("./package.json", JSON.stringify(packageJSON, null, 2));
        console.log("Injection successful, running npm");
        require("child_process").execSync("npm i");
    }
}

function InvalidPluginError(message, filename) {
    this.name = "InvalidPluginError";
    this.message = message || "Plugin '" + filename + "' invalid."
    this.plugin = filename || "undefined plugin";
    this.stack = (new Error()).stack
}
InvalidPluginError.prototype = Object.create(Error.prototype);
InvalidPluginError.prototype.constructor = InvalidPluginError;

function plugin_loader(_api, _storage, _api_version, _basedir, _dont_define_pm_api) {
    this.api = _api || {};
	var plugin_loader = this;
	if (!_dont_define_pm_api) {
		var plugin_manager_api = {
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
				return plugin_loader.startPlugin(file_id, quiet);
			},
			stop: function (file_id, quiet) {
				console.log("[Plugin]Plugin requests stopping of " + file_id);
				return plugin_loader.stopPlugin(file_id, quiet);
			},
			listPlugins: function () {
				return plugin_loader.listPlugins();
			},
			getPlugin: function (fileID) {
				var plugin = Object.assign({}, plugin_loader.getPlugin(fileID));
				plugin.start = function () { console.log("Plugins are not allowed to call another plugin's start function!"); return false; }
				plugin.stop = function () { console.log("Plugins are not allowed to call another plugin's stop function!"); return false; }
				plugin.load = function () { console.log("Plugins are not allowed to call another plugin's load function!"); return false; }
				plugin.unload = function () { console.log("Plugins are not allowed to call another plugin's unload function!"); return false; }
				return plugin;
			},
			getPluginInfo: function (fileID) {
				return plugin_loader.getPluginInfo(fileID);
			},
			isPluginLoaded: function (fileID) {
				return plugin_loader.isPluginLoaded(fileID);
			},
			getLoadedPlugins: function () {
				return plugin_loader.getLoadedPlugins()
			},
			isPluginRunning: function (fileID) {
				return plugin_loader.isPluginRunning(fileID);
			},
			getStartedPlugins: function () {
				return plugin_loader.getStartedPlugins();
			}
		}
		this.api.plugin_manager = plugin_manager_api;
	}
	this.api.PL_Events = EE2;
    this.storage = _storage || node_persist.create({ dir: process.cwd() + "/storage/plugin_loader" }).initSync();
    this.api_version = _api_version || "1.0.0";
    if (!_basedir) { _basedir = process.cwd(); }
    this.basedir = _basedir;
    this.plugins_dir = _basedir + _plugin_dir;
    this.loadedPlugins = {};
    this.startedPlugins = {};

    this.init_directory();
}

plugin_loader.prototype.listPlugins = function () {
    var files = fs.readdirSync(this.plugins_dir);
    return files.filter(function (item) {
        return item.toLowerCase().endsWith(fileExtension);
    });
}

plugin_loader.prototype.getPlugin = function (file_id) {
    if (!file_id.toLowerCase().endsWith(fileExtension)) {
        file_id = file_id + fileExtension;
    }
    
    if (this.loadedPlugins[file_id]) {
        return this.loadedPlugins[file_id];
    }

    var plugin_file = this.plugins_dir + "/" + file_id;
    if (!fs.existsSync(plugin_file)) {
       throw new Error("Plugin File '" + file_id + "' not found");
    }
    try {
        var plugin = reload(plugin_file);
    } catch (ex) {
        throw new InvalidPluginError("Failed to load plugin '" + file_id + "'", ex);
    }
    
    if (!plugin.meta_inf) {
        throw new InvalidPluginError("Plugin is missing meta_inf block", file_id);
    }
    if (!plugin.start) {
        throw new InvalidPluginError("Plugin is missing start function", file_id);
    }

    return plugin;
}

plugin_loader.prototype.getPluginInfo = function (file_id) {
    var plugin = this.getPlugin(file_id);
    return {
        Name: plugin.meta_inf.name || "Unnamed Plugin",
        Version: plugin.meta_inf.version || "0.0.0",
        Description: plugin.meta_inf.description || "No Description available",
        Author: plugin.meta_inf.author || "",
        Dependencies: plugin.meta_inf.dependencies || {},
		StorageOptions: plugin.meta_inf.storage_options || {},
        APIVersion: plugin.meta_inf.api_version_required || "*"
    }
}

plugin_loader.prototype.isPluginLoaded = function (file_id) {
    if (!file_id.toLowerCase().endsWith(fileExtension)) {
        file_id = file_id + fileExtension;
    }
    return !!this.loadedPlugins[file_id];
}
plugin_loader.prototype.getLoadedPlugins = function () {
    var plugins = [];
    for (var plugin in this.loadedPlugins) {
        plugins.push(plugin);
    }
    return plugins;
}

plugin_loader.prototype.isPluginRunning = function (file_id) {
    if (!file_id.toLowerCase().endsWith(fileExtension)) {
        file_id = file_id + fileExtension;
    }
    return !!this.startedPlugins[file_id];
}
plugin_loader.prototype.getStartedPlugins = function () {
    var plugins = [];
    for (var plugin in this.startedPlugins) {
        if (this.isPluginRunning(plugin)) plugins.push(plugin);
    }
    return plugins;
}

plugin_loader.prototype.getInitialPluginState = function (file_id) {
    if (!file_id.toLowerCase().endsWith(fileExtension)) {
        file_id = file_id + fileExtension;
    }
    return this.storage.getItem("state_" + file_id) || "running";
}

plugin_loader.prototype.loadPlugin = function (file_id, quiet) {
    if (!file_id.toLowerCase().endsWith(fileExtension)) {
        file_id = file_id + fileExtension;
    }
    try {
        if (this.isPluginLoaded(file_id)) {
            if (!quiet) console.log("[PluginLoader]Plugin '" + file_id + "' already loaded");
            return false;
        }
        var plugin = this.getPlugin(file_id);
        var pluginInfo = this.getPluginInfo(file_id);
        if (!require("semver").satisfies(this.api_version, pluginInfo.APIVersion)) {
            if (!quiet) console.log("[PluginLoader]Plugin '" + file_id + "' requires a more recent API version, you may need to update the bot. Requested version: " + pluginInfo.APIVersion + ". Your version: " + this.api_version);
            return false;
        }
        injectDependencies(pluginInfo.Dependencies);
		var storage_options = pluginInfo.StorageOptions;
		storage_options.dir = this.basedir + "/storage/plugins/" + file_id;
        var plugin_store = node_persist.create(storage_options);
        plugin_store.initSync();
        if (plugin.load) { plugin.load(this.api, plugin_store); }
        if (!quiet) console.log("[PluginLoader]Loaded plugin '" + pluginInfo.Name + " v" + pluginInfo.Version + "' from '" + file_id + "'");
        this.loadedPlugins[file_id] = plugin;
        this.storage.setItem("state_" + file_id, "loaded");
        if (this.api.Events) this.api.Events.emit("pm_pluginLoaded", file_id);
		this.api.PL_Events.emit("pluginLoaded", {
			file: file_id,
			meta_inf: pluginInfo
		});
        return true;
    } catch (e) {
        if (!quiet) console.log("[PluginLoader]Failed to load plugin from file '" + file_id + "'\n" + e.stack);
        return false;
    }
}

plugin_loader.prototype.unloadPlugin = function (file_id, quiet) {
    if (!file_id.toLowerCase().endsWith(fileExtension)) {
        file_id = file_id + fileExtension;
    }
    try {
        if (!this.isPluginLoaded(file_id)) {
            if (!quiet) console.log("[PluginLoader]Plugin '" + file_id + "' not loaded");
            return false;
        }
        if (this.isPluginRunning(file_id)) {
            if (!quiet) console.log("[PluginLoader]Plugin '" + file_id + "' is still running");
            return false;
        }
        var plugin = this.getPlugin(file_id);
        var pluginInfo = this.getPluginInfo(file_id);
        if (plugin.unload) { plugin.unload(); }
        delete this.loadedPlugins[file_id];
        if (!quiet) console.log("[PluginLoader]Unloaded plugin '" + pluginInfo.Name + " v" + pluginInfo.Version + "' from '" + file_id + "'");
        this.storage.setItem("state_" + file_id, "unloaded");
        if (this.api.Events) this.api.Events.emit("pm_pluginUnloaded", file_id);
		this.api.PL_Events.emit("pluginUnloaded", {
			file: file_id,
			meta_inf: pluginInfo
		});
        return true;
    } catch (e) {
        if (!quiet) console.log("[PluginLoader]Failed to unload plugin from file '" + file_id + "'\n" + e.stack);
        return false;
    }
}

plugin_loader.prototype.startPlugin = function (file_id, quiet) {
    if (!file_id.toLowerCase().endsWith(fileExtension)) {
        file_id = file_id + fileExtension;
    }
    try {
        if (!this.isPluginLoaded(file_id)) {
            if (!quiet) console.log("[PluginLoader]Plugin '" + file_id + "' not loaded");
            return false;
        }
        if (this.isPluginRunning(file_id)) {
            if (!quiet) console.log("[PluginLoader]Plugin '" + file_id + "' already started.");
            return false;
        }
        var plugin = this.getPlugin(file_id);
        var pluginInfo = this.getPluginInfo(file_id);
        plugin.start();
        this.startedPlugins[file_id] = true;
        if (!quiet) console.log("[PluginLoader]Started plugin '" + pluginInfo.Name + " v" + pluginInfo.Version + "' from '" + file_id + "'");
        this.storage.setItem("state_" + file_id, "running");
        if (this.api.Events) this.api.Events.emit("pm_pluginStarted", file_id);
		this.api.PL_Events.emit("pluginStarted", {
			file: file_id,
			meta_inf: pluginInfo
		});
        return true;
    } catch (e) {
        if (!quiet) console.log("[PluginLoader]Failed to start plugin from file '" + file_id + "'\n" + e.stack);
        return false;
    }
}

plugin_loader.prototype.stopPlugin = function (file_id, quiet) {
    if (!file_id.toLowerCase().endsWith(fileExtension)) {
        file_id = file_id + fileExtension;
    }
    try {
        if (!this.isPluginLoaded(file_id)) {
            if (!quiet) console.log("[PluginLoader]Plugin '" + file_id + "' not loaded");
            return false;
        }
        if (!this.isPluginRunning(file_id)) {
            if (!quiet) console.log("[PluginLoader]Plugin '" + file_id + "' not started.");
            return false;
        }
        var plugin = this.getPlugin(file_id);
        var pluginInfo = this.getPluginInfo(file_id);
        if (plugin.stop) { plugin.stop(); }
        this.startedPlugins[file_id] = false;
        if (!quiet) console.log("[PluginLoader]Stopped plugin '" + pluginInfo.Name + " v" + pluginInfo.Version + "' from '" + file_id + "'");
        this.storage.setItem("state_" + file_id, "loaded");
        if (this.api.Events) this.api.Events.emit("pm_pluginStopped", file_id);
		this.api.PL_Events.emit("pluginStopped", {
			file: file_id,
			meta_inf: pluginInfo
		});
        return true;
    } catch (e) {
        if (!quiet) console.log("[PluginLoader]Failed to stop plugin from file '" + file_id + "'\n" + e.stack);
        return false;
    }
}

plugin_loader.prototype.deleteStorage = function (file_id, quiet) {
    if (!file_id.toLowerCase().endsWith(fileExtension)) {
        file_id = file_id + fileExtension;
    }
    try {
        var isRunning = this.isPluginRunning(file_id);
        var isLoaded = this.isPluginLoaded(file_id);
        if (
            (this.stopPlugin(file_id, quiet) || !this.isPluginRunning(file_id)) &&
            (this.unloadPlugin(file_id, quiet) || !this.isPluginLoaded(file_id))
        ) {
            var tmpStore = node_persist.create({ dir: this.basedir + "/storage/plugins/" + file_id });
            tmpStore.initSync();
            tmpStore.clearSync();
            if (isLoaded) {
                if (!this.loadPlugin(file_id, quiet)) {
                    if (!quiet) console.log("[PluginLoader]Failed to load plugin from file '" + file_id + "'.");
                    return false
                }
            }
            if (isRunning) {
                if (!this.startPlugin(file_id, quiet)) {
                    if (!quiet) console.log("[PluginLoader]Failed to start plugin from file '" + file_id + "'.");
                    return false
                }
            }
            return true;
        } else {
            if (!quiet) console.log("[PluginLoader]Failed to stop or unload plugin from file '" + file_id + "'.");
            return false
        }
    } catch (e) {
        if (!quiet) console.log("[PluginLoader]Failed to delete plugin storage for '" + file_id + "'\n" + e.stack);
        return false;
    }
}

plugin_loader.prototype.init_directory = function () {
    if (!fs.existsSync(this.plugins_dir)) {
        fs.mkdirSync(this.plugins_dir);
    }
}

module.exports = plugin_loader;
