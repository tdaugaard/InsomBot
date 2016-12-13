const CommandModule = require('../CommandModule')
const glob = require('glob')
const path = require('path')

class ComicsModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.comics = {}
        this._loadComics()
    }

    _loadComics () {
        const files = glob.sync('./modules/lib/comics/*.js', {absolute: true})

        if (!files.length) {
            return
        }

        for (const file of files) {
            const provider = path.basename(file, '.js')

            this.comics[provider] = require(file)(this)
        }
    }

    destructor () {
        for (const k of Object.keys(this.comics)) {
            delete this.comics[k]
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
            if (typeof comicsModule.getSpecificComic !== 'function') {
                return Promise.reject(`sorry, ${triggerInfo.provider} doesn't support this. Yet.`)
            }

            return comicsModule.getSpecificComic(parseInt(params[0]))
        }

        return comicsModule.getLatestComic()
    }
}

module.exports = (parent, config) => {
    return new ComicsModule(parent, config)
}
