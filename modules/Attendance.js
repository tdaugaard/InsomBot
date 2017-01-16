'use strict'

const logger = require('../logger')
const CommandModule = require('../CommandModule')
const Common = require('../common.js')
const deferred = require('deferred')
const pad = require('pad')
const request = require('request')
const cachedRequest = require('cached-request')(request)
const sortBy = require('sort-by')
const Table = require('cli-table2')
const moment = require('moment')
const numeral = require('numeral')
const difference = require('array-difference')
const PlayerAttendance = require('./lib/PlayerAttendance')
const RaidAttendance = require('./lib/RaidAttendance')
const WarcraftLogs = require('./lib/WarcraftLogs')
const BossNameMatcher = require('./lib/BossNameMatcher')

class AttendanceModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.config = Object.assign(this.config, {
            'defaultNumRaids': 12
        })

        this.addTrigger('!att', {
            'short': 'Collect and display information about raid attendance from Warcraft Logs',
            'params': [
                'character (optional)',
                'raids = ' + this.config.defaultNumRaids
            ]
        })
        this.addTrigger('!kills', {
            'short': 'Collect and display information kills and wipes from Warcraft Logs',
            'params': [
                'boss (optional)',
                'raids = 100'
            ]
        })
        this.addTrigger('!alt', {
            'short': 'Map an alt character to a main',
            'params': [
                'alt_name',
                'main_name'
            ]
        })

        this.altsToMains = this._makeMainsToAltMapping(this.config.sameNameMapping)
        this._wcl = new WarcraftLogs(cachedRequest, {
            guild: this.bot.config.guild.name,
            realm: this.bot.config.guild.realm,
            region: this.bot.config.guild.region,
            apiKey: this.bot.config.guild.api.wcl
        })

        cachedRequest.setCacheDirectory(this.bot.config.cacheDirectory)
    }

    _makeMainsToAltMapping (mapping) {
        const altsToMain = {}

        Object.keys(mapping).forEach(main => {
            mapping[main].forEach(alt => {
                altsToMain[alt] = main
            })
        })

        return altsToMain
    }

    _makeAltToMainsMapping (alts) {
        const mapping = {}

        Object.keys(alts).forEach(alt => {
            if (!mapping.hasOwnProperty(alts[alt])) {
                mapping[alts[alt]] = []
            }

            mapping[alts[alt]].push(alt)
        })

        return mapping
    }

    _getReports (numberOfRaids) {
        return this._wcl.getListOfLogs()
            .then(reports => {
                if (numberOfRaids < reports.length) {
                    reports = reports.slice(-numberOfRaids)
                }

                return reports
            })
    }

    _collectAttendance (reports) {
        const attendance = new RaidAttendance(reports)

        for (const report of reports) {
            const fightIds = report.fights
                .filter(v => v.boss !== 0)
                .map(v => v.id)

            attendance.fights += fightIds.length
            attendance.raids.push({
                id: report.id,
                start: report.start,
                fights: fightIds.length
            })

            report.friendlies
                .filter(v => ['NPC', 'Boss', 'Pet'].indexOf(v.type) === -1)
                .forEach(v => {
                    const name = this._resolveCharacterName(v.name)

                    if (attendance.characterNames.indexOf(v.name) === -1) {
                        attendance.characterNames.push(v.name)
                    }

                    if (!attendance.players.hasOwnProperty(name)) {
                        attendance.players[name] = new PlayerAttendance({
                            firstAttendance: report.start,
                            firstReport: report.id,
                            name: name
                        })
                    }

                    const player = attendance.players[name]

                    if (player.raids.ids.indexOf(report.id) === -1) {
                        player.raids.ids.push(report.id)
                    }

                    if (report.start < player.firstAttendance) {
                        player.firstAttendance = report.start
                    }

                    player.lastAttendance = report.start
                    player.fights.num += v.fights.filter(v => fightIds.indexOf(v.id) !== -1).length
                })
        }

        return this._aggregateAttendance(attendance)
    }

    _filterSpecificCharacter (character, attendance) {
        const players = []

        character = character.toLowerCase()

        for (const player of Common.objectIterator(attendance.players)) {
            if (player.name.toLowerCase().indexOf(character) === 0) {
                players.push(player)
            }
        }

        attendance.players = players

        return attendance
    }

    _aggregateAttendance (attendance) {
        for (const player of Common.objectIterator(attendance.players)) {
            const possibleReports = this._getPossibleReports(attendance, player)

            player.raids.possible = possibleReports.raids.length
            player.raids.num = player.raids.ids.length
            player.raids.pct = (player.raids.num * 100) / possibleReports.raids.length
            player.fights.pct = (player.fights.num * 100) / possibleReports.fights
            player.raids.missed = difference(possibleReports.raids, player.raids.ids)
        }

        return attendance
    }

    _getPossibleReports (attendance, player) {
        const possibleReports = {
            raids: [],
            fights: 0
        }

        attendance.raids.forEach(raid => {
            if (raid.start >= player.firstAttendance) {
                possibleReports.raids.push(raid.id)
                possibleReports.fights += raid.fights
            }
        })

        return possibleReports
    }

    _resolveCharacterName (name) {
        return this.altsToMains.hasOwnProperty(name) ? this.altsToMains[name] : name
    }

    _getRaidZones () {
        const defer = deferred()
        const endpoint = `https://${this._guild.region}.api.battle.net/wow/zone/?locale=en_GB&apikey=${this._guild.api.blizzard}`

        this._creq({
            url: endpoint,
            json: true,
            ttl: 3600 * 1000,
            time: true
        }, (err, res, body) => {
            Common.logRequestCompletion(logger, endpoint, err, res)

            if (err || res.statusCode !== 200) {
                return defer.reject(err)
            }

            const zones = {}
            for (const zone of body.zones) {
                if (!zone.isRaid) {
                    continue
                }

                zones[zone.id] = zone.name
            }

            defer.resolve(zones)
        })
    }

    _getSameNameAlsoKnownAs (attendees) {
        const players = {}
        const names = []

        for (const name of Object.keys(this.altsToMains)) {
            if (attendees.indexOf(this.altsToMains[name]) === -1) {
                continue
            }

            if (!players.hasOwnProperty(this.altsToMains[name])) {
                players[this.altsToMains[name]] = []
            }

            players[this.altsToMains[name]].push(name)
        }

        for (const name of Object.keys(players)) {
            names.push(' - __' + name + '__ also attended as _' + players[name].join('_, _') + '_')
        }

        return names.join('\n')
    }

    _getAlsoAttendedOnAlts (attendees) {
        const players = []

        for (const name of Object.keys(this.altsToMains)) {
            const resolvedName = this.altsToMains[name]

            if (attendees.indexOf(resolvedName) === -1) {
                continue
            }

            if (players.indexOf(resolvedName) === -1) {
                players.push(resolvedName)
            }
        }

        return players
    }

    _assembleAttendanceData (attendance) {
        const table = new Table({
            head: ['Character', 'Raids', 'Fights'],
            chars: { 'top': '', 'top-mid': '', 'top-left': '', 'top-right': '', 'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '', 'left': '', 'left-mid': '', 'mid': '─', 'mid-mid': '┼', 'right': '', 'right-mid': '', 'middle': '|' },
            colAligns: ['left', 'right', 'right'],
            style: {
                head: [],
                border: [],
                compact: true
            }
        })
        const attendedOnAlts = this._getAlsoAttendedOnAlts(attendance.characterNames)
        let players = []
        let out = ''
        let plusThisManyMore = 0

        for (const player of Common.objectIterator(attendance.players)) {
            players.push(player)
        }

        const numberOfActivePlayers = players.length

        players.sort(sortBy('-raids.pct', '-raids.num', '-fights.pct', '-fights.num'))
        if (players.length > 30) {
            plusThisManyMore = players.length - 25
            players = players.slice(0, 25)
        }

        players.forEach(v => {
            table.push([
                v.name,
                v.raids.num + ' of ' + pad(3, v.raids.possible) + ' (' + pad(4, Math.round(v.raids.pct) + '%') + ')',
                numeral(v.fights.num).format('0,0') + ' (' + pad(4, Math.round(v.fights.pct) + '%') + ')'
            ])
        })

        out += `${numberOfActivePlayers} active players' attendance of the past **${attendance.raids.length}** raids (_${numeral(attendance.fights).format('0,0')} fights_)\n`
        out += '```\n'
        out += table.toString() + '\n'

        if (plusThisManyMore > 0) {
            out += ' … and ' + plusThisManyMore + ' more not shown.'
        }

        out += '\n```'
        if (attendedOnAlts.length) {
            out += '\n_' + attendedOnAlts.join('_, _') + '_ also attended on alts, which _has_ been taken into account.'
        }

        return {content: out}
    }

    _filterInactiveMembers (attendance) {
        if (!this.config.hasOwnProperty('filterInactive')) {
            return attendance
        }

        const notBefore = moment().subtract(this.config.filterInactive, 'days')
        const filteredPlayers = {}

        for (const player of Common.objectIterator(attendance.players)) {
            const lastAttendance = moment(player.lastAttendance)

            if (lastAttendance.isBefore(notBefore)) {
                continue
            }

            filteredPlayers[player.name] = player
        }

        attendance.players = filteredPlayers
        attendance.filtered = Object.keys(filteredPlayers).length

        return attendance
    }

    _manageAlts (params) {
        if (params.length !== 2) {
            return Promise.reject('Insufficient arguments given.')
        }

        const [alt, main] = params
        const performUnmapping = main === 'null'

        if (this.config.sameNameMapping.hasOwnProperty(alt)) {
            return Promise.reject(`cannot ${performUnmapping ? 'un' : ''}map a main as an alt. _${alt}_ is main of _${this.config.sameNameMapping[alt].join('_, _')}_`)
        }

        if (performUnmapping) {
            if (!this.altsToMains.hasOwnProperty(alt)) {
                return Promise.reject(`'${alt}' is already unmapped.`)
            }

            delete this.altsToMains[alt]

            this.config.sameNameMapping = this._makeAltToMainsMapping(this.altsToMains)
            this.bot.updateConfig()

            return Promise.resolve(`okay, '${alt}' is unmapped.`)
        }

        if (this.altsToMains.hasOwnProperty(alt)) {
            return Promise.reject(`'${alt}' is already mapped to '${this.altsToMains[alt]}'`)
        }

        if (this.config.sameNameMapping.hasOwnProperty(main)) {
            this.config.sameNameMapping[main].push(alt)
        } else {
            this.config.sameNameMapping[main] = [alt]
        }

        this.altsToMains = this._makeMainsToAltMapping(this.config.sameNameMapping)

        return Promise.resolve(`okay, '${alt}' is now mapped to '${main}'.`)
    }

    _getArguments (params) {
        const myParams = params.slice(0)
        const args = {
            character: null,
            numberOfRaids: this.config.defaultNumRaids
        }

        if (!/^\d+$/.test(myParams[0])) {
            args.character = myParams.shift()
        }

        args.numberOfRaids = Common.getIntegerBetween(myParams.shift(), {min: 1, default: this.config.defaultNumRaids})

        return args
    }

    _assembleSimpleAttendanceData (character, attendance) {
        if (!attendance.players.length) {
            return {content: `No players found matching _${character}_.`}
        }

        let out = ''

        attendance.players.sort(sortBy('-raids.pct', '-raids.num', '-fights.pct', '-fights.num'))

        if (attendance.players.length > 1) {
            const thisManyPlayers = attendance.players.length > 2 ? attendance.players.length : 'both'
            out += `Your query matched more than one player, showing attendance for ${thisManyPlayers}.\n\n`
        }

        while (player = attendance.players.shift()) {
            out += `**${player.name}** has attended **${player.raids.num}** of **${player.raids.possible}** (**${Math.round(player.raids.pct)}%**) possible raids of the past **${attendance.raids.length}** raids.\n`
        }

        return {content: out}
    }

    _getKillCounts (bossNames, reports) {
        const bossMatcher = new BossNameMatcher(bossNames)
        const bosses = {}
        const difficulties = {
            3: 'Normal',
            4: 'Heroic',
            5: 'Mythic'
        }
        let bossFightsFound = 0

        for (const report of reports) {
            for (const fight of report.fights) {
                if (fight.boss === 0 || !bossMatcher.match(fight.name)) {
                    continue
                }
                ++bossFightsFound

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
                        bosses[fight.name][difficulty].firstKill = report.start + fight.start_time
                    }

                    ++bosses[fight.name][difficulty].kills
                } else if (fight.bossPercentage > 0 && !bosses[fight.name][difficulty].kills) {
                    ++bosses[fight.name][difficulty].wipes
                }
            }
        }

        if (!bossFightsFound) {
            return Promise.reject('no bosses found matching that text.')
        }

        return bosses
    }

    _assembleKillCounts (bosses) {
        let str = ''

        for (const boss of Object.keys(bosses)) {
            str += `**${boss}**\n`

            for (const difficulty of Object.keys(bosses[boss])) {
                const stats = bosses[boss][difficulty]

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

        return {content: str}
    }

    Message (message) {
        const params = this._getParams(message)
        const args = this._getArguments(params)
        const trigger = this._getTrigger(message)

        if (trigger === 'alt') {
            return this._manageAlts(params)
        }

        if (trigger === 'kills') {
            if (!params.length) {
                return Promise.reject('which boss?')
            }

            return this._getReports(120)
                .then(this._wcl.fetchCombatReports.bind(this._wcl))
                .then(this._getKillCounts.bind(this, params))
                .then(this._assembleKillCounts.bind(this))
        }

        if (trigger === 'att') {
            const promise = this._getReports(args.numberOfRaids)
                .then(this._wcl.fetchCombatReports.bind(this._wcl))
                .then(this._collectAttendance.bind(this))

            if (args.character) {
                return promise
                    .then(this._filterSpecificCharacter.bind(this, args.character))
                    .then(this._assembleSimpleAttendanceData.bind(this, args.character))
            }

            return promise
                .then(this._filterInactiveMembers.bind(this))
                .then(this._assembleAttendanceData.bind(this))
        }
    }
}

module.exports = (parent, config) => {
    return new AttendanceModule(parent, config)
}
