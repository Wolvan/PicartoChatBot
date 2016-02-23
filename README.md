# PicartoTV Chat Bot
####An extendable bot for your Picarto Chat

[![NPM](https://nodei.co/npm/picarto-chat-bot.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/picarto-chat-bot/) 

[![Join the chat at https://gitter.im/Wolvan/PicartoChatBot](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/Wolvan/PicartoChatBot?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [![npm version](https://badge.fury.io/js/picarto-chat-bot.svg)](https://badge.fury.io/js/picarto-chat-bot)

## Introduction
This is an extendable bot for Picarto.TV chats. By itself it does nothing, that's where Plugins come in handy. Drop plugin files into the `/plugins` directory, load them from the bot console (or by restarting completely) and enjoy it's functionality.

## Features
* Lightweight: Being a NodeJS app makes it easily deployable everywhere! Even on low power servers
* Console commands allow you to administrate the bot easily
* Automatic login to Picarto's network: Just specify a channel and a username
* Web facing front allowing you to display information like the requests from the default requests plugin using the OBS Browser Source plugin.
* Plugin API: The bot doesn't really do anything by itself, you install Plugins for functionality. The following plugins come pre-installed:
	* `roll_dice.pbot.js` A dice rolling script that allows to roll any number of dice
	* `greetings.pbot.js` Make the bot greet people or say goodbye
	* `message_output.pbot.js` Print messages from chat to your output
	* `request_q.pbot.js` A queue plugin for requests or commissions
	* `logger.pbot.js` A plugin that logs the chat and makes the logs available through the integrated WebServer

## Install the bot
### from npm (globally)
1. Install NodeJS with npm
2. Use `npm install -g picarto-chat-bot` from a command prompt or terminal
3. Install Plugins
4. Run it with `picarto-bot [-n|-c|-t|-p|-u|--help]`
5. Use the `help` command for a list of commands when the bot is running

### from GitHub (locally)
1. Clone this repository or download the source as .zip file
2. Open a command prompt or terminal and navigate to the folder you cloned the repository to
3. Run `npm install` from a command prompt or terminal
4. Install Plugins
5. Run the bot with `node app.js picarto-bot [-n|-c|-t|-p|-u|--help]`
6. Use the `help` command for a list of commands when the bot is running

## Install plugins
Plugin installation is easy! Download the file with the extension `.pbot.js` and put it in the `/plugins` directory of the bot. Load it by typing `plugins enable <filename>` or by restarting the bot.

##For Developers
Want to write your own Plugin for the bot? That's great!
Easiest is to check existing plugins on how they are written, but you can also check the Wiki of this repository, it should give all the information you should need. I'll also provide a plugin template which you can use.
Make sure that your plugin has the file extension `.pbot.js`.

Wanna work on the bot itself? Go ahead and fork the repository, make your changes and open a Pull Request back into here!

Got any other questions? [Join the Gitter Channel of the bot](https://gitter.im/Wolvan/PicartoChatBot), I should be available there most of the time.
