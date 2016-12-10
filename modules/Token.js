'use strict'

const CommandModule = require('../CommandModule')
const logger = require('../logger')
const Common = require('../common')
const numeral = require('numeral')
const median = require('median')
const moment = require('moment')
const request = require('request')
const deferred = require('deferred')
const cachedRequest = require('cached-request')(request)

class TokenModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!token', {
            'short': 'Show the selling value of WoW Tokens for EU region.'
        })

        cachedRequest.setCacheDirectory(this.bot.config.cacheDirectory)
    }

    getHistory () {
        const defer = deferred()
        const endpoint = 'https://wowtoken.info/wowtoken.json'

        cachedRequest({
            url: endpoint,
            json: true,
            ttl: 1800 * 1000,
            time: true
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

    /*_getBestTimeEver(data) {
        let timeMap = {}

        data.forEach(v => {
            const [time, price] = v
            const hour = moment.unix(time).format('HH')

            if (!timeMap.hasOwnProperty(hour)) {
                timeMap[hour] = []
            }

            timeMap[hour].push(price)
        })

        for (const k of Object.keys(timeMap)) {
            timeMap[k] = median(timeMap[k])
        }

        return result = {
            buy: '',
            sell: ''
        }
    }*/

    Message (message) {
        const defer = deferred()

        this.getHistory()
            .then(json => {
                const region = this.bot.config.warcraftlogs.region.toUpperCase()
                const data = json.update[region]
                //const bestTimeEver = this._getBestTimeEver(json.history[region])
                const authorId = message.author.id
                const goldPerDayToPlayForFree = numeral(data.raw.buy / 30).format('0,0')
                const str = `<@${authorId}>, https://wowtoken.info/ reports that` +
                            ` on **${data.formatted.updated}**,` +
                            ` a token sold for **${data.formatted.buy}**` +
                            ` within **${data.formatted.timeToSell}**.` +
                            ` In the past 24 hours, the range was **${data.formatted['24min']} - ${data.formatted['24max']}**.` +
                            `\n\nAt the current rate, if you want to play for free, you need to make **~${goldPerDayToPlayForFree}g** per day.` +
                            `\n\nHere's the 24 hour history graph for WoW Tokens in ${region} region:`

                message.channel.sendFile(data.formatted.sparkurl, "WoWToken24hHistory.png", str)
                    .then(() => defer.resolve(false))
                    .catch(defer.reject)
            })
            .catch(defer.reject)

        return defer.promise
    }
}

module.exports = (parent, config) => {
    return new TokenModule(parent, config)
}
