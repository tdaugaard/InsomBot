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
const async = require('async')
const moment = require('moment')
const difference = require('array-difference')
const PlayerAttendance = require('./util/PlayerAttendance')
const RaidAttendance = require('./util/RaidAttendance')
const MessageEmbed = require('./util/MessageEmbed')

class AttendanceModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.config = Object.assign(this.config, {
            'defaultNumRaids': 12
        })

        this.addTrigger('!att', {
            'short': 'Collect and display information about raid attendance from Warcraft Logs',
            'params': [
                'raids = ' + this.config.defaultNumRaids
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

    _getReports (params) {
        const defer = deferred()
        const endpoint = 'https://www.warcraftlogs.com/v1/reports/guild/' + [this.bot.config.warcraftlogs.guild, this.bot.config.warcraftlogs.realm, this.bot.config.warcraftlogs.region].join('/')
        const numberOfRaids = Common.getIntegerBetween(params[0], {min: 1, default: this.config.defaultNumRaids})

        cachedRequest({
            url: endpoint,
            json: true,
            useQuerystring: true,
            ttl: 30000,
            time: true,
            qs: {'api_key': this.bot.config.warcraftlogs.key}
        }, (err, res, reports) => {
            Common.logRequestCompletion(logger, endpoint, err, res)

            if (!err && res.statusCode === 200) {
                if (numberOfRaids < reports.length) {
                    reports = reports.slice(-numberOfRaids)
                }

                this._collectAttendance(reports)
                    .then(defer.resolve)
                    .catch(defer.reject)
            } else {
                defer.reject(err)
            }
        })

        return defer.promise
    }

    _collectAttendance (reports) {
        const attendance = new RaidAttendance(reports)
        const defer = deferred()

        async.eachSeries(
            attendance.reports,
            this._getReportFights.bind(this, attendance),
            (err, result) => {
                if (err) {
                    return defer.reject(err)
                }

                defer.resolve(this._aggregateAttendance(attendance))
            }
        )

        return defer.promise
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
                possibleReports.raids.push(raid)
                possibleReports.fights += raid.fights
            }
        })

        return possibleReports
    }

    _getReportFights (attendance, report, callback) {
        const endpoint = 'https://www.warcraftlogs.com/v1/report/fights/' + report.id

        cachedRequest({
            url: endpoint,
            json: true,
            useQuerystring: true,
            ttl: 31536000000,
            timeout: 5000,
            time: true,
            qs: {'api_key': this.bot.config.warcraftlogs.key},
            agentOptions: {
                keepAlive: false
            }
        }, (err, res, details) => {
            Common.logRequestCompletion(logger, endpoint, err, res)

            if (!err && res.statusCode === 200) {
                const fightIds = details.fights
                    .filter(v => v.boss !== 0)
                    .map(v => v.id)

                attendance.fights += fightIds.length
                attendance.raids.push({
                    id: report.id,
                    start: report.start,
                    fights: fightIds.length
                })

                details.friendlies
                    .filter(v => ['NPC', 'Boss', 'Pet'].indexOf(v.type) === -1)
                    .forEach(v => {
                        const name = this._resolveCharacterName(v.name)

                        if (attendance.characterNames.indexOf(v.name) === -1) {
                            attendance.characterNames.push(v.name)
                        }

                        if (!attendance.players.hasOwnProperty(name)) {
                            attendance.players[name] = new PlayerAttendance({
                                firstAttendance: report.start,
                                name: name
                            })
                        }

                        if (attendance.players[name].raids.ids.indexOf(report.id) === -1) {
                            attendance.players[name].raids.ids.push(report.id)
                        }

                        if (report.start < attendance.players[name].firstAttendance) {
                            attendance.players[name].firstAttendance = report.start
                        }

                        attendance.players[name].lastAttendance = report.start
                        attendance.players[name].fights.num += v.fights.filter(v => fightIds.indexOf(v.id) !== -1).length
                    })

                callback()
            } else {
                callback({error: report.id})
            }
        })
    }

    _resolveCharacterName (name) {
        return this.altsToMains.hasOwnProperty(name) ? this.altsToMains[name] : name
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

    _getAttendanceTable (attendance) {
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
        let players = []

        for (const player of Common.objectIterator(attendance.players)) {
            players.push(player)
        }

        players.sort(sortBy('-raids.pct', '-raids.num', '-fights.pct', '-fights.num'))
        if (players.length > 25) {
            players = players.slice(0, 25)
        }

        players.forEach(v => {
            table.push([
                v.name,
                v.raids.num + ' of ' + pad(2, v.raids.possible) + ' (' + pad(4, Math.round(v.raids.pct) + '%') + ')',
                v.fights.num + ' (' + pad(4, Math.round(v.fights.pct) + '%') + ')'
            ])
        })

        return table
    }

    _assembleAttendanceData (attendance) {
        const table = this._getAttendanceTable(attendance)
        const attendedOnAlts = this._getAlsoAttendedOnAlts(attendance.characterNames)
        const plusThisManyMore = Object.keys(attendance.players).length - table.length
        const embed = new MessageEmbed(`Attendance situation for the past ${attendance.raids.length} raids (${attendance.fights} fights)`)

        embed.color = 3447003
        embed.addField('Attendance Table', '```' + table.toString() + '```')

        if (plusThisManyMore > 0) {
            // embed.addField()
            // out += ' … and ' + plusThisManyMore + ' more not shown.'
        }

        if (attendedOnAlts.length) {
            embed.setFooter('These players also attended on alts', '_' + attendedOnAlts.join('_, _') + '_')
        }

        return embed
    }

    _assembleAttendanceDataEx (attendance) {
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

        players.sort(sortBy('-raids.pct', '-raids.num', '-fights.pct', '-fights.num'))
        if (players.length > 25) {
            plusThisManyMore = players.length - 25
            players = players.slice(0, 25)
        }

        players.forEach(v => {
            table.push([
                v.name,
                v.raids.num + ' of ' + pad(2, v.raids.possible) + ' (' + pad(4, Math.round(v.raids.pct) + '%') + ')',
                v.fights.num + ' (' + pad(4, Math.round(v.fights.pct) + '%') + ')'
            ])
        })

        out += "here's the attendance situation for the past " + attendance.raids.length + ' raids (' + attendance.fights + ' fights)\n'
        out += '```\n'
        out += table.toString() + '\n'

        if (plusThisManyMore > 0) {
            out += ' … and ' + plusThisManyMore + ' more not shown.'
        }

        out += '\n```'
        if (attendedOnAlts.length) {
            out += '\n_' + attendedOnAlts.join('_, _') + '_ also attended on alts, which _has_ been taken into account.'
        }

        return out
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

    Message (message) {
        const params = this._getParams(message)
        const trigger = this._getTrigger(message)

        if (trigger === 'alt') {
            return this._manageAlts(params)
        }

        if (trigger === 'att') {
            return this
                ._getReports(params)
                .then(this._filterInactiveMembers.bind(this))
                .then(this._assembleAttendanceDataEx.bind(this))
        }

        if (trigger === 'attend') {
            const defer = deferred()

            this
                ._getReports(params)
                .then(this._filterInactiveMembers.bind(this))
                .then(this._assembleAttendanceData.bind(this))
                .then(embed => {
                    message.channel.sendMessage('', {embed: embed})
                        .then(() => {
                            defer.resolve(false)
                        })
                        .catch(defer.reject)
                })

            return defer.promise
        }
    }
}

module.exports = (parent, config) => {
    return new AttendanceModule(parent, config)
}
