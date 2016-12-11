'use strict'

const CommandModule = require('../CommandModule')
const humanize = require('humanize')
const moment = require('moment')
const MessageEmbed = require('./util/MessageEmbed')
const os = require('os')

class SelfModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!self', {
            'short': 'Show details about the bot.'
        })
    }

    Message (message) {
        const embed = new MessageEmbed()
        const memoryUsage = process.memoryUsage()

        embed.color = 3447003

        embed.addField('Node.JS', process.version, true)
        embed.addField('OS', os.type() + ' (' + os.arch() + ')', true)

        embed.addField('Started', humanize.relativeTime(moment().unix() - process.uptime()), true)
        embed.addField('Memory Usage', humanize.filesize(memoryUsage.heapUsed), true)

        //embed.addField('Channels', this.bot.discord.channels.array().length, true)
        //embed.addField('Messages Processed', humanize.filesize(memoryUsage.heapUsed), true)

        return Promise.resolve({embed: {embed: embed}})
    }
}

module.exports = (parent, config) => {
    return new SelfModule(parent, config)
}
