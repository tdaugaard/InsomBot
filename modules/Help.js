'use strict'

const CommandModule = require('../CommandModule')

class HelpModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!help', {
            'short': 'Display available bot commands',
            'params': [
                'module name (optional)'
            ]
        })
    }

    getHelp () {
        return "There's literally no more help to get here."
    }

    _getAllowedModules (msg) {
        const modules = this.bot.getModules()
        return Object.keys(modules).filter(v => modules[v].enabled && modules[v].allowed(msg.member))
    }

    _getHelpText (msg) {
        const params = this._getParams(msg)
        const modules = this.bot.getModules()
        const result = []

        let modulesAllowed = this._getAllowedModules(msg)
        let onlySpecificModule = false
        let moduleHeader

        if (params.length) {
            const moduleName = params[0].toLowerCase()

            if (moduleName === 'me') {
                return 'http://google.com/ http://wowhead.com/, there.'
            }

            onlySpecificModule = modulesAllowed.map(v => v.toLowerCase()).indexOf(moduleName) !== -1

            if (!onlySpecificModule) {
                return 'No such module: ' + params[0]
            }

            modulesAllowed = modulesAllowed.filter(v => v.toLowerCase() === moduleName)
        }

        modulesAllowed.forEach(k => {
            const module = modules[k]
            const triggerNameFormatting = !onlySpecificModule ? '__' : '**'
            const triggers = module.triggers
            let str = ''

            moduleHeader = '**' + k + '**'

            if (module.roles.length) {
                moduleHeader += ' (Only _' + module.roles.join('_, _') + '_)'
            }

            if (!onlySpecificModule) {
                str += '# ' + moduleHeader + '\n'
            }

            for (let t in triggers) {
                str += triggerNameFormatting + t + triggerNameFormatting

                if (triggers[t].hasOwnProperty('params')) {
                    triggers[t].params.forEach(v => {
                        str += ' <_' + this.bot._escapeMarkDown(v) + '_> '
                    })
                }

                if (triggers[t].hasOwnProperty('short')) {
                    str += '\n_' + this.bot._escapeMarkDown(triggers[t].short) + '_\n'
                }

                str += '\n'
            }

            result.push(str)
        })

        if (!result.length) {
            return "sadly I can't do much for you."
        }

        if (onlySpecificModule) {
            const moduleName = modulesAllowed.pop()
            const module = modules[moduleName]
            var str = ''

            str += 'regarding ' + moduleHeader + ", here's how it works:\n\n"
            str += result.join('')
            str += module.getHelp()

            return str
        }

        return "here's what I can do for you:\n\n" + result.join('')
    }

    Message (message) {
        return Promise.resolve(this._getHelpText(message))
    }
}

module.exports = (parent, config) => {
    return new HelpModule(parent, config)
}
