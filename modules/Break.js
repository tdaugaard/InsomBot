'use strict'

const numeral = require('numeral')
const colors = require('colors')
const logger = require('../logger')
const Common = require('../common')
const CommandModule = require('../CommandModule')
const BreakTimer = require('./util/BreakTimer')

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

        this._checkTimers()
    }

    destructor () {
        const numberOfTimers = Object.keys(this.timers).length

        if (!numberOfTimers) {
            return
        }

        logger.info('Expiring ' + colors.green.bold(numberOfTimers) + ' active timers.')

        Common.objectIterator(timer => {
            timer.expire()
        })
    }

    _checkTimers () {
        for (const k of Object.keys(this.timers)) {
            if (this.timers[k].expired()) {
                delete this.timers[k]
            }
        }

        setTimeout(this._checkTimers.bind(this), 1000)
    }

    getHelp () {
        return 'This allows you to set a timer that, upon expiration, will notify \\@here. There can only be one timer per channel.' +
               '\nYou can cancel the timer by running `!break` without arguments.' +
               '\nIf the bot is restarted, the timer will expire immediately and will not resume when the bot is running again.'
    }

    _setTimer (msg, minutes) {
        const seconds = minutes * 60
        const channelHasTimer = this.timers.hasOwnProperty(msg.channel.id)
        const expireCallback = this._timerExpired.bind(this, msg)

        if (channelHasTimer) {
            this.timers[msg.channel.id].reset(seconds, expireCallback)
        } else {
            this.timers[msg.channel.id] = new BreakTimer(seconds, expireCallback)
        }

        return Promise.resolve('@here ' + minutes + ' minute' + (minutes > 1 ? 's' : '') + ' break timer set.')
    }

    _clearTimer (msg) {
        if (this.timers.hasOwnProperty(msg.channel.id)) {
            delete this.timers[msg.channel.id]

            return Promise.resolve('@here break timer reset.')
        }

        return Promise.reject('no timer was set.')
    }

    _timerExpired (msg) {
        this.bot.sendReply(msg, '@here break is over, get back to whatever you were doing!')
    }

    Message (message) {
        const params = this._getParams(message)
        const timeout = params.length ? parseInt(params[0]) : 0

        if (isNaN(timeout) || timeout < 0) {
            return Promise.reject('Please enter positive number')
        }

        if (!timeout) {
            return this._clearTimer(message)
        }

        return this._setTimer(message, timeout)
    }
}

module.exports = (parent, config) => {
    return new BreakModule(parent, config)
}
