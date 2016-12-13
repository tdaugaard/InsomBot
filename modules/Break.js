'use strict'

const moment = require('moment')
const logger = require('../logger')
const Common = require('../common')
const CommandModule = require('../CommandModule')
const BreakTimer = require('./lib/BreakTimer')

class BreakModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.timers = {}

        this.addTrigger('!break', {
            'short': 'Set a break timer that will notify \\@here upon expiration.',
            'params': [
                'minutes'
            ]
        })

        this._loadTimers()
    }

    destructor () {
        for (const k of Object.keys(this.timers)) {
            logger.info(`BreakTimer: Saving break timer for channel #${this.timers[k].channel.name}`)
            this.bot.storage.setItemSync(`breaktimer_${k}`, this.timers[k].serialize())
        }
    }

    getHelp () {
        return 'This allows you to set a timer that, upon expiration, will notify \\@here. There can only be one timer per channel.' +
               '\nYou can cancel the timer by running `!break` without arguments.' +
               '\nIf the bot is restarted, the timer will expire immediately and will not resume when the bot is running again.'
    }

    _loadTimers () {
        this.bot.storage.valuesWithKeyMatch(/^breaktimer_/).forEach(timer => {
            logger.debug('→'.blue.bold + ` Restoring timer for channel #${timer.channel.name}, expires on ${moment(timer.end)}`)
            this.timers[timer.channel.id] = this._newTimer(timer.end, timer.author, timer.channel)
        })
    }

    _newTimer (end, author, channel) {
        return new BreakTimer(end, author, channel)
            .on('expire', this._timerExpired.bind(this))
    }

    _setTimer (msg, minutes) {
        const seconds = minutes * 60
        const end = moment().add(seconds, 'seconds')
        const timer = this.timers[msg.channel.id]

        if (timer) {
            timer.reset(end)
        } else {
            this.timers[msg.channel.id] = this._newTimer(end, msg.author, msg.channel)
        }

        return Promise.resolve({content: '@here ' + minutes + ' minute' + (minutes > 1 ? 's' : '') + ' break timer set.'})
    }

    _clearTimer (msg) {
        if (this.timers.hasOwnProperty(msg.channel.id)) {
            this._removeTimer(msg.channel.id)

            return Promise.resolve('break cancelled.')
        }

        return Promise.reject('no timer was set.')
    }

    _timerExpired (timer) {
        this._removeTimer(timer.channel.id)

        this.bot.sendChannelMessage(timer.channel.id, '@here break is over, get back to whatever you were doing!')
    }

    _removeTimer (channelId) {
        this.timers[channelId].stop()
        this.bot.storage.removeItem(`breaktimer_${channelId}`).catch(() => {})
        delete this.timers[channelId]
    }

    Message (message) {
        const params = this._getParams(message)
        const timeout = params.length ? parseInt(params[0]) : 0
        const timer = this.timers[message.channel.id]

        if (!params.length && timer) {
            const timeLeft = Common.relativeTime(moment(timer.end).diff(), true)
            return Promise.resolve(`there's ${timeLeft} left of the break.`)
        }

        if (isNaN(timeout) || timeout < 0) {
            return Promise.reject('Please enter positive number')
        }

        if (timeout === 0) {
            return this._clearTimer(message)
        }

        return this._setTimer(message, timeout)
    }
}

module.exports = (parent, config) => {
    return new BreakModule(parent, config)
}
