'use strict'

const env = require('./config.json')
const winston = require('winston')
const moment = require('moment')
const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            'level': env.logger.level || 'warn',
            'timestamp': function (options) {
                return moment().format('dddd, MMMM Do YYYY, HH:mm:ss')
            }
        })
    ]
})

logger.cli()

module.exports = logger
