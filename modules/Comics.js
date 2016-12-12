const CommandModule = require('../CommandModule')
const DarkLegacyComics = require('./util/comics/DarkLegacyComics')
const XKCD = require('./util/comics/XKCD')

class ComicsModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.comics = {
            'DarkLegacyComics': new DarkLegacyComics(this),
            'XKCD': new XKCD(this)
        }
    }

    Message (message) {
        const params = this._getParams(message)
        const trigger = this._getTrigger(message)
        const triggerInfo = this.triggers['!' + trigger]

        if (!triggerInfo) {
            return Promise.reject('that ain\'t good.')
        }

        const comicsModule = this.comics[triggerInfo.provider]

        if (params.length) {
            return comicsModule.getSpecificComic(parseInt(params[0]))
        }

        return comicsModule.getLatestComic()
    }
}

module.exports = (parent, config) => {
    return new ComicsModule(parent, config)
}
