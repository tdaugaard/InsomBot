const logger = require('./lib/logger')
const Common = require('./lib/common')
const glob = require('glob')
const colors = require('colors')
const path = require('path')
const fs = require('fs')
const os = require('os')
const util = require('util')
const RichEmbed = require('discord.js').RichEmbed
const EventEmitter = require('events').EventEmitter
const storage = require('node-persist')

const DMResponse = require('./modules/lib/Response/DirectMessage')
const EmbedResponse = require('./modules/lib/Response/Embed')
const FileEmbedResponse = require('./modules/lib/Response/FileEmbed')
const UnTaggedResponse = require('./modules/lib/Response/UnTagged')

class DiscordBot extends EventEmitter {
    constructor (env, discord) {
        super()

        this.discord = discord
        this.storage = storage
        this.modules = {}
        this.triggers = {}
        this.config = env

        if (env.hasOwnProperty('persistsDir')) {
            const persistenceDir = path.resolve(env.persistsDir)
            logger.debug(`Using '${persistenceDir}' for module persistence.`)

            try {
                fs.mkdirSync(persistenceDir, 0o644)
            } catch (e) {}

            storage.initSync({
                dir: env.persistsDir
            })
        }

        this.on('ready', () => {
            if (this.discord) {
                this.discord.user.setGame('node.js ' + process.version + ' on ' + os.type())
            }
        })

        this._loadModules()
    }

    destroy () {
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

        if (blacklist) {
            logger.warn('%s Not loading blacklisted module %s.',
                Common.IconDisabled,
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
            module.enabled ? Common.IconEnabled : Common.IconDisabled,
            colors.blue.bold(name),
            triggers.length ? triggers.join(', ').yellow.bold : 'nothing'
        )

        return module
    }

    _unloadModule (moduleName) {
        const module = this.getModuleByName(moduleName)
        const modulePath = this._findModulePathByName(moduleName)

        this._unloadModuleTriggers(module)

        Common.deleteNodeModule(modulePath)
        delete this.modules[moduleName]

        logger.info('%s Unloaded module %s.', Common.IconDisabled, colors.blue.bold(moduleName))
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
        module.destructor()
        this._unloadModuleTriggers(module)

        this.updateConfig()

        return module
    }

    enableModule (moduleName) {
        if (!this.hasModule(moduleName)) {
            throw 'No such module: ' + moduleName
        }

        const module = this.getModuleByName(moduleName)

        if (module.enabled) {
            throw 'Module is already enabled.'
        }

        module.enabled = true
        this._loadModuleTriggers(module)

        this.updateConfig()

        return module
    }

    reloadModule (moduleName) {
        let module = this.getModuleByName(moduleName)
        if (!module) {
            throw 'No such module: ' + moduleName
        }

        const modulePath = this._findModulePathByName(moduleName)

        this._unloadModule(moduleName)
        module = this._loadModule(modulePath)

        return module
    }

    _findModulePathByName (moduleName) {
        const modulePath = './modules/' + moduleName + '.js'

        if (!fs.existsSync(modulePath)) {
            return false
        }

        return modulePath
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

    sendChannelMessage (channelId, reply) {
        const channel = this.discord.channels.get(channelId)
        let promise

        if (reply instanceof EmbedResponse) {
            promise = channel.sendMessage(reply.content || '', reply.embed)
        } else {
            promise = channel.sendMessage(reply)
        }

        logger.info('Sent message to channel %s', this.getChannelString(channel))

        promise.catch(err => {
            this.emit('end', null)

            logger.error(err)
        })

        return promise
    }

    sendReply (message, reply) {
        let promise

        if (!reply) {
            throw 'the command/query surprisingly had no response.'
        }

        if (util.isString(reply)) {
            promise = message.reply(reply)

            if (message.channel.type === 'text') {
                logger.info('Replied to %s in channel %s',
                    this.getAuthorString(message.author),
                    this.getChannelString(message.channel)
                )
            } else if (message.channel.type === 'dm') {
                logger.info('Replied to direct message from %s: %s',
                    this.getAuthorString(message.channel.recipient),
                    colors.white.bold(reply)
                )
            }
        } else if (util.isObject(reply)) {
            if (reply instanceof FileEmbedResponse) {
                promise = message.channel.sendFile(reply.file, null, reply.content || '')

                logger.info('Sent message to channel %s initiated by %s',
                    this.getChannelString(message.channel),
                    this.getAuthorString(message.author)
                )
            } else if (reply instanceof DMResponse) {
                promise = message.author.sendMessage(reply.content)

                logger.info('Sent DM as a reply to message from %s in %s',
                    this.getAuthorString(message.author),
                    this.getChannelString(message.channel)
                )
            } else if (reply instanceof EmbedResponse) {
                promise = message.channel.sendMessage('', reply)

                logger.info('Sent message to channel %s initiated by %s',
                    this.getChannelString(message.channel),
                    this.getAuthorString(message.author)
                )
            } else {
                promise = message.channel.sendMessage(reply.content)

                logger.info('Sent message to channel %s initiated by %s',
                    this.getChannelString(message.channel),
                    this.getAuthorString(message.author)
                )
            }
        }

        promise.catch(err => {
            this.emit('end', message)

            logger.error(err)
        })

        return promise
    }

    getChannelString (channel) {
        return colors.cyan.bold('#' + channel.name)
    }

    getModuleByTrigger (value) {
        if (this.triggers.hasOwnProperty(value)) {
            return this.modules[this.triggers[value]]
        }

        return false
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

    async processMessage (message) {
        const trigger = message.content.split(' ', 2)[0]
        const module = this.getModuleByTrigger(trigger)

        if (!module) {
            return
        }

        const permission = module.allowed(message.member)
        const logLevel = permission ? 'info' : 'warn'

        logger[logLevel]("%s: %s%s requested '%s' (%s)",
            permission ? 'Accepted'.green.bold : 'Denied'.red.bold,
            this.getAuthorString(message.member.user),
            message.member.nickname ? ' (' + message.member.nickname + ')' : '',
            colors.cyan(module.getName()),
            colors.yellow(message.content)
        )

        if (!permission) {
            throw 'Access denied.'
        }

        this.emit('begin', message)

        let timeoutProcessingRequest = setTimeout(() => {
            message.reply('something\'s not quite right! Timeout while processing your request. Something went awry.')
            this.emit('end', message)
        }, 15 * 1000)

        try {
            const reply = await module.Message(message)

            this.sendReply(message, reply)

        } catch (err) {
            if (err) {
                this.sendReply(message, err)
            }
        }

        clearTimeout(timeoutProcessingRequest)

        this.emit('end', message)
    }
}

module.exports = DiscordBot
