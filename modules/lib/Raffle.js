'use strict'

const moment = require('moment')
const BreakTimer = require('./BreakTimer')

class Raffle extends BreakTimer {
    constructor (about, author, channel) {
        super(moment().add(1, 'day'), author, channel)

        this.ending = false
        this.announceMessageId = null
        this.rolls = {}
        this.about = about
    }

    restore (data) {
        Object.assign(this, data)

        this.reset(this.end)

        return this
    }

    endRaffle (gracePeriod) {
        if (this.ending) {
            return
        }

        this.ending = true
        if (gracePeriod) {
            this.reset(moment().add(gracePeriod, 'minutes'))
        } else {[
            this.reset(0)
        ]}
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

        return this
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

    serialize () {
        return Object.assign(super.serialize(), {
            announceMessageId: this.announceMessageId,
            ending: this.ending,
            rolls: this.rolls,
            about: this.about
        })
    }
}

module.exports = Raffle
