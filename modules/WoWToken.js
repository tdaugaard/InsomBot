'use strict'

const CommandModule = require('../lib/CommandModule')
const logger = require('../lib/logger')
const Common = require('../lib/common')
const numeral = require('numeral')
const moment = require('moment')
const deferred = require('deferred')
const request = require('request')
const cachedRequest = require('cached-request')(request)
const RichEmbed = require('discord.js').RichEmbed
const EmbedResponse = require('./lib/Response/Embed')

class WoWTokenModule extends CommandModule {
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

        const response = cachedRequest({
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

    async Message (message) {
        try {
            const history = await this.getHistory()

            const region = this.bot.config.guild.region.toUpperCase()
            const data = history.update[region]
            const goldPerDayToPlayForFree = numeral(data.raw.buy / 30).format('0,0')
            const embed = new RichEmbed({color: 3447003})

            embed
                .setTimestamp(moment.unix(data.raw.updated).toDate())

                .addField('Current Price', data.formatted.buy, true)
                .addField('24h Range', data.formatted['24min'] + ' - ' + data.formatted['24max'], true)
                .addField('Sells Within', data.formatted.timeToSell, true)
                .addField('Play for Free', `Make about **${goldPerDayToPlayForFree}g** per day.`, true)

                .setImage(data.formatted.sparkurl)
                .setFooter('http://wowtoken.info/')
                .setThumbnail('https://wow.zamimg.com/images/wow/icons/large/wow_token01.jpg')

            return new EmbedResponse(embed)
        } catch (err) {
            throw 'I\'m unable to get WoW Token price data at this time: ' + err.code
        }
    }
}

module.exports = (parent, config) => {
    return new WoWTokenModule(parent, config)
}
