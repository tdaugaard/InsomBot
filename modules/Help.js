'use strict'

const CommandModule = require('../lib/CommandModule')
const escapeMarkdown = require('discord.js').escapeMarkdown

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

    _getSimpleHelp (modulesAllowed, msg) {
        const result = []
        let moduleHeader

        modulesAllowed.forEach(k => {
            const module = this.bot.getModuleByName(k)
            let str = ''

            moduleHeader = '**' + k + '**'

            if (module.roles.length) {
                moduleHeader += ' (Only _' + module.roles.join('_, _') + '_)'
            }

            str += moduleHeader
            str += ': _' + Object.keys(module.triggers).join('_, _') + '_'

            result.push(str)
        })

        if (!result.length) {
            return "sadly I can't do much for you."
        }

        return 'here\'s what I can do for you:\n\n' + result.join('\n') +
               '\n\nType `!help <module>` to get more detailed help.'
    }

    _getModuleHelp (modulesAllowed, msg, params) {
        const moduleNameLC = params[0].toLowerCase()

        if (moduleNameLC === 'me') {
            return 'http://google.com/ http://wowhead.com/, there.'
        }

        if (modulesAllowed.map(v => v.toLowerCase()).indexOf(moduleNameLC) === -1) {
            return 'No such module: _' + params[0] + '_'
        }

        const moduleName = modulesAllowed.filter(v => v.toLowerCase() === moduleNameLC).pop()
        const module = this.bot.getModuleByName(moduleName)
        const triggers = module.triggers
        let moduleHeader = '**' + moduleName + '**'
        let result = ''

        if (module.roles.length) {
            moduleHeader += ` (Only _${module.roles.join('_, _')}_)`
        }

        for (let t in triggers) {
            let triggerHelp = ''

            triggerHelp += '`' + t

            if (triggers[t].hasOwnProperty('params')) {
                triggers[t].params.forEach(v => {
                    triggerHelp += ` <${v}>`
                })
            }

            triggerHelp += '`'

            if (triggers[t].hasOwnProperty('short')) {
                triggerHelp += '\n_' + escapeMarkdown(triggers[t].short) + '_\n'
            }

            result += triggerHelp + '\n'
        }

        let str = ''

        str += 'regarding ' + moduleHeader + ", here's how it works:\n\n"
        str += result
        str += module.getHelp()

        return str
    }

    Message (message) {
        const params = this._getParams(message)
        const modules = this._getAllowedModules(message)

        if (params.length) {
            return Promise.resolve(this._getModuleHelp(modules, message, params))
        }

        return Promise.resolve(this._getSimpleHelp(modules))
    }
}

module.exports = (parent, config) => {
    return new HelpModule(parent, config)
}
