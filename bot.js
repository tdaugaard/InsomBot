const logger = require('./logger')
const Common = require('./common')
const glob = require('glob')
const colors = require('colors')
const path = require('path')
const fs = require('fs')
const EventEmitter = require('events').EventEmitter

class DiscordBot extends EventEmitter {
    constructor (env, discord) {
        super()

        this.discord = discord
        this.modules = {}
        this.triggers = {}
        this.config = env

        this._loadModules()
    }

    destructor () {
        for (const module of Common.objectIterator(this.modules)) {
            if (typeof module.destructor === 'function') {
                module.destructor()
            }
        }
    }

    _loadModules () {
        glob('modules/*.js', {absolute: true}, (err, files) => {
            if (err) {
                logger.error(err)
                return
            }

            files.forEach(this._loadModule.bind(this))
            this.emit('ready')
        })
    }

    _loadModule (modulePath) {
        const name = path.basename(modulePath, '.js')
        const config = this.config.modules[name] || {}
        const enabled = !config.hasOwnProperty('enabled') || config.enabled
        const blacklist = config.hasOwnProperty('blacklisted') && config.blacklisted
        const rDisabled = '❌'.red.bold
        const rEnabled = '✓'.green.bold

        if (blacklist) {
            logger.warn('%s Not loading blacklisted module %s.',
                rDisabled,
                colors.blue.bold(name)
            )

            return
        }

        const moduleConfig = Object.assign(this.config.modules[name] || {}, {
            'enabled': enabled
        })
        const module = require(modulePath)(this, moduleConfig)
        const triggers = Object.keys(module.triggers)

        this.modules[name] = module

        if (module.enabled) {
            this._loadModuleTriggers(module)
        }

        logger.info('%s Loaded module %s providing %s.',
            module.enabled ? rEnabled : rDisabled,
            colors.blue.bold(name),
            triggers.join(', ').yellow.bold
        )
    }

    disableModule (moduleName) {
        if (!this.hasModule(moduleName)) {
            throw new Error('No such module: ' + moduleName)
        }

        const module = this.getModuleByName(moduleName)

        if (!module.enabled) {
            throw new Error('Module is already disabled.')
        }

        module.enabled = false
        this._unloadModuleTriggers(module)

        this.updateConfig()

        return module
    }

    enableModule (moduleName) {
        if (!this.hasModule(moduleName)) {
            throw new Error('No such module: ' + moduleName)
        }

        const module = this.getModuleByName(moduleName)

        if (module.enabled) {
            throw new Error('Module is already enabled.')
        }

        module.enabled = true
        this._loadModuleTriggers(module)

        this.updateConfig()

        return module
    }

    hasModule (moduleName) {
        return this.modules.hasOwnProperty(moduleName)
    }

    saveConfig () {
        this.updateConfig()

        logger.debug('Saving current configuration to disk.')
        fs.writeFile('config.json', JSON.stringify(this.config, null, 4))
    }

    updateConfig () {
        logger.debug('Updating configuration from modules.')

        for (const k of Object.keys(this.modules)) {
            this.config.modules[k] = this.modules[k].config
        }
    }

    /**
     * Unload any triggers registered for a module
     *
     * @param   module
     */
    _unloadModuleTriggers (module) {
        const name = module.getName()

        logger.debug('Unassociating triggers for %s', name.blue.bold)

        Object.keys(module.triggers)
            .filter(v => this.triggers[v] === name)
            .forEach(v => {
                logger.debug('Unassociating trigger %s with module %s.',
                    v.yellow.bold,
                    name.blue.bold
                )

                delete this.triggers[v]
            })
    }

    /**
     * Load triggers for a module
     *
     * @param   module
     */
    _loadModuleTriggers (module) {
        const name = module.getName()

        logger.debug('Associating triggers for %s', name.blue.bold)

        Object.keys(module.triggers).forEach(v => {
            if (!this.triggers.hasOwnProperty(v)) {
                logger.debug('Associating trigger %s with module %s.',
                    v.yellow.bold,
                    name.blue.bold
                )

                this.triggers[v] = name
            } else {
                logger.warn("Not associating trigger %s with module %s since it's already associated with %s.",
                    v.yellow.bold,
                    name.blue.bold,
                    this.triggers[v].blue.bold
                )
            }
        })
    }

    getModules () {
        return this.modules
    }

    getTriggers () {
        return this.triggers
    }

    replyMessage (message, reply) {
        if (!reply) {
            return
        }

        message
            .reply(reply)
            .then(msg => {
                if (msg.channel.type === 'text') {
                    logger.info('Replied to %s in channel %s',
                        this.getAuthorString(message.author),
                        this.getChannelString(msg.channel)
                    )
                } else if (msg.channel.type === 'dm') {
                    logger.info('Replied to direct message from %s: %s',
                        this.getAuthorString(msg.channel.recipient),
                        colors.white.bold(reply)
                    )
                }
            })
            .catch(err => {
                logger.error(err)
            })
    }

    getChannelString (channel) {
        return colors.cyan.bold('#' + channel.name)
    }

    _escapeMarkDown (str) {
        return str.replace(/[*_~]/g, '\\$&')
    }

    checkMessageForKeywords (message) {
        var token = message.split(' ', 2)[0]

        if (this.triggers.hasOwnProperty(token)) {
            return Promise.resolve(token)
        }

        return Promise.resolve(false)
    }

    getModuleByTrigger (value) {
        if (this.triggers.hasOwnProperty(value)) {
            return this.modules[this.triggers[value]]
        }
    }

    getModuleByName (value) {
        if (this.modules.hasOwnProperty(value)) {
            return this.modules[value]
        }
    }

    getAuthorString (user) {
        return colors.magenta.bold(user.username) +
               colors.gray.bold('#' + user.discriminator)
    }

    runKeywordFunction (trigger, message) {
        const module = this.getModuleByTrigger(trigger)
        const permission = module.allowed(message.member)
        const logLevel = permission ? 'info' : 'warn'

        logger[logLevel]("%s: %s%s requested '%s' (%s)",
            permission ? 'Accepted'.green.bold : 'Denied'.red.bold,
            this.getAuthorString(message.member.user),
            message.member.nickname ? ' (' + message.member.nickname + ')' : '',
            colors.cyan(module.getName()),
            colors.yellow(message.content)
        )

        if (permission) {
            return new Promise((resolve, reject) => {
                module.Message(message)
                    .then(resolve, reject)
            })
        }

        return Promise.reject('Access denied.')
    }
}

module.exports = DiscordBot
