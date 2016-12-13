'use strict'

const env = require('./config.json')
const DiscordBot = require('./bot.js')
const Discord = require('discord.js')
const logger = require('./logger.js')

logger.info('Connecting to Discord.')

const discordjs = new Discord.Client()
let bot
let attemptedExit = false

process
    .on('SIGTERM', terminateProcess)
    .on('SIGINT', exitHandler)
    .on('uncaughtException', r => logger.error(r))

function terminateProcess () {
    logger.info('Terminating.')

    discordjs.destroy()
    process.exit(0)
}

function exitHandler () {
    if (attemptedExit) {
        logger.error('Unclean shutdown, but forcing as requested.')
        process.exit(0)
        return
    }

    attemptedExit = true
    setTimeout(() => { attemptedExit = false }, 5000)

    bot.destroy()
    discordjs.destroy()

    logger.info('Shutting down.')
    process.exit(0)
}

discordjs
    .on('ready', function () {
        logger.info('Connected! Serving in %d channels as %s#%d',
            this.channels.array().length,
            this.user.username,
            this.user.discriminator
        )

        bot = new DiscordBot(env, this)
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
