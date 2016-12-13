'use strict'

const CommandModule = require('../CommandModule')
const logger = require('../logger')
const Common = require('../common')
const numeral = require('numeral')
const moment = require('moment')
const request = require('request')
const deferred = require('deferred')
const cachedRequest = require('cached-request')(request)
const MessageEmbed = require('./lib/MessageEmbed')

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

    Message (message) {
        return this.getHistory()
            .then(json => {
                const region = this.bot.config.warcraftlogs.region.toUpperCase()
                const data = json.update[region]
                const goldPerDayToPlayForFree = numeral(data.raw.buy / 30).format('0,0')
                const embed = new MessageEmbed('WoW Token Price Data')

                embed.color = 3447003
                embed.timestamp = moment.unix(data.raw.updated).toDate()

                embed.addField('Current Price', data.formatted.buy, true)
                embed.addField('24h Range', data.formatted['24min'] + ' - ' + data.formatted['24max'], true)
                embed.addField('Sells Within', data.formatted.timeToSell, true)
                embed.addField('Play for Free', `Make about **${goldPerDayToPlayForFree}g** per day.`, true)

                embed.image = {
                    url: data.formatted.sparkurl
                }
                embed.provider = {
                    name: 'WoW Token Info',
                    url: 'https://wowtoken.info/'
                }

                return {
                    embed: {embed: embed}
                }
            })
    }
}

module.exports = (parent, config) => {
    return new TokenModule(parent, config)
}
