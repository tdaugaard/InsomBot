function PlayerAttendance (data) {
    this.name = ''

    this.firstAttendance = 0
    this.lastAttendance = 0

    this.raids = {
        ids: [],
        missed: [],
        possible: 0,
        num: 0,
        pct: 0
    }

    this.fights = {
        num: 0,
        pct: 0
    }

    if (data) {
        Object.assign(this, data)
    }
}

module.exports = PlayerAttendance
