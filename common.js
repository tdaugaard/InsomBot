const colors = require('colors')

class Common {
    static * objectIterator (obj) {
        for (let k in obj) {
            if (obj.hasOwnProperty(k)) {
                yield obj[k]
            }
        }
    }

    static logRequestCompletion (logger, endpoint, err, res) {
        logger.debug("%s: Fetched '%s' (%d)%s",
            err ? 'Error' : 'Success',
            colors.cyan(endpoint),
            res.statusCode,
            res.hasOwnProperty('cached') && res.cached ? ' [Cached]' : ''
        )
    }

    static getIntegerBetween (value, options) {
        value = value ? parseInt(value) : value
        options = Object.assign({min: 0, max: Number.MAX_SAFE_INTEGER, default: 0}, options)

        if (!value) {
            return options.default
        }

        if (value < options.min) {
            return options.min
        }
        if (value > options.max) {
            return options.max
        }

        return value
    }

    static relativeTime (ms) {
        const divisors = [
            {d: 86400, n: 'd'},
            {d: 3600, n: 'h'},
            {d: 60, n: 'm'},
            {d: 1, n: 's'}
        ]
        let values = []

        ms /= 1000

        for (const divisor of divisors) {
            const value = Math.floor(ms / divisor.d)

            if (value) {
                ms -= value * divisor.d
                values.push(value + divisor.n)
            }
        }

        return values.slice(0, 2).join(' ')
    }

    static deleteNodeModule (moduleName) {
        const solvedName = require.resolve(moduleName)
        const nodeModule = require.cache[solvedName]

        if (nodeModule) {
            for (var i = 0; i < nodeModule.children.length; i++) {
                const child = nodeModule.children[i]
                Common.deleteNodeModule(child.filename)
            }
            delete require.cache[solvedName]
        }
    }
}

module.exports = Common
