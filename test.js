const assert = require('assert')
const cratos = require('.')
const nodePath = require('path')

const pathResolve = nodePath.resolve

const aok = assert.ok
const ase = assert.strictEqual
const ade = assert.deepEqual

describe('cratos', () => {
  describe('parseArgv', () => {
    it('parses argv into entrypoint, command, and arguments with path', async () => {
      ade(
        cratos.parseArgv(['node', 'cli.js', 'ls', '--hey=a', '--ho', '.']),
        {
          entrypoints: [pathResolve('.')],
          command: 'ls',
          arguments: ['--hey=a', '--ho'],
        }
      )
    })
    it('no path, environmental CRATOS_PATH', async () => {
      process.env.CRATOS_PATH = '/opt/'
      ade(
        cratos.parseArgv(['node', 'cli.js', 'ls', '--hey=a', '--ho']),
        {
          entrypoints: ['/opt'],
          command: 'ls',
          arguments: ['--hey=a', '--ho'],
        }
      )
      process.env.CRATOS_PATH = ''
    })
    it('no path, environmental HOME', async () => {
      aok(process.env.HOME)
      ade(
        cratos.parseArgv(['node', 'cli.js', 'ls', '--hey=a', '--ho']),
        {
          entrypoints: [process.env.HOME],
          command: 'ls',
          arguments: ['--hey=a', '--ho'],
        }
      )
    })
    it('no arguments, has path', async () => {
      aok(process.env.HOME)
      ade(
        cratos.parseArgv(['node', 'cli.js', 'ls', '.']),
        {
          entrypoints: [pathResolve('.')],
          command: 'ls',
          arguments: [],
        }
      )
    })
    it('no arguments, no path', async () => {
      aok(process.env.HOME)
      ade(
        cratos.parseArgv(['node', 'cli.js', 'ls']),
        {
          entrypoints: [process.env.HOME],
          command: 'ls',
          arguments: [],
        }
      )
    })
  })
})
