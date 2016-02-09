var fs = require('fs'),
    irc = require('irc'),
    Gitter = require('node-gitter'),
    utilClass = require('./component/Util.js'),
    config = JSON.parse(fs.readFileSync('config.json'));

var util = new utilClass();

Object.keys(config).forEach(function(key) {
    var gitter = new Gitter(config[key].gitterToken);
    gitter.connectedChannels = {};
    var ircClient = new irc.Client(key, config[key].nickname, {
        channels: util.getIrcChannels(config[key])
    });

    /**
     * Setup Gitter
     */
    config[key].channels.forEach(function(item) {
        gitter.rooms.join(item.gitterChannel, function(err, room) {
            gitter.connectedChannels[item.ircChannel] = room;

            var events = room.streaming().chatMessages();

            events.on('chatMessages', function(message) {
                if(message.operation == 'create') {
                    try {
                        if(message.model.fromUser.username != config[key].gitterNickname) {
                            if (message.model.text.substring(0, config[key].gitterNickname.length) == config[key].gitterNickname) {
                                var order = message.model.text.split(":")[1];
                                switch (order) {
                                    case "userlist":
                                        var userList = "Users in " + item.ircChannel + "\r\n\t";
                                        var users = ircClient.chans[item.ircChannel].users;
                                        Object.keys(users).forEach(function(userKey) {
                                            userList += "[" + users[userKey] + "]" + userKey  + "\r\n\t";
                                            room.send(userList);
                                        });

                                        break;
                                    default:
                                        room.send("I don't know this command: " + order);
                                }

                            } else {
                                ircClient.say(item.ircChannel, message.model.text);
                            }
                        }
                    } catch(err) {
                        console.log(err);
                    }
                }
            });
        });
    });

    /**
     * Setup Irc
     */
    ircClient.addListener('message', function (from, to, message) {
        if(typeof gitter.connectedChannels[to] != 'undefined' && from != config[key].nickname) {
            gitter.connectedChannels[to].send(from + " : "  + message);
        }
    });

    /**
     * Private Messages
     */
    if(typeof config[key].gitterPmChannel != 'undefined') {
        var pmChannel;

        gitter.rooms.join(config[key].gitterPmChannel, function(err, room) {
            pmChannel = room;

            var events = room.streaming().chatMessages();

            events.on('chatMessages', function(message) {
                if(message.operation == 'create') {
                    try {
                        if(message.model.fromUser.username != config[key].gitterNickname) {
                            var splitText = message.model.text.split(':');
                            ircClient.say(splitText[0], splitText[1]);
                        }
                    } catch(err) {
                        console.log(err);
                    }
                }
            });
        });

        ircClient.addListener('pm', function (from, message) {
            pmChannel.send(from + ": " + message);
        });
    }
});