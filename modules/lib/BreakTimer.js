'use strict'

const moment = require('moment')
const EventEmitter = require('events').EventEmitter
const logger = require('../../logger')

class BreakTimer extends EventEmitter {
    constructor (end, author, channel) {
        super()

        this.timer = null
        this.author = author
        this.channel = {
            id: channel.id,
            name: channel.name
        }

        this.reset(+end)
    }

    reset (end) {
        const timeout = moment(end).diff()

        this.end = end

        this.stop().start(timeout)
    }

    start (timeout) {
        logger.debug(`BreakTimer: Starting timer of ${timeout} milliseconds for channel #${this.channel.name}`)
        this.timer = setTimeout(this._emitExpiration.bind(this), timeout)

        return this
    }

    stop () {
        if (this.timer) {
            logger.debug(`BreakTimer: Clearing timer for channel #${this.channel.name}`)
            clearTimeout(this.timer)
        }

        return this
    }

    _emitExpiration () {
        logger.debug(`BreakTimer: Timer expired for channel #${this.channel.name}`)
        this.emit('expire', this)
    }

    serialize () {
        return {
            end: this.end,
            author: this.author,
            channel: this.channel
        }
    }
}

module.exports = BreakTimer
