'use strict'

const CommandModule = require('../CommandModule')
const Affixes = require('./data/affixes.json')
const RichEmbed = require('discord.js').RichEmbed
const moment = require('moment')

class MythicAffixModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!affix', {
            'short': 'Shows the active Mythic+ affixes this week.'
        })
    }

    _findCurrentAffix () {
        return this._getAffix(this._findCurentAffixIndex())
    }

    _findNextAffix () {
        let thisAffix = this._findCurentAffixIndex() + 1
        if (thisAffix === Affixes.pairs.length) {
            thisAffix = 0
        }

        return this._getAffix(thisAffix)
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

    _getAffixes () {
        const thisAffix = this._findCurrentAffix()
        const embed = new RichEmbed({color: 3447003})

        embed.addField('Current Mythic+ Affixes', this._renderAffix(thisAffix))

        return {embed: {embed: embed}}
    }

    Message (message) {
        return Promise.resolve(this._getAffixes())
    }
}

module.exports = (parent, config) => {
    return new MythicAffixModule(parent, config)
}
/* const l = new MythicAffixModule()

console.log(util.inspect(l._getAffixes(), false, 4, true))
*/
