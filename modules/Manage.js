'use strict'

const CommandModule = require('../CommandModule')
const logger = require('../logger')
const Common = require('../common')
const dot = require('dot-object')
const util = require('util')
const colors = require('colors')
const RichEmbed = require('discord.js').RichEmbed

// Necessary to overwrite existing properties on an object
dot.override = true

class ManageModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this
            .addTrigger('!dismod', {
                'short': 'Disable a module',
                'params': [
                    'module name'
                ]
            })
            .addTrigger('!enmod', {
                'short': 'Enable a module',
                'params': [
                    'module name'
                ]
            })
            .addTrigger('!mods', {
                'short': 'Display module status'
            })
            .addTrigger('!reload', {
                'short': 'Completely unloads and then reloads a module.',
                'params': [
                    'module name'
                ]
            })
            .addTrigger('!restart', {
                'short': 'Restart the bot'
            })
            .addTrigger('!triggers', {
                'short': 'Display all triggers and their associated modules'
            })
            .addTrigger('!save', {
                'short': 'Save current module configuration to `config.json`'
            })
            .addTrigger('!eval', {
                'short': 'Eval javascript code and return the result. \'this\' = DiscordBot'
            })
            .addTrigger('!cvar', {
                'short': 'Display or modify a configuration variable',
                'params': [
                    'show|set|del',
                    'var_name (optional)',
                    'value (optional)'
                ]
            })

        this.config = Object.assign(this.config || {}, {
            'roles': [
                'Great Leader'
            ]
        })
    }

    getHelp () {
        return 'This module allows you to manage the bot in various ways.\n' +
               '\n- You cannot manage this module as that would possibly lock you out of controlling the bot.' +
               '\n- Modules with conflicting triggers can still be loaded, but they will load in the order they are found.' +
               '\n- You can disable one module, then enable another, then re-enablet the first to _resolve_ trigger conflicts temporarily.' +
               '\n- Be careful with using `!save` as it will take effect on the next restart and you may lock yourself out.'
    }

    _disableModule (params) {
        if (!params.length) {
            return Promise.reject('Please supply the name of a module to disable.')
        }

        if (params[0] === 'Manage') {
            return Promise.reject('Cannot manage the Manage module.')
        }

        try {
            const module = this.bot.disableModule(params[0])
            return Promise.resolve(module.getName() + ' has been disabled.')
        } catch (err) {
            return Promise.reject(err.message)
        }
    }

    _enableModule (params) {
        if (!params.length) {
            return Promise.reject('Please supply the name of a module to enable.')
        }

        if (params[0] === 'Manage') {
            return Promise.reject('Cannot manage the Manage module.')
        }

        try {
            const module = this.bot.enableModule(params[0])
            return Promise.resolve(module.getName() + ' has been enabled.')
        } catch (err) {
            return Promise.reject(err.message)
        }
    }

    _reloadModule (params) {
        return this._disableModule(params)
            .then(this.bot.reloadModule.bind(this.bot, params[0]))
            .then(this._enableModule.bind(this, params))
            .then(module => {
                return params[0] + ' has been reloaded.'
            })
    }

    _displayModules () {
        const modules = this.bot.getModules()
        var mods = []

        for (var k in modules) {
            if (!modules.hasOwnProperty(k)) {
                continue
            }

            const module = modules[k]
            const conflicts = module.conflicts ? ' (has conflicts)' : ''

            if (module.enabled) {
                mods.push('🗹 **' + k + '**' + conflicts)
            } else {
                mods.push('☐ ' + k + conflicts)
            }
        }

        const str = "alright, here's the available modules:\n" + mods.join('\n') + '\n'

        return Promise.resolve(str)
    }

    _displayTriggers () {
        const botTriggers = this.bot.getTriggers()
        var triggers = []

        for (var k in botTriggers) {
            if (!botTriggers.hasOwnProperty(k)) {
                continue
            }

            triggers.push('`' + k + '` is handled by `' + botTriggers[k] + '`')
        }

        const str = '\n' + triggers.join('\n') + '\n'

        return Promise.resolve(str)
    }

    _restartBot () {
        if (!Common.runningUnderPM()) {
            return Promise.reject("Can't do that since I'm not running under a process manager.")
        }

        setTimeout(process.exit, 2000)
        return Promise.resolve('okay, _brb_.')
    }

    _saveConfig () {
        this.bot.saveConfig()

        return Promise.resolve('configuration has been saved. Bot may need to be restarted in order for everything to take effect.')
    }

    _modifyConfiguration (params) {
        const mode = params[0]

        if (mode === 'set') {
            if (params.length < 3) {
                return Promise.reject('Insufficient arguments given.')
            }

            const cvar = params[1]
            const oldValue = dot.pick(cvar, this.bot.config)
            const value = params.slice(2).join(' ')
            const matches = cvar.match(/^modules\.([^.]+)\./)

            if (matches && this.bot.hasModule(matches[1])) {
                let moduleCVar = cvar.replace(matches[0], '')
                let moduleCfg = this.bot.getModuleByName(matches[1]).config

                logger.debug("Modifying Module (%s) CVar '%s' from '%s' => '%s'",
                    colors.blue.bold(matches[1]),
                    colors.cyan.bold(moduleCVar),
                    colors.red.bold(oldValue),
                    colors.green.bold(value)
                )

                dot.str(moduleCVar, value, moduleCfg)
                this.bot.updateConfig()

                return Promise.resolve('okay, (`' + matches[1] + '`) `' + moduleCVar + '` was `' + oldValue + '` is now `' + value + '`')
            }

            logger.debug("Modifying CVar '%s' from '%s' => '%s'",
                colors.cyan.bold(cvar),
                colors.red.bold(oldValue),
                colors.green.bold(value)
            )

            dot.str(cvar, value, this.bot.config)
            this.bot.updateConfig()

            return Promise.resolve('okay, `' + cvar + '` was `' + oldValue + '` is now `' + value + '`')
        }

        if (mode === 'del') {
            if (params.length < 2) {
                return Promise.reject('Insufficient arguments given.')
            }

            const cvar = params[1]
            const oldValue = dot.pick(cvar, this.bot.config)
            const matches = cvar.match(/^modules\.([^.]+)\./)

            if (matches && this.bot.hasModule(matches[1])) {
                let moduleCVar = cvar.replace(matches[0], '')
                let moduleCfg = this.bot.getModuleByName(matches[1]).config

                logger.debug("Deleting Module (%s) CVar '%s' which was '%s'.",
                    colors.blue.bold(matches[1]),
                    colors.cyan.bold(moduleCVar),
                    colors.red.bold(oldValue)
                )

                dot.remove(moduleCVar, moduleCfg)
                this.bot.updateConfig()

                return Promise.resolve('okay, (`' + matches[1] + '`) `' + moduleCVar + '` was `' + oldValue + '` but is now deleted.')
            }

            logger.debug("Deleting CVar '%s' which was '%s'.",
                colors.cyan.bold(cvar),
                colors.red.bold(oldValue)
            )

            dot.remove(cvar, this.bot.config)

            this.bot.updateConfig()

            return Promise.resolve('okay, `' + cvar + '` was `' + oldValue + '` but is now deleted.')
        }

        var dots
        var subsection = ''

        if (!mode) {
            dots = dot.dot(this.bot.config)
        } else {
            dots = dot.dot(dot.pick(mode, this.bot.config))
            subsection = 'for subsection `' + mode + '` '
        }

        var str = ''

        for (var k in dots) {
            var value = dots[k]

            if (k.toLowerCase().indexOf('pass') !== -1) {
                value = '<Password Hidden>'
            }

            str += '`' + k + '` = `' + value + '`\n'
        }

        return Promise.resolve("here's the current configuration " + subsection + 'in dot-notation:\n' + str)
    }

    _evalExpression (msg) {
        const code = msg.content.replace(/^!\w+\s*/, '').trim()
        const bot = this.bot

        if (!code.length) {
            return Promise.reject('what? _what?_ **what?**')
        }

        let ret
        let isError = false
        let embedColor = 1497911

        try {
            ret = eval(code)
        } catch (e) {
            isError = true
            ret = e.toString()
            embedColor = 14358038
        }

        ret = util.inspect(ret)
        ret = '```javascript\n' + ret + '\n```'

        const embed = new RichEmbed({color: embedColor})
        embed.setTitle('JavaScript Evaluator')
        embed.addField('Input', '`' + code + '`')

        try {
            embed.addField(isError ? 'Error' : 'Output', ret)
        } catch (e) {
            return Promise.reject(util.inspect(e))
        }

        return Promise.resolve({embed: {embed: embed}})
    }

    Message (message) {
        const trigger = this._getTrigger(message)
        const params = this._getParams(message)

        switch (trigger) {
            case 'dismod': return this._disableModule(params)
            case 'enmod': return this._enableModule(params)
            case 'reload': return this._reloadModule(params)
            case 'mods': return this._displayModules()
            case 'triggers': return this._displayTriggers()
            case 'save': return this._saveConfig()
            case 'eval': return this._evalExpression(message)
            case 'cvar': return this._modifyConfiguration(params)
            case 'restart': return this._restartBot()
        }
    }
}

module.exports = (parent, config) => {
    return new ManageModule(parent, config)
}
