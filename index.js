'use strict'

const env = require('./config.json')
const DiscordBot = require('./bot.js')
const Discord = require('discord.js')
const logger = require('./lib/logger.js')

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

function loginError (err) {
    logger.error(err.toString())
    process.exit(-1)
}

function stopTypingInChannel (msg) {
    if (msg.channel.typing) {
        logger.debug('Stop typing in ' + bot.getChannelString(msg.channel))
        msg.channel.stopTyping()
    }
}

discordjs
    .on('ready', function () {
        logger.info('Connected! Serving in %d channels as %s#%d',
            this.channels.array().length,
            this.user.username,
            this.user.discriminator
        )

        if (!bot) {
            bot = new DiscordBot(env, this)
                .on('begin', msg => {
                    if (!msg.channel.typing) {
                        logger.debug('Start typing in ' + bot.getChannelString(msg.channel))
                        msg.channel.startTyping()
                    }
                })
                .on('end', msg => {
                    stopTypingInChannel(msg)
                })
        }
    })

    .on('message', async function (msg) {
        const channelType = msg.channel.type

        // We won't be processing our own messages.
        if (msg.author.username === this.user.username && msg.author.discriminator === this.user.discriminator) {
            return
        }

        if (channelType === 'dm') {
            if (env.discord.debugChannel) {
                const channel = discordjs.channels.find('name', env.discord.debugChannel)
                if (channel) {
                    bot.sendChannelMessage(channel.id, msg.author + ` sent direct message to the bot: __${msg.content}__`)
                }
            }

            bot.sendReply(msg, "Sorry, I can't process commands by direct messages.")
            return
        }

        // Bot accounts do not have a 'member' property so let's ignore them.
        if (!msg.hasOwnProperty('member') || !msg.member) {
            return
        }

        // Users with no roles (except @everyone) are not allowed to use the bot.
        if (env.hasOwnProperty('allowed') && env.allowed === 'members' && msg.member.roles.length === 0) {
            return
        }

        try {
            await bot.processMessage(msg)
        } catch (err) {
            logger.error(err)
        }
    })

    .on('disconnected', function () {
        logger.error('Disconnected.')
        process.exit(1)
    })

    .login(env.discord.token)
    .catch(loginError)
