function RaidAttendance (reports) {
    this.reports = reports
    this.raids = []
    this.fights = 0
    this.players = {}
    this.filtered = 0
    this.characterNames = []
}

module.exports = RaidAttendance
