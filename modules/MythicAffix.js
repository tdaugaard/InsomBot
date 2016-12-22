'use strict'

const CommandModule = require('../CommandModule')
const logger = require('../logger')
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
        weeksAhead = parseInt(weeksAhead, 10)
        const thisAffix = this._findFutureAffix(weeksAhead)
        const embed = new RichEmbed({color: 3447003})
        const futureTime = weeksAhead === 1 ? 'next reset' : `in ${weeksAhead} resets`

        embed.addField(`Mythic+ Affixes ${futureTime}`, this._renderAffix(thisAffix))

        return {embed: {embed: embed}}
    }

    Message (message) {
        const params = this._getParams(message)

        if (params.length) {
            return Promise.resolve(this._getFutureAffixes(params[0]))
        }

        return Promise.resolve(this._getCurrentAffixes())
    }
}

module.exports = (parent, config) => {
    return new MythicAffixModule(parent, config)
}
/* const l = new MythicAffixModule()

console.log(util.inspect(l._getAffixes(), false, 4, true))
*/
