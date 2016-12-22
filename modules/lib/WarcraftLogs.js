'use strict'

const logger = require('../../logger')
const Common = require('../../common.js')
const deferred = require('deferred')
const async = require('async')
const difference = require('array-difference')

class WarcraftLogs {
    constructor (request, config) {
        this._req = request
        this._config = config
    }

    getListOfLogs () {
        const defer = deferred()
        const endpoint = 'https://www.warcraftlogs.com/v1/reports/guild/' + [this._config.guild, this._config.realm, this._config.region.toUpperCase()].join('/')

        this._req({
            url: endpoint,
            json: true,
            useQuerystring: true,
            ttl: 30000,
            time: true,
            qs: {'api_key': this._config.apiKey}
        }, (err, res, reports) => {
            Common.logRequestCompletion(logger, endpoint, err, res)

            if (!err && res.statusCode === 200) {
                defer.resolve(reports)
            } else {
                defer.reject(err)
            }
        })

        return defer.promise
    }

    fetchCombatReports (reports) {
        const defer = deferred()

        async.mapSeries(
            reports,
            this._getCombatReport.bind(this),
            (err, results) => {
                if (err) {
                    return defer.reject(err)
                }

                defer.resolve(results)
            }
        )

        return defer.promise
    }

    fetchCombatReportsOld (reports) {
        const defer = deferred()

        async.mapSeries(
            reports,
            this._getCombatReport.bind(this),
            (err, results) => {
                if (err) {
                    return defer.reject(err)
                }

                defer.resolve(results)
            }
        )

        return defer.promise
    }

    _getCombatReport (report, callback) {
        const endpoint = 'https://www.warcraftlogs.com/v1/report/fights/' + report.id

        this._req({
            url: endpoint,
            json: true,
            useQuerystring: true,
            ttl: 31536000000,
            timeout: 5000,
            time: true,
            qs: {'api_key': this._config.apiKey},
            agentOptions: {
                keepAlive: true
            }
        }, (err, res, details) => {
            if (!res) {
                console.log(endpoint + '?api_key=' + this._config.apiKey)
            }
            Common.logRequestCompletion(logger, endpoint, err, res)

            if (!err && res.statusCode === 200) {
                Object.assign(details, report)

                callback(null, details)
            } else {
                callback({error: report.id})
            }
        })
    }
}

module.exports = WarcraftLogs
