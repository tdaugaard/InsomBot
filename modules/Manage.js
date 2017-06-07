'use strict'

const CommandModule = require('../lib/CommandModule')
const logger = require('../lib/logger')
const Common = require('../lib/common')
const dot = require('dot-object')
const util = require('util')
const colors = require('colors')
const RichEmbed = require('discord.js').RichEmbed
const fs = require('fs')
const os = require('os')
const mktemp = require('mktemp')

const DMResponse = require('./lib/Response/DirectMessage')
const EmbedResponse = require('./lib/Response/Embed')
const FileEmbedResponse = require('./lib/Response/FileEmbed')
const UnTaggedResponse = require('./lib/Response/UnTagged')

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
            throw 'please supply the name of a module to disable.'
        }

        if (params[0] === 'Manage') {
            throw 'cannot manage the Manage module.'
        }

        try {
            const module = this.bot.disableModule(params[0])
            return module.getName() + ' has been disabled.'
        } catch (err) {
            throw err.message
        }
    }

    _enableModule (params) {
        if (!params.length) {
            throw 'please supply the name of a module to enable.'
        }

        if (params[0] === 'Manage') {
            throw 'cannot manage the Manage module.'
        }

        try {
            const module = this.bot.enableModule(params[0])
            return module.getName() + ' has been enabled.'
        } catch (err) {
            throw err.message
        }
    }

    async _reloadModule (params) {
        const module = await this._disableModule(params)
            .then(this.bot.reloadModule.bind(this.bot, params[0]))
            .then(this._enableModule.bind(this, params))

        return params[0] + ' has been reloaded.'
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

        return "alright, here's the available modules:\n" + mods.join('\n') + '\n'
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

        return '\n' + triggers.join('\n') + '\n'
    }

    _restartBot () {
        if (!Common.runningUnderPM()) {
            throw "can't do that since I'm not running under a process manager."
        }

        setTimeout(process.exit, 2000)
        return 'okay, _brb_.'
    }

    _saveConfig () {
        this.bot.saveConfig()

        return 'configuration has been saved. Bot may need to be restarted in order for everything to take effect.'
    }

    _modifyConfiguration (params) {
        const mode = params[0]

        if (mode === 'set') {
            if (params.length < 3) {
                throw 'insufficient arguments given.'
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

                return 'okay, (`' + matches[1] + '`) `' + moduleCVar + '` was `' + oldValue + '` is now `' + value + '`'
            }

            logger.debug("Modifying CVar '%s' from '%s' => '%s'",
                colors.cyan.bold(cvar),
                colors.red.bold(oldValue),
                colors.green.bold(value)
            )

            dot.str(cvar, value, this.bot.config)
            this.bot.updateConfig()

            return 'okay, `' + cvar + '` was `' + oldValue + '` is now `' + value + '`'
        }

        if (mode === 'del') {
            if (params.length < 2) {
                throw 'insufficient arguments given.'
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

                return 'okay, (`' + matches[1] + '`) `' + moduleCVar + '` was `' + oldValue + '` but is now deleted.'
            }

            logger.debug("Deleting CVar '%s' which was '%s'.",
                colors.cyan.bold(cvar),
                colors.red.bold(oldValue)
            )

            dot.remove(cvar, this.bot.config)

            this.bot.updateConfig()

            return 'okay, `' + cvar + '` was `' + oldValue + '` but is now deleted.'
        }

        return this._displayConfig(mode)
    }

    async _displayConfig (section) {
        var dots
        var subsection = ''

        if (!section) {
            dots = dot.dot(this.bot.config)
        } else {
            dots = dot.dot(dot.pick(section, this.bot.config))
            subsection = 'for subsection `' + section + '` '
        }

        var str = Object.keys(dots).map(k => {
                return '`' + k + '` = `' + dots[k]
            }).join('\n')

        if (str.length <= 2000) {
            return str
        }

        // Save to a text file and embed that instead
        try {
            const writeFile = util.promisify(fs.writeFile)
            const file = await mktemp.createFile(os.tmpdir() + '/dotconfig-XXXXX.txt')
            const ret = await writeFile(file, str)

            return new FileEmbedResponse(file, "Configuration is too large to display inline in a single message, so here's an attachment of the current configuration " + subsection + 'in dot-notation.')

        } catch (err) {
            console.error(err)
        }

        throw "it ain't working."
    }

    _evalExpression (msg) {
        const code = msg.content.replace(/^!\w+\s*/, '').trim()
        const bot = this.bot

        if (!code.length) {
            throw 'what? _what?_ **what?**'
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
            throw util.inspect(e)
        }

        return new EmbedResponse(embed)
    }

    Message (message) {
        const trigger = this._getTrigger(message)
        const params = this._getParams(message)

        switch (trigger) {
            case 'dismod':   return this._disableModule(params)
            case 'enmod':    return this._enableModule(params)
            case 'reload':   return this._reloadModule(params)
            case 'mods':     return this._displayModules()
            case 'triggers': return this._displayTriggers()
            case 'save':     return this._saveConfig()
            case 'eval':     return this._evalExpression(message)
            case 'cvar':     return this._modifyConfiguration(params)
            case 'restart':  return this._restartBot()
        }
    }
}

module.exports = (parent, config) => {
    return new ManageModule(parent, config)
}
