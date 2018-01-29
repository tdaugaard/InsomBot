'use strict'

const CommandModule = require('../lib/CommandModule')
const logger = require('../lib/logger')
const Common = require('../lib/common')
const request = require('request')
const deferred = require('deferred')
const cachedRequest = require('cached-request')(request)
const moment = require('moment')
const UntaggedResponse = require('./lib/Response/UnTagged');
const RichEmbed = require('discord.js').RichEmbed

class WclModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!wcl', {
            'short': 'Display latest Warcraft Logs reports',
            'params': [
                'num_reports = 1'
            ]
        })

        cachedRequest.setCacheDirectory(this.bot.config.cacheDirectory)
    }

    getReports () {
        const defer = deferred()
        const endpoint = 'https://www.warcraftlogs.com/v1/reports/guild/' + [this.bot.config.guild.name, this.bot.config.guild.realm, this.bot.config.guild.region.toUpperCase()].join('/')

        cachedRequest({
            url: endpoint,
            json: true,
            useQuerystring: true,
            ttl: 30000,
            qs: {'api_key': this.bot.config.guild.api.wcl}
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
        const params = this._getParams(message)
        const recentTime = moment().subtract(3, 'days').valueOf()

        const reports = await this.getReports()
        const numberOfReports = Common.getIntegerBetween(params[0], {min: 1, max: 10, default: 1})

        if (numberOfReports > 1) {
            const embed = new RichEmbed({color: 3447003})

            embed
                .setTitle('Warcraft Logs Combat Reports')
                .setURL('http://warcraftlogs.com/')
                .attachFile('https://i.yais.dk/XBshWd.png')

            reports.slice(-numberOfReports).forEach(v => {
                const time = moment(v.start).format(this.bot.config.date.human)
                const prefix = v.start >= recentTime ? ':new: ' : ''

                embed.addField(time, `${prefix}[${v.title}](https://www.warcraftlogs.com/reports/${v.id}) (${v.id})`)
            })

            return embed
        }

        const report = reports.pop();
        const time = moment(report.start).format(this.bot.config.date.human);

        return new UntaggedResponse(`${time}: **${report.title}** (https://www.warcraftlogs.com/reports/${report.id})`);
    }
}

module.exports = (parent, config) => {
    return new WclModule(parent, config)
}
