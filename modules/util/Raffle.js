'use strict'

const moment = require('moment')
const BreakTimer = require('./BreakTimer')

class Raffle extends BreakTimer {
    constructor (cb, about) {
        super(86400, cb)

        this.author = {}
        this.channel = {}
        this.rolls = {}
        this.about = about
    }

    setAuthor (author) {
        this.author = author
    }

    setChannel (channel) {
        this.channel = {
            id: channel.id,
            name: channel.name
        }
    }

    addRoll (user, dice) {
        if (this.getRoll(user)) {
            throw new Error('User already rolled; this shouldn\'t happen.')
        }

        this.rolls[user.id] = {
            user: user,
            time: new Date(),
            dice: dice
        }
    }

    getRoll (user) {
        if (user) {
            if (!this.rolls.hasOwnProperty(user.id)) {
                return false
            }

            return this.rolls[user.id]
        }

        return this.rolls
    }
}

module.exports = Raffle
