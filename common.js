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
}

module.exports = Common
