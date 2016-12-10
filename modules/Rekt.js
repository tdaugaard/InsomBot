'use strict'

const CommandModule = require('../CommandModule')
const shuffle = require('shuffle-array')

class RektModule extends CommandModule {
    constructor (parent, config) {
        super(parent, config)

        this.addTrigger('!rekt', {
            'short': 'Shows someone what they are.',
            'params': [
                'rekts = 4 (max 10)'
            ]
        })

        this.rekts = [
            'REKT',
            'Really Rekt',
            'REKTangle',
            'SHREKT',
            'REKT-it Ralph',
            'Total REKTall',
            'The Lord of the REKT',
            'The Usual SusREKTs',
            'North by NorthREKT',
            'REKT to the Future',
            'Once Upon a Time in the REKT',
            'Full mast erektion',
            'Rektum',
            'Resurrekt',
            'CorRekt',
            'Indirekt',
            'Tyrannosaurus Rekt',
            'Cash4Rekt.com',
            'Grapes of Rekt',
            'Ship Rekt',
            'Rekt markes the spot',
            'Caught rekt handed',
            'The Rekt Side Story',
            'Singin\' In The Rekt',
            'Painting The Roses Rekt',
            'Rekt Van Winkle',
            'Parks and Rekt',
            'Lord of the Rekts: The Reking of the King',
            'Star Trekt',
            'The Rekt Prince of Bel-Air',
            'A Game of Rekt',
            'Rektflix',
            'Rekt it like it\'s hot',
            'RektBox 360',
            'The Rekt-men',
            'School Of Rekt',
            'I am Fire, I am Rekt',
            'Rekt and Roll',
            'Professor Rekt',
            'Catcher in the Rekt',
            'Rekt-22',
            'Harry Potter: The Half-Rekt Prince',
            'Great Rektspectations',
            'Paper Scissors Rekt',
            'RektCraft',
            'Grand Rekt Auto V',
            'Call of Rekt: Modern Reking 2',
            'Legend Of Zelda: Ocarina of Rekt',
            'Rekt It Ralph',
            'Left 4 Rekt',
            '2 Girls 1 Rekt',
            'Pokemon: Fire Rekt',
            'The Shawshank Rektemption',
            'The Rektfather',
            'The Rekt Knight',
            'Fiddler on the Rekt',
            'The Rekt Files',
            'The Good, the Bad, and The Rekt',
            'Forrekt Gump',
            'The Silence of the Rekts',
            'The Green Rekt',
            'Gladirekt',
            'Spirekted Away',
            'Terminator 2: Rektment Day',
            'The Rekt Knight Rises',
            'The Rekt King',
            'REKT-E',
            'Citizen Rekt',
            'Requiem for a Rekt',
            'REKT TO REKT ass to ass',
            'Star Wars: Episode VI - Return of the Rekt',
            'Braverekt',
            'Batrekt Begins',
            '2001: A Rekt Odyssey',
            'The Wolf of Rekt Street',
            'Rekt\'s Labyrinth',
            '12 Years a Rekt',
            'Gravirekt',
            'Finding Rekt',
            'The Arekters',
            'There Will Be Rekt',
            'Christopher Rektellston',
            'Hachi: A Rekt Tale',
            'The Rekt Ultimatum',
            'Shrekt',
            'Rektal Exam',
            'Rektium for a Dream',
            'Erektile Dysfunction'
        ]
    }

    _pickRekts (params) {
        let howManyRekts = 3
        let str = '\n'

        if (params.length >= 1) {
            howManyRekts = parseInt(params[0]) - 1
            if (howManyRekts > 10) {
                howManyRekts = 10
            }
        }

        str += '\n'
        str += '☐ Not REKT\n'
        str += shuffle(this.rekts)
            .slice(0, howManyRekts)
            .map(v => '☒ ' + v)
            .join('\n')

        return str
    }

    Message (message) {
        const params = this._getParams(message)

        return Promise.resolve(this._pickRekts(params))
    }
}

module.exports = (parent, config) => {
    return new RektModule(parent, config)
}
