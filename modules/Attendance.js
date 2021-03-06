'use strict'

const logger = require('../lib/logger')
const CommandModule = require('../lib/CommandModule')
const Common = require('../lib/common')
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
const UnTaggedResponse = require('./lib/Response/UnTagged')
const intersect = require('array-intersection')
const BlizzardApi = require('./lib/BlizzardApi')
const schedule = require('node-schedule');
const async = require('async')
const util = require('util')

class AttendanceModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.config = Object.assign(this.config, {
            'defaultNumRaids': 12
        })

        this.addTrigger('!att', {
            'short': 'Collect and display information about raid attendance from Warcraft Logs',
            'params': [
                'character',
                'raids = ' + this.config.defaultNumRaids,
                '-diff [!](n|h|m)',
                '-alt',
                '-only-alt'
            ]
        })
        this.addTrigger('!missed', {
            'short': 'Display information about raid abscence from Warcraft Logs',
            'params': [
                'character',
                'raids = ' + this.config.defaultNumRaids
            ]
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
        this.addTrigger('!alt', {
            'short': 'Map an alt character to a main',
            'params': [
                'alt_name',
                'main_name'
            ]
        })
        this.addTrigger('!alts', {
            'short': 'View the mapping of alts to mains'
        })
        this.addTrigger('!trials', {
            short: 'View a list of trial players'
        });

        this.altsToMains = this._makeMainsToAltMapping(this.config.sameNameMapping)
        this._wcl = new WarcraftLogs(cachedRequest, {
            guild: this.bot.config.guild.name,
            realm: this.bot.config.guild.realm,
            region: this.bot.config.guild.region,
            apiKey: this.bot.config.guild.api.wcl
        })

        this._blizzardApi = new BlizzardApi(cachedRequest, {
            guild: this.bot.config.guild.name,
            realm: this.bot.config.guild.realm,
            region: this.bot.config.guild.region,
            apiKey: this.bot.config.guild.api.blizzard
        });

        cachedRequest.setCacheDirectory(this.bot.config.cacheDirectory)

        if (this.config.trials && this.config.trials.raidDays && this.config.trials.check) {
            const rule = new schedule.RecurrenceRule();
            rule.dayOfWeek = this.config.trials.raidDays;
            rule.hour = 0;
            rule.minute = 0;

            this._checkTrialsSchedule = schedule.scheduleJob(rule, this._checkTrials.bind(this));
            this._logNextTrialCheck();
        }
    }

    _logNextTrialCheck () {
        if (!this._checkTrialsSchedule) {
            return;
        }

        logger.info('Next trials check: ' + this._getNextTrialCheck());
    }

    _getNextTrialCheck () {
        const nextInvocation = this._checkTrialsSchedule.nextInvocation();
        return moment(nextInvocation).format(this.bot.config.date.human);
    }

    _checkTrials () {
        this._logNextTrialCheck();

        this._blizzardApi.getGuildMembers()
            .then(members => {
                return members.filter(v => {
                    return v.character.level === 110 && v.rank === this.config.trials.rank;
                });
            })
            .then(members => {
                const numReports = this.config.trials.raidDays.length * 10;
                const characterNames = members.map(v => v.character.name);

                return this._getReports(numReports)
                    .then(this._wcl.fetchCombatReports.bind(this._wcl))
                    .then(this._filterReports.bind(this, {}))
                    .then(this._collectAttendance.bind(this))
                    .then(this._filterSpecificCharacter.bind(this, characterNames))
                    .then(this._assembleTrialAttendanceData.bind(this));
            })
            .then(msg => {
                let text = msg.content + '\nNext check: ' + this._getNextTrialCheck();

                this.bot.sendChannelMessage(this.config.trials.announce_channel, text);
            })
            .catch(err => {
            })
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

    async _getReports (numberOfRaids) {
        let reports = await this._wcl.getListOfLogs()

        if (numberOfRaids < reports.length) {
            reports = reports.slice(-numberOfRaids)
        }

        return reports
    }

    _collectAttendance (reports) {
        const attendance = new RaidAttendance(reports)

        for (const report of reports) {
            const fights   = report.fights.filter(v => v.boss !== 0)
            const fightIds = fights.map(v => v.id)

            if (!fightIds.length) {
                logger.debug("Combat report %s does not have fights after filtering.", report.id)
                continue
            }

            attendance.fights += fightIds.length
            attendance.raids.push({
                id: report.id,
                start: report.start,
                fights: fightIds.length
            })

            report.friendlies
                .filter(v => !['NPC', 'Boss', 'Pet'].includes(v.type))
                .forEach(v => {
                    const name = this._resolveCharacterName(v.name)

                    if (this.config.excludeNames.includes(v.name)) {
                        return true
                    }

                    if (!attendance.characterNames.includes(v.name)) {
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

                    if (!player.raids.ids.includes(report.id)) {
                        player.raids.ids.push(report.id)
                    }

                    if (report.start < player.firstAttendance) {
                        player.firstAttendance = report.start
                    }

                    player.lastAttendance = report.start
                    player.fights.num += intersect(v.fights.map(v => v.id), fightIds).length
                })
        }

        return this._aggregateAttendance(attendance)
    }

    _filterSpecificCharacter (characters, attendance) {
        const players = []
        const names = characters.map(v => v.toLowerCase())

        for (const player of Common.objectIterator(attendance.players)) {
            const playerName = player.name.toLowerCase()
            const namesMatching = names.filter(v => playerName.indexOf(v) === 0)

            if (namesMatching.length) {
                players.push(player)
            }
        }

        if (!players.length) {
            throw `no players found matching _${characters.join(', ')}_.`
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

        attendance.raids
            .filter(v => v.start >= player.firstAttendance)
            .forEach(raid => {
                possibleReports.raids.push(raid.id)
                possibleReports.fights += raid.fights
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
            if (!attendees.includes(this.altsToMains[name])) {
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

            if (!attendees.includes(resolvedName)) {
                continue
            }

            if (!players.includes(resolvedName)) {
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

        return new UnTaggedResponse(out)
    }

    _assembleTrialAttendanceData (attendance) {
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
        let out = ''

        for (const player of Common.objectIterator(attendance.players)) {
            players.push(player)
        }

        if (!players.length) {
            throw 'No trial players.';
        }

        const numberOfActivePlayers = players.length

        players.sort(sortBy('-raids.pct', '-raids.num', '-fights.pct', '-fights.num'))

        players.forEach(v => {
            table.push([
                v.name,
                v.raids.num + ' of ' + pad(3, v.raids.possible) + ' (' + pad(4, Math.round(v.raids.pct) + '%') + ')',
                numeral(v.fights.num).format('0,0') + ' (' + pad(4, Math.round(v.fights.pct) + '%') + ')'
            ])
        })

        out += `${numberOfActivePlayers} trial players' attendance of the past **${attendance.raids.length}** raids (_${numeral(attendance.fights).format('0,0')} fights_)\n`
        out += '```\n'
        out += table.toString() + '\n'
        out += '\n```'

        return new UnTaggedResponse(out)
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
            throw 'Insufficient arguments given.'
        }

        const [alt, main] = params
        const performUnmapping = main === 'null'

        if (this.config.sameNameMapping.hasOwnProperty(alt)) {
            throw `cannot ${performUnmapping ? 'un' : ''}map a main as an alt. _${alt}_ is main of _${this.config.sameNameMapping[alt].join('_, _')}_`
        }

        if (performUnmapping) {
            if (!this.altsToMains.hasOwnProperty(alt)) {
                throw `'${alt}' is already unmapped.`
            }

            delete this.altsToMains[alt]

            this.config.sameNameMapping = this._makeAltToMainsMapping(this.altsToMains)
            this.bot.updateConfig()

            return `okay, **${alt}** is unmapped.`
        }

        if (this.altsToMains.hasOwnProperty(alt)) {
            throw `**${alt}** is already mapped to **${this.altsToMains[alt]}**`
        }

        if (this.config.sameNameMapping.hasOwnProperty(main)) {
            this.config.sameNameMapping[main].push(alt)
        } else {
            this.config.sameNameMapping[main] = [alt]
        }

        this.altsToMains = this._makeMainsToAltMapping(this.config.sameNameMapping)

        return `okay, **${alt}** is now mapped to **${main}**.`
    }

    _viewAlts () {
        let str = ""

        for (const main of Object.keys(this.config.sameNameMapping)) {
            let singularOrPlural = this.config.sameNameMapping[main].length > 1 ? 'these alts' : 'this alt'

            str += `**${main}** has ${singularOrPlural} mapped: _${this.config.sameNameMapping[main].join('_, _')}_\n`
        }

        return new UnTaggedResponse(str)
    }

    _getArguments (params) {
        let myParams = params.slice(0)
        const args = {
            excludeName: false,
            character: [],
            numberOfRaids: this.config.defaultNumRaids,
            filter: {
                difficulty: null,
                altRuns: false,
                onlyAltRuns: false
            }
        }

        if (myParams[0] === 'rm') {
            args.excludeName = true
            myParams.shift()
        } else
        if (myParams[0] === 'reset') {
            args.clearExcludeName = true
            myParams.shift()
        }

        while (myParams[0] && !/^(\d+|\-.+)$/.test(myParams[0])) {
            args.character.push(myParams.shift())
        }

        while (myParams.length) {
            const param = myParams.shift()

            switch (param) {
                case "-diff":
                    if (!myParams.length) {
                        throw "please give a difficulty to filter by: **n**ormal, **h**eroic, or **m**ythic (preceed by ! to negate the filter)"
                    }

                    args.filter.difficulty = myParams.shift()
                break;

                case "-alt":
                    args.filter.altRuns = true
                break;

                case "-only-alt":
                    args.filter.onlyAltRuns = true
                break;

                default:
                    args.numberOfRaids = Common.getIntegerBetween(param, {min: 1, default: this.config.defaultNumRaids})
            }
        }

        if (!args.character.length) {
            args.character = null
        }

        return args
    }

    _assembleSimpleAttendanceData (attendance) {
        const notBefore = moment().subtract(this.config.filterInactive, 'days')
        let out = ''

        attendance.players.sort(sortBy('-raids.pct', '-raids.num', '-fights.pct', '-fights.num'))

        if (attendance.players.length > 1) {
            const thisManyPlayers = attendance.players.length > 2 ? attendance.players.length : 'both'
            out += `Your query matched more than one player, showing attendance for ${thisManyPlayers}.\n\n`
        }

        for (const player of attendance.players) {
            let lastAttendanceMoment = moment(player.lastAttendance)
            let firstAttendanceMoment = moment(player.firstAttendance)
            let activeOrInactive = lastAttendanceMoment.isBefore(notBefore) ? " (_inactive_)" : ""

            out += `**${player.name}**${activeOrInactive} has attended **${player.raids.num}** of **${player.raids.possible}** `
            out += `(**${Math.round(player.raids.pct)}%**) possible raids of the past **${attendance.raids.length}** raids. `
            out += `First & Last attendance: ${firstAttendanceMoment.format(this.bot.config.date.human)} - ${lastAttendanceMoment.format(this.bot.config.date.human)}\n`
        }

        return new UnTaggedResponse(out)
    }

    _assembleAbscenceData (attendance) {
        const notBefore = moment().subtract(this.config.filterInactive, 'days')
        let out = ''
        let missedRaidsPlayerCount = 0

        attendance.players.sort(sortBy('-raids.pct', '-raids.num', '-fights.pct', '-fights.num'))

        if (attendance.players.length > 1) {
            const thisManyPlayers = attendance.players.length > 2 ? attendance.players.length : 'both'
            out += `Your query matched more than one player, showing attendance for ${thisManyPlayers}.\n\n`
        }

        out += `Abscence report for the past ${attendance.reports.length} raids (alt raids not included):\n\n`

        for (const player of attendance.players) {
            let missedRaids = player.raids.missed.reverse()
            let lastAttendanceMoment = moment(player.lastAttendance)
            let activeOrInactive = lastAttendanceMoment.isBefore(notBefore) ? " (_inactive_)" : ""

            if (!missedRaids.length) {
                out += `**${player.name}**${activeOrInactive} has not missed any raids. Stop questioning their dedication!\n`;
                continue;
            }

            out += `**${player.name}**${activeOrInactive} missed these raids:\n\n`

            for (const reportId of missedRaids) {
                const report = this._findCombatReportById(attendance.reports, reportId)
                const reportDate = moment(report.start).format(this.bot.config.date.human)

                out += ` - ${reportDate}: _${report.title}_ (https://www.warcraftlogs.com/reports/${report.id})\n`
            }

            ++missedRaidsPlayerCount
        }

        if (missedRaidsPlayerCount) {
            out += '\nIf any players _did_ attend the above raids, maybe it was on an unregistered alt. In that case, you can use `!alt <alt name> <main name>` to map it to their main, such that these kinds of misunderstandings won\'t happen in the future.\n'
        }

        return new UnTaggedResponse(out)
    }

    _findCombatReportById (reports, reportId) {
        return reports.find(v => {
            return v.id === reportId
        })
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
            let hadBossFights = false
            for (const fight of report.fights) {
                if (fight.boss === 0 || !bossMatcher.match(fight.name)) {
                    continue
                }

                hadBossFights = true
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
            throw 'no bosses found matching that text.'
        }

        return bosses
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

    _excludeName(names) {
        if (!this.config.excludeNames) {
            this.config.excludeNames = []
        }

        var excludedNames = []

        for (var i = 0; i < names.length; i++) {
            if (this.config.excludeNames.indexOf(names[i]) === -1) {
                this.config.excludeNames.push(names[i])
                excludedNames.push(names[i])
            }
        }

        if (!excludedNames.length) {
            return "they're already excluded."
        }

        return 'okay, _' + excludedNames.join('_, _') + '_ will be excluded from attendance records. Undo with `!att reset ' + excludedNames.join(' ') + '`'
    }

    _clearExcludedName(names) {
        if (!this.config.excludeNames) {
            return 'no names has been excluded.'
        }

        var clearedNames = []

        for (var i = 0; i < names.length; i++) {
            var index = this.config.excludeNames.indexOf(names[i])

            if (index !== -1) {
                this.config.excludeNames.splice(index, 1);
                clearedNames.push(names[i])
            }
        }

        if (!clearedNames.length) {
            return "they're not excluded."
        }

        return 'okay, _' + clearedNames.join('_, _') + '_ has been cleared and will be included in attendance records.'
    }

    _filterReports(filter, reports) {
        const altRx = new RegExp(this.config.matchAltRuns)

        reports = reports.filter(report => {
            if (filter.onlyAltRuns) {
                if (!altRx.test(report.title)) {
                    return false
                }
            } else
            if (!filter.altRuns) {
                if (altRx.test(report.title)) {
                    return false
                }
            }

            let fights = report.fights.filter(v => v.boss !== 0)

            if (filter.difficulty) {
                let difficulty = filter.difficulty
                const negate_expr = difficulty.substring(0, 1) === '!'

                if (negate_expr) {
                    difficulty = difficulty.replace(/^!/, '')
                }

                switch (difficulty.substring(0, 1).toLowerCase()) {
                    case "n": difficulty = 3; break;
                    case "h": difficulty = 4; break;
                    case "m": difficulty = 5; break;
                    default:
                        throw "please give a difficulty to filter by: **n**ormal, **h**eroic, or **m**ythic (preceed by ! to negate the filter)"
                }

                fights = fights.filter(v => {
                    if (negate_expr) {
                        return v.difficulty !== difficulty
                    }

                    return v.difficulty == difficulty
                })
            }

            return !!fights.length
        })

        if (!reports.length) {
            throw 'there are no combat reports matching your filter.'
        }

        return reports
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
        const args = this._getArguments(params)
        const trigger = this._getTrigger(message)

        if (trigger === 'alt') {
            return this._manageAlts(params)
        }

        if (trigger === 'alts') {
            return this._viewAlts()
        }

        if (trigger === 'kills') {
            if (!params.length) {
                throw 'which boss?'
            }

            return this._wcl.getListOfLogs()
                .then(this._filterReportsWithBosses.bind(this, params))
                .then(this._assembleKillCounts.bind(this, params));
        }

        if (trigger === 'knw') {
            if (!params.length) {
                throw 'which boss?'
            }

            return this._wcl.getListOfLogs()
                .then(this._filterReportsWithBosses.bind(this, params))
                .then(this._assembleWipeCounts.bind(this, params));
        }

        if (trigger === 'missed') {
            if (!args.character) {
                throw "please specify the (partial) name of whoever's dedication you're questioning."
            }

            return this._getReports(args.numberOfRaids)
                .then(this._wcl.fetchCombatReports.bind(this._wcl))
                .then(this._filterReports.bind(this, args.filter))
                .then(this._collectAttendance.bind(this))
                .then(this._filterSpecificCharacter.bind(this, args.character))
                .then(this._assembleAbscenceData.bind(this))
        }

        if (trigger === 'att') {
            if (args.excludeName) {
                return this._excludeName(args.character)
            }

            if (args.clearExcludeName) {
                return this._clearExcludedName(args.character)
            }

            const promise = this._getReports(args.numberOfRaids)
                .then(this._wcl.fetchCombatReports.bind(this._wcl))
                .then(this._filterReports.bind(this, args.filter))
                .then(this._collectAttendance.bind(this))

            if (args.character) {
                return promise
                    .then(this._filterSpecificCharacter.bind(this, args.character))
                    .then(this._assembleSimpleAttendanceData.bind(this))
            }

            return promise
                .then(this._filterInactiveMembers.bind(this))
                .then(this._assembleAttendanceData.bind(this))
        }

        if (trigger === 'trials') {
            return this._blizzardApi.getGuildMembers()
                .then(members => {
                    return members.filter(v => {
                        return v.character.level === 110 && v.rank === this.config.trial.rank;
                    });
                })
                .then(members => {
                    args.character = members.map(v => v.character.name);

                    return this._getReports(args.numberOfRaids)
                        .then(this._wcl.fetchCombatReports.bind(this._wcl))
                        .then(this._filterReports.bind(this, args.filter))
                        .then(this._collectAttendance.bind(this))
                        .then(this._filterSpecificCharacter.bind(this, args.character))
                        .then(this._assembleTrialAttendanceData.bind(this));
                })
        }
    }
}

module.exports = (parent, config) => {
    return new AttendanceModule(parent, config)
}
