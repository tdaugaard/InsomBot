'use strict'

const CommandModule = require('../lib/CommandModule')
const Common = require('../lib/common')
const fs = require('fs')
const util = require('util')
const Mustache = require('mustache')
const UnTaggedResponse = require('./lib/Response/UnTagged')
const readFileAsync = util.promisify(fs.readFile)

class PromoteModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)
        
        this.addTrigger('!promote', {
            'short': 'Promotes a _Prospect_ to _Raider_ and notifies them via DM.',
            'params': [
                'discord_id'
            ]
        })

        this._loadMessage()
    }
    
    _renderMessage(msg, recipient) {
        const instigator = msg.channel.guild.members.get(msg.author.id)
        recipient = msg.channel.guild.members.get(recipient.id)

        const data = {
            "instigator": {
                "id": instigator.id,
                "name": instigator.nickname || instigator.user.username
            },
            "recipient": {
                "id": recipient.id,
                "name": recipient.nickname || recipient.user.username
            }
        }

        return Mustache.render(this._promoteMessage, data)
    }
    
    async _loadMessage() {
        try {
            this._promoteMessage = await readFileAsync('./modules/data/promote.msg', 'utf8')
        } catch (err) {
            console.log(err)
        }
    }

    async Message (message) {
        const params = this._getParams(message)

        if (!message.mentions.users.array().length) {
            const msg = this._renderMessage(message, message.author)
            message.author.send("This is the message that would be sent to the person being promoted:\n\n" + msg)
        }
        else {
            for (let [userId, user] of message.mentions.users) {
                const user = message.channel.guild.members.get(userId)
                if (!user.roles.find('name', 'Prospect')) {
                    console.log(user.user.username + " does not have the role 'Prospect'")
                    continue;
                }
                console.log(user.roles.array())

                //const msg = this._renderMessage(message, user)
                //message.author.send("This is the message that would be sent to the person being promoted:\n\n" + msg)
            }
         }

        return false
    }
}

module.exports = (parent, config) => {
    return new PromoteModule(parent, config)
}
