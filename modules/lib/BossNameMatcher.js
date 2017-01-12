'use strict'

class BossNameMatcher {
    constructor (bossNames) {
        this.cache = {}
        this.names = bossNames.map(v => v.toLowerCase())
    }

    match (fightName) {
        const fightNameCmp = fightName.toLowerCase()

        if (!this.cache.hasOwnProperty(fightName)) {
            this.cache[fightName] = this.names.map(v => {
                return fightNameCmp.indexOf(v) === -1 ? 0 : 1
            }).reduce((carry, v) => carry + v, 0) > 0
        }

        return this.cache[fightName]
    }
}

module.exports = BossNameMatcher
