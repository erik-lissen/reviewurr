import { Database } from 'bun:sqlite'

const db = new Database('reviewurr.db')

// Enable WAL mode for better concurrent read performance
db.run('PRAGMA journal_mode = WAL')

export { db }
