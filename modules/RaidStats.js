'use strict'

const logger = require('../lib/logger')
const CommandModule = require('../lib/CommandModule')
const Common = require('../lib/common')
const request = require('request')
const cachedRequest = require('cached-request')(request)
const moment = require('moment')
const WarcraftLogs = require('./lib/WarcraftLogs')
const BossNameMatcher = require('./lib/BossNameMatcher')
const UnTaggedResponse = require('./lib/Response/UnTagged')
const async = require('async')

class RaidStatsModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.config = Object.assign(this.config, {
            'defaultNumRaids': 12
        })

        this.addTrigger('!kills', {
            'short': 'Collect and display information about kills and wipes from Warcraft Logs',
            'params': [
                'boss (optional)'
            ]
        })
        this.addTrigger('!knw', {
            'short': 'Collect and display a timeline of kills and wipes from Warcraft Logs',
            'params': [
                'boss'
            ]
        })

        this._wcl = new WarcraftLogs(cachedRequest, {
            guild: this.bot.config.guild.name,
            realm: this.bot.config.guild.realm,
            region: this.bot.config.guild.region,
            apiKey: this.bot.config.guild.api.wcl
        })

        cachedRequest.setCacheDirectory(this.bot.config.cacheDirectory)
    }

    _getKillCountEx (bossNames, current, report) {
        const bossMatcher = new BossNameMatcher(bossNames)
        const bosses = Object.assign({}, current)
        const difficulties = {
            3: 'Normal',
            4: 'Heroic',
            5: 'Mythic'
        }
        let hadMatchingBossFights = false

        for (const fight of report.fights) {
            if (fight.boss === 0 || !bossMatcher.match(fight.name)) {
                continue
            }

            hadMatchingBossFights = true

            const difficulty = difficulties[fight.difficulty]

            if (!bosses.hasOwnProperty(fight.name)) {
                bosses[fight.name] = {}
            }
            if (!bosses[fight.name].hasOwnProperty(difficulty)) {
                bosses[fight.name][difficulty] = {
                    'firstKill': 0,
                    'kills': 0,
                    'wipes': 0
                }
            }

            if (fight.kill) {
                if (!bosses[fight.name][difficulty].kills) {
                    bosses[fight.name][difficulty].firstKill = report.start + fight.start_time;
                }

                ++bosses[fight.name][difficulty].kills;
            } else if (fight.bossPercentage > 0 && !bosses[fight.name][difficulty].kills) {
                ++bosses[fight.name][difficulty].wipes;
            }
        }

        if (!hadMatchingBossFights) {
            throw 'no bosses found matching that text.'
        }

        return bosses
    }

    _getWipeCount (bossNames, current, report) {
        const bossMatcher = new BossNameMatcher(bossNames)
        const bosses = Object.assign({}, current)
        const difficulties = {
            3: 'Normal',
            4: 'Heroic',
            5: 'Mythic'
        }
        let hadMatchingBossFights = false

        for (const fight of report.fights) {
            if (fight.boss === 0 || !bossMatcher.match(fight.name)) {
                continue
            }

            hadMatchingBossFights = true

            const difficulty = difficulties[fight.difficulty]

            if (!bosses.hasOwnProperty(fight.name)) {
                bosses[fight.name] = {}
            }
            if (!bosses[fight.name].hasOwnProperty(difficulty)) {
                bosses[fight.name][difficulty] = []
            }

            let eventType
            if (fight.kill) {
                eventType = 'kill';
            } else if (fight.bossPercentage > 0 && (fight.end_time - fight.start_time) > 10) {
                eventType = 'wipe';
            }

            if (!eventType) {
                continue;
            }

            if (bosses[fight.name][difficulty].length) {
                const currentIndex = bosses[fight.name][difficulty].length - 1;

                if (bosses[fight.name][difficulty][currentIndex].type === eventType) {
                    ++bosses[fight.name][difficulty][currentIndex].value;
                    continue;
                }
            }

            bosses[fight.name][difficulty].push({type: eventType, value: 1});
        }

        if (!hadMatchingBossFights) {
            throw 'no bosses found matching that text.'
        }

        return bosses
    }

    _assembleWipeCounts (params, reports) {
        let str = '', bossKills;

        for (const report of reports) {
            bossKills = this._getWipeCount(params, bossKills, report);
        }

        for (const boss of Object.keys(bossKills)) {
            str += `**${boss}**\n`;

            for (const difficulty of Object.keys(bossKills[boss])) {
                const stats = bossKills[boss][difficulty];
                const timeline = [];

                str += `  _${difficulty}_: `;

                for (const item of stats) {
                    timeline.push(item.value + ' ' + item.type + (item.value > 1 ? 's' : ''));
                }

                str += timeline.join(', ') + '\n';
            }
        }

        console.log(str);

        return new UnTaggedResponse(str)
    }
 
    _assembleKillCounts (params, reports) {
        let str = '', bossKills = {};

        for (const report of reports) {
            bossKills = this._getKillCountEx(params, bossKills, report);
        }

        for (const boss of Object.keys(bossKills)) {
            str += `**${boss}**\n`

            for (const difficulty of Object.keys(bossKills[boss])) {
                const stats = bossKills[boss][difficulty]

                str += `\n  _${difficulty}_: `
                if (stats.kills) {
                    str += `**${stats.kills}** kill${stats.kills > 1 ? 's' : ''}. `
                }

                if (stats.wipes) {
                    str += `**${stats.wipes}** wipe${stats.wipes > 1 ? 's' : ''}`
                    if (stats.kills) {
                        str += ` before first kill. `
                    } else {
                        str += '. '
                    }
                }

                if (stats.kills) {
                    str += `First kill on: **${moment(stats.firstKill).format(this.bot.config.date.human)}**`
                }
            }
            str += '\n\n'
        }

        return new UnTaggedResponse(str)
    }

    async _filterReportsWithBosses(params, reports) {
        const finalReports = [];
        let foundBossNames = false, bossNamesEnded = 0, reportsToTryAfterEnd = 20

        for (let report of reports.reverse()) {
            report = await this._wcl._getCombatReportPromise(report)

            try {
                this._getKillCountEx(params, {}, report);
                finalReports.push(report)

                foundBossNames = true;
                bossNamesEnded = 0;
            } catch (err) {
                if (foundBossNames) {
                    ++bossNamesEnded;
                }
            }

            if (foundBossNames && bossNamesEnded > reportsToTryAfterEnd) {
                break;
            }
        }

        if (foundBossNames && bossNamesEnded) {
            return Promise.resolve(finalReports.reverse());
        }

        return Promise.reject();
    }

    async Message (message) {
        const params = this._getParams(message)
        const trigger = this._getTrigger(message)

        if (!params.length) {
            throw 'which boss?'
        }

        if (trigger === 'kills') {
            return this._wcl.getListOfLogs()
                .then(this._filterReportsWithBosses.bind(this, params))
                .then(this._assembleKillCounts.bind(this, params));
        }

        if (trigger === 'knw') {
            return this._wcl.getListOfLogs()
                .then(this._filterReportsWithBosses.bind(this, params))
                .then(this._assembleWipeCounts.bind(this, params));
        }
    }
}

module.exports = (parent, config) => {
    return new RaidStatsModule(parent, config)
}
