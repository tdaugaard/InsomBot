'use strict'

const CommandModule = require('../lib/CommandModule')
const pad = require('pad')
const Affixes = require('./data/affixes.json')
const RichEmbed = require('discord.js').RichEmbed
const moment = require('moment')

class MythicAffixModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!affix', {
            'short': 'Shows the active Mythic+ affixes this week.',
            'params': [
                'weeks ahead = 0'
            ]
        })
    }

    _findCurrentAffix () {
        return this._getAffix(this._findCurentAffixIndex())
    }

    _findFutureAffix (howMany) {
        let currentAffix = this._findCurentAffixIndex()
        howMany = parseInt(howMany, 10)

        if (currentAffix + howMany >= Affixes.pairs.length) {
            howMany -= Math.floor((currentAffix + howMany) / Affixes.pairs.length) * Affixes.pairs.length
        }

        return this._getAffix(currentAffix + howMany)
    }

    _findCurentAffixIndex () {
        const date = moment(Affixes.start.date)
        let affixIndex = Affixes.start.pair

        do {
            ++affixIndex
            if (affixIndex === Affixes.pairs.length) {
                affixIndex = 0
            }
        } while (date.add(7, 'days').isBefore())

        return affixIndex
    }

    _getAffix (index) {
        return Affixes.pairs[index]
    }

    _renderAffix (affixPairs) {
        let ret = ''

        for (const affix of affixPairs) {
            ret += `**${affix}**\n    _${Affixes.desc[affix]}_\n`
        }

        return ret
    }

    _getCurrentAffixes () {
        const thisAffix = this._findCurrentAffix()
        const embed = new RichEmbed({color: 3447003})

        embed.addField('Current Mythic+ Affixes', this._renderAffix(thisAffix))

        return {embed: {embed: embed}}
    }

    _getFutureAffixes (weeksAhead) {
        weeksAhead = parseInt(weeksAhead, 10) || 1

        if (weeksAhead < 0) {
            return Promise.reject("please give a non-negative number.")
        }

        const thisAffix = this._findFutureAffix(weeksAhead)
        const embed = new RichEmbed({color: 3447003})
        const futureTime = weeksAhead === 1 ? 'next reset' : `in ${weeksAhead} resets`

        embed.addField(`Mythic+ Affixes ${futureTime}`, this._renderAffix(thisAffix))

        return {embed: {embed: embed}}
    }

    _getAffixTable (affixIndex) {
        const thisAffixIndex = affixIndex || this._findCurentAffixIndex()
        const embed = new RichEmbed({color: 3447003})
        const longestAffixName = Affixes.pairs.reduce((carry, v) => {
            const len = v.reduce((ncarry, nv) => nv.length > ncarry ? nv.length : ncarry, 0)
            return len > carry ? len : carry
        }, 0)
        const affixList = Affixes.pairs
            .slice(thisAffixIndex)
            .concat(
                Affixes.pairs.slice(0, thisAffixIndex)
            )
        let affixListString = ''

        for (let index = 0; index < affixList.length; index++) {
            affixListString += '`' + (index === 0 ? 'current : ' : `+${index} reset: `)
            affixListString += affixList[index].map(v => pad(v, longestAffixName)).join(' - ')
            affixListString += '`\n'
        }

        embed.addField('Mythic+ Affix List Relative to this Reset', affixListString)

        return {embed: {embed: embed}}
    }

    Message (message) {
        const params = this._getParams(message)

        if (params.length) {
            if (params[0] === 'list') {
                return Promise.resolve(this._getAffixTable())
            }

            return Promise.resolve(this._getFutureAffixes(params[0]))
        }

        return Promise.resolve(this._getCurrentAffixes())
    }
}

module.exports = (parent, config) => {
    return new MythicAffixModule(parent, config)
}
