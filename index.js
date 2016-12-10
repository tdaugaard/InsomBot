'use strict'
var myself

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
        myself = discordjs.user

        logger.info('Ready to begin! Serving in %d channels as %s#%d',
            this.channels.array().length,
            myself.username,
            myself.discriminator
        )
    })

    .on('message', function (msg) {
        const channelType = msg.channel.type

        // We won't be processing our own messages.
        if (msg.author.username === myself.username && msg.author.discriminator === myself.discriminator) {
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

        bot.checkMessageForKeywords(msg.content)
            .then(keyword => {
                // Messages which aren't meant for the bot will simply be ignored.
                if (!keyword) {
                    return
                }

                var takesTooLongTimeout

                if (env.query_timeout > 0) {
                    takesTooLongTimeout = setTimeout(e => {
                        bot.replyMessage(msg, 'your query is taking a bit longer than anticipated, please wait while I get my shit together.')
                    }, parseInt(env.query_timeout) * 1000)
                }

                bot.runKeywordFunction(keyword, msg)
                    .then(reply => bot.replyMessage(msg, reply))
                    .catch(err => bot.replyMessage(msg, "that's a negative: " + err))
                    .then(() => clearTimeout(takesTooLongTimeout))
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
