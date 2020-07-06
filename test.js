const rubico = require('rubico')
const assert = require('assert')
const cratos = require('.')
const nodePath = require('path')
const util = require('util')

const { inspect } = util

const {
  pipe, fork, assign,
  tap, tryCatch, switchCase,
  map, filter, reduce, transform,
  any, all, and, or, not,
  eq, gt, lt, gte, lte,
  get, pick, omit,
} = rubico

const pathResolve = nodePath.resolve

const isIterable = x => isDefined(x) && isDefined(x[Symbol.iterator])

const is = fn => x => x && x.constructor === fn

const exists = x => typeof x !== 'undefined' && x !== null

const areTypesEqual = (a, b) => (exists(a) && exists(b)
  && typeof a === typeof b && a.constructor === b.constructor)

// (any, any) => ()
const assertEqual = (
  expect,
  actual,
  original = { expect, actual },
) => {
  if (!areTypesEqual(expect, actual)) {
    throw new Error([
      `type mismatch; ${inspect(expect)} ${inspect(actual)}`,
      util.inspect(original, { maxDepth: Infinity }),
    ].join('; '))
  }
  if (is(Object)(expect) && is(Object)(actual)) {
    for (const keyE in expect) {
      assertEqual(expect[keyE], actual[keyE], original)
    }
    for (const keyA in actual) {
      assertEqual(expect[keyA], actual[keyA], original)
    }
    return
  }
  if (is(Array)(expect) && is(Array)(actual)) {
    if (expect.length !== actual.length) {
      throw new Error([
        `${inspect(expect)}.length !== ${inspect(actual)}.length`,
        util.inspect(original, { maxDepth: Infinity }),
      ].join('; '))
    }
    for (let i = 0; i < expect.length; i++) {
      assertEqual(expect[i], actual[i], original)
    }
    return
  }
  if (expect === actual) return
  throw new Error([
    `${expect} !== ${actual}`,
    inspect(original, { maxDepth: Infinity }),
  ].join('; '))
}

const assertOk = assert.ok

const writeStdout = process.stdout.write.bind(process.stdout)

const captureStdout = f => x => {
  let output = ''
  process.stdout.write = (chunk, encoding, cb) => {
    if (typeof chunk === 'string') output += chunk
    // writeStdout(chunk, encoding, cb)
  }
  f(x)
  process.stdout.write = writeStdout // release stdout
  return output
}

describe('cratos', () => {
  describe('parseArgv', () => {
    it('cratos', async () => {
      assertEqual({ arguments: [], flags: [] },
        cratos.parseArgv(['node', 'cratos']),
      )
    })

    it('cratos -h', async () => {
      assertEqual({ arguments: [], flags: ['-h'] },
        cratos.parseArgv(['node', 'cratos', '-h']),
      )
    })

    it('cratos --help', async () => {
      assertEqual({ arguments: [], flags: ['--help'] },
        cratos.parseArgv(['node', 'cratos', '--help']),
      )
    })

    it('cratos --unrecognied', async () => {
      assertEqual({ arguments: [], flags: [] },
        cratos.parseArgv(['node', 'cratos', '--unrecognied']),
      )
    })

    it('cratos some-command', async () => {
      assertEqual({ arguments: ['some-command'], flags: [] },
        cratos.parseArgv(['node', 'cratos', 'some-command']),
      )
    })

    it('cratos some-command -n', async () => {
      assertEqual({ arguments: ['some-command'], flags: ['-n'] },
        cratos.parseArgv(['node', 'cratos', 'some-command', '-n']),
      )
    })

    it('cratos some-command --dry-run', async () => {
      assertEqual({ arguments: ['some-command'], flags: ['--dry-run'] },
        cratos.parseArgv(['node', 'cratos', 'some-command', '--dry-run']),
      )
    })

    it('cratos dist patch', async () => {
      assertEqual({ arguments: ['dist', 'patch'], flags: [] },
        cratos.parseArgv(['node', 'cratos', 'dist', 'patch']),
      )
    })

    it('cratos dist patch -n', async () => {
      assertEqual({ arguments: ['dist', 'patch'], flags: ['-n'] },
        cratos.parseArgv(['node', 'cratos', 'dist', 'patch', '-n']),
      )
    })
  })

  describe('switchCommand', () => {
    it('cratos', async () => {
      assertEqual(
        cratos.getUsage(),
        captureStdout(cratos.switchCommand)({
          arguments: [],
          flags: [],
        }),
      )
    })

    it('cratos -h', async () => {
      assertEqual(
        cratos.getUsage(),
        captureStdout(cratos.switchCommand)({
          arguments: [],
          flags: ['-h'],
        }),
      )
    })

    it('cratos --help', async () => {
      assertEqual(
        cratos.getUsage(),
        captureStdout(cratos.switchCommand)({
          arguments: [],
          flags: ['--help'],
        }),
      )
    })

    it('cratos unknown', async () => {
      assertEqual(
        `unknown is not a cratos command\n${cratos.getUsage()}`,
        captureStdout(cratos.switchCommand)({
          arguments: ['unknown'],
          flags: [],
        }),
      )
    })
  })
})
