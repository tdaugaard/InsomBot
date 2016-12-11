'use strict'

const env = require('./config.json')
const DiscordBot = require('./bot.js')
const Discord = require('discord.js')
const logger = require('./logger.js')
const discordjs = new Discord.Client()
const bot = new DiscordBot(env, discordjs)

process
    .on('SIGINT', exitHandler)
    .on('exit', exitHandler)
    .on('uncaughtException', r => logger.error(r))

function exitHandler () {
    logger.info('Shutting down.')

    discordjs.destroy()
    process.exit(0)
}

discordjs
    .on('ready', function () {
        logger.info('Ready to begin! Serving in %d channels as %s#%d',
            this.channels.array().length,
            this.user.username,
            this.user.discriminator
        )
    })

    .on('message', function (msg) {
        const channelType = msg.channel.type

        // We won't be processing our own messages.
        if (msg.author.username === this.user.username && msg.author.discriminator === this.user.discriminator) {
            return
        }

        if (channelType === 'dm') {
            bot.replyMessage(msg, "Sorry, I can't process commands by direct messages.")
            return
        }

        // Users with no roles (except @everyone) are not allowed to use the bot.
        if (env.hasOwnProperty('allowed') && env.allowed === 'members' && msg.member.roles.length === 0) {
            return
        }

        // msg.channel.startTyping()

        //discordjs.startTyping(msg.channel)

        bot.processMessage(msg)
            .then(bot.sendReply.bind(bot, msg))
            //.then(discordjs.stopTyping(msg.channel))
            .catch(err => {
                //discordjs.stopTyping(msg.channel)
                // msg.channel.stopTyping()

                if (err) {
                    bot.sendReply(msg, err)
                }
            })

    })

    .on('disconnected', function () {
        logger.error('Disconnected.')
        process.exit(1)
    })

if (env.discord.hasOwnProperty('token')) {
    discordjs.login(env.discord.token)
} else {
    discordjs.login(env.discord.email, env.discord.password)
}
