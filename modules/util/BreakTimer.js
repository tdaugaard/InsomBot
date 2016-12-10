'use strict'

const moment = require('moment')

class BreakTimer {

    constructor (timeout, cb) {
        this.reset(timeout, cb)
    }

    reset (timeout, cb) {
        this.cb = cb

        this.start = moment()

        this.expires = this.start.add(timeout, 'second')
    }

    expired () {
        const isExpired = moment().isAfter(this.expires)

        if (isExpired) {
            Promise.resolve(this.cb()).catch(() => {})
        }

        return isExpired
    }

}

module.exports = BreakTimer
