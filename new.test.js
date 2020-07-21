const isDeepEqual = require('rubico/x/isDeepEqual')
const assert = require('assert')
const cratos = require('./new')

const ade = assert.deepEqual

const ase = assert.strictEqual

describe('cratos', () => {
  it('responds with usage on base command', async () => {
    ade(
      cratos(['node', './cli.js']),
      {
        arguments: [],
        flags: [],
        command: {
          type: 'USAGE',
        },
      },
    )
    ade(
      cratos(['/usr/bin/node', '/usr/bin/cratos', '--yo']),
      {
        arguments: [],
        flags: ['--yo'],
        command: {
          type: 'USAGE',
        },
      },
    )
  })

  it('responds with usage on --help', async () => {
    ade(
      cratos(['/usr/bin/node', '/usr/bin/cratos', '--help']),
      {
        arguments: [],
        flags: ['--help'],
        command: {
          type: 'USAGE',
        },
      },
    )
  })

  it('responds with usage on -h', async () => {
    ade(
      cratos(['/usr/bin/node', '/usr/bin/cratos', '-h']),
      {
        arguments: [],
        flags: ['-h'],
        command: {
          type: 'USAGE',
        },
      },
    )
  })

  it('responds with usage on invalid command', async () => {
    ade(
      cratos(['/usr/bin/node', '/usr/bin/cratos', 'hey']),
      {
        arguments: ['hey'],
        flags: [],
        command: {
          type: 'INVALID_USAGE',
        },
      },
    )
  })
})
