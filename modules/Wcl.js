'use strict'

const CommandModule = require('../CommandModule')
const logger = require('../logger')
const Common = require('../common')
const request = require('request')
const deferred = require('deferred')
const cachedRequest = require('cached-request')(request)
const moment = require('moment')

class WclModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!wcl', {
            'short': 'Display latest Warcraft Logs reports',
            'params': [
                'num_reports = 3'
            ]
        })

        cachedRequest.setCacheDirectory(this.bot.config.cacheDirectory)
    }

    getReports () {
        const defer = deferred()
        const endpoint = 'https://www.warcraftlogs.com/v1/reports/guild/' + [this.bot.config.warcraftlogs.guild, this.bot.config.warcraftlogs.realm, this.bot.config.warcraftlogs.region].join('/')

        cachedRequest({
            url: endpoint,
            json: true,
            useQuerystring: true,
            ttl: 30000,
            qs: {'api_key': this.bot.config.warcraftlogs.key}
        }, (err, res, body) => {
            Common.logRequestCompletion(logger, endpoint, err, res)

            if (!err && res.statusCode === 200) {
                defer.resolve(body)
            } else {
                defer.reject(err)
            }
        })

        return defer.promise
    }

    Message (message) {
        const params = this._getParams(message)
        const recentTime = moment().subtract(3, 'days').valueOf()

        return this
            .getReports()
            .then(reports => {
                const numberOfReports = Common.getIntegerBetween(params[0], {min: 1, max: 10, default: 3})
                let out = "here's the " + numberOfReports + ' most recent reports:\n\n'

                reports.slice(-numberOfReports).forEach(v => {
                    const time = moment(v.start).format(this.bot.date.human)
                    if (v.start >= recentTime) {
                        out += ':new: '
                    }

                    out += '**' + v.title + '** (_' + time + '_)\n'
                    out += 'https://www.warcraftlogs.com/reports/' + v.id + '\n\n'
                })

                return out
            })
    }
}

module.exports = (parent, config) => {
    return new WclModule(parent, config)
}
