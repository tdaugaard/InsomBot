'use strict'

const moment = require('moment')

class BreakTimer {

    constructor (timeout, cb) {
        this.reset(timeout, cb)
    }

    reset (timeout, cb) {
        this.expires = moment().add(timeout, 'second')

        if (cb) {
            this.cb = cb
        }
    }

    expired () {
        const isExpired = moment().isAfter(this.expires)

        if (isExpired) {
            Promise.resolve(this.cb(this)).catch(() => {})
        }

        return isExpired
    }

}

module.exports = BreakTimer
