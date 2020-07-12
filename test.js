const rubico = require('rubico')
const execa = require('execa')
const assert = require('assert')
const nodePath = require('path')
const util = require('util')
const fs = require('fs')
const rimrafCb = require('rimraf')
const cratos = require('.')
const { version: cratosVersion } = require('./package.json')

const { inspect, promisify } = util

const rimraf = promisify(rimrafCb)

const {
  pipe, fork, assign,
  tap, tryCatch, switchCase,
  map, filter, reduce, transform,
  any, all, and, or, not,
  eq, gt, lt, gte, lte,
  get, pick, omit,
} = rubico

const identity = x => x

const pathResolve = nodePath.resolve

const isDefined = x => typeof x !== 'undefined' && x !== null

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

const isPromise = x => x && typeof x.then === 'function'

const captureStdout = f => x => {
  let output = ''
  process.stdout.write = (chunk, encoding, cb) => {
    if (typeof chunk === 'string') output += chunk
    // writeStdout(chunk, encoding, cb)
  }
  const y = f(x)
  return isPromise(y) ? y.then(res => (
    process.stdout.write = writeStdout, // release stdout
    [y, output]
  )) : (
    process.stdout.write = writeStdout, // release stdout
    [y, output]
  )
}

const git = (args, path) => execa('git', [
  `--git-dir=${pathResolve(path, '.git')}`,
  `--work-tree=${path}`,
  ...args,
])

const createProjectFixture = path => fork.series([
  path => fs.promises.mkdir(pathResolve(path), { recursive: true }),
  path => git(['init'], pathResolve(path)),
  path => fs.promises.writeFile(
    pathResolve(path, 'package.json'),
    JSON.stringify({ name: 'ayo', version: '0.0.1' }, null, 2),
  ),
])(path)

const createEmptyProjectFixture = path => fs.promises.mkdir(path, { recursive: true })

const pathToProject = pipe([
  glob => pathResolve(__dirname, glob),
  createProjectFixture,
])

const pathToEmpty = pipe([
  glob => pathResolve(__dirname, glob),
  createEmptyProjectFixture,
])

const createFileFromString = (path, s) => fs.promises.writeFile(pathResolve(path), s)

const HOME = process.env.HOME

describe('cratos', () => {
  describe('parseArgv', () => {
    it('cratos', async () => {
      assertEqual({ arguments: [], flags: [] },
        cratos.parseArgv(['node', 'cratos']),
      )
    })
    it('cratos -v', async () => {
      assertEqual({ arguments: [], flags: ['-v'] },
        cratos.parseArgv(['node', 'cratos', '-v']),
      )
    })
    it('cratos --version', async () => { assertEqual({ arguments: [], flags: ['--version'] },
        cratos.parseArgv(['node', 'cratos', '--version']),
      )
    })
    it('cratos --path=.', async () => { assertEqual({ arguments: [], flags: ['--path=.'] },
        cratos.parseArgv(['node', 'cratos', '--path=.']),
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

  describe('walkPathForModuleNames', () => {
    afterEach(async () => {
      await rimraf(pathResolve(__dirname, 'tmp'))
    })
    it('one valid project', async () => {
      await pathToProject('tmp/project')
      assertEqual(
        await cratos.walkPathForModuleNames(pathResolve(__dirname, 'tmp')),
        [pathResolve(__dirname, 'tmp/project')],
      )
    })
    it('multiple valid projects', async () => {
      await map(pathToProject)([
        'tmp/project',
        'tmp/a/project',
        'tmp/b/c/project',
      ])
      assertEqual(
        await cratos.walkPathForModuleNames(pathResolve(__dirname, 'tmp')),
        [
          pathResolve(__dirname, 'tmp/a/project'),
          pathResolve(__dirname, 'tmp/b/c/project'),
          pathResolve(__dirname, 'tmp/project'),
        ],
      )
    })
    it('empty', async () => {
      await pathToEmpty('tmp/')
      assertEqual(
        await cratos.walkPathForModuleNames(pathResolve(__dirname, 'tmp')),
        [],
      )
    })
    it('ignores .git and node_modules', async () => {
      await map(pathToProject)([
        'tmp/.git/',
        'tmp/a/b/.git/',
        'tmp/node_modules/',
        'tmp/a/b/c/node_modules/',
      ])
      assertEqual(
        await cratos.walkPathForModuleNames(pathResolve(__dirname, 'tmp')),
        [],
      )
    })
    it('bunch of cases', async () => {
      await map(pathToProject)([
        'tmp/project',
        'tmp/project/sub/project',
        'tmp/a/b/c/d/project',
      ])
      await map(pathToEmpty)([
        'tmp/empty',
        'tmp/a/b/c/d/empty',
      ])
      assertEqual(
        await cratos.walkPathForModuleNames(pathResolve(__dirname, 'tmp')),
        [
          pathResolve(__dirname, 'tmp/a/b/c/d/project'),
          pathResolve(__dirname, 'tmp/project'),
        ],
      )
    })
  })

  describe('getPackageJSON', () => {
    afterEach(async () => {
      await rimraf(pathResolve(__dirname, 'tmp'))
    })
    it('reads and parses package.json for path', async () => {
      await pathToProject('tmp/project')
      const y = cratos.getPackageJSON('tmp/project')
      assertOk(y instanceof Promise)
      assertEqual(await y, {
        name: 'ayo',
        version: '0.0.1',
      })
    })
    it('throws Error on invalid path', async () => {
      await pathToEmpty('tmp/empty')
      assert.rejects(
        () => cratos.getPackageJSON('tmp/empty'),
        new Error(`ENOENT: no such file or directory, open '${pathResolve('tmp/empty', 'package.json')}'`),
      )
    })
    it('throws Error on empty path', async () => {
      assert.rejects(
        () => cratos.getPackageJSON('tmp/empty'),
        new Error(`ENOENT: no such file or directory, open '${pathResolve('tmp/empty', 'package.json')}'`),
      )
    })
  })

  describe('getGitStatus', () => {
    afterEach(async () => {
      await rimraf(pathResolve(__dirname, 'tmp'))
    })
    it('gets output of git status --short --porcelain for path', async () => {
      await pathToProject('tmp/project')
      await createFileFromString('tmp/project/hey', 'hey')
      const y = cratos.getGitStatus('tmp/project')
      assertOk(y instanceof Promise)
      assertEqual(await y, {
        branch: '## No commits yet on master',
        files: ['?? hey', '?? package.json'],
      })
    })
    it('throws Error on invalid path', async () => {
      await pathToEmpty('tmp/empty')
      assert.rejects(
        () => cratos.getGitStatus('tmp/empty'),
        new Error(`fatal: not a git repository: '${pathResolve('tmp/empty/.git')}'`),
      )
    })
    it('throws Error on not found path', async () => {
      assert.rejects(
        () => cratos.getGitStatus('tmp/notfound'),
        new Error(`fatal: not a git repository: '${pathResolve('tmp/notfound/.git')}'`),
      )
    })
  })

  describe('getModuleInfo', () => {
    afterEach(async () => {
      await rimraf(pathResolve(__dirname, 'tmp'))
    })
    const infoFields = new Set([
      'path', 'packageName', 'packageVersion',
      'gitStatusBranch', 'gitStatusFiles',
    ])
    it('gets info about a module', async () => {
      await pathToProject('tmp/project')
      const y = cratos.getModuleInfo('tmp/project')
      assertOk(y instanceof Promise)
      assertEqual(Object.keys(await y).length, infoFields.size)
      for (const field in await y) {
        assertOk(infoFields.has(field))
      }
    })
    it('throws some Error if not found', async () => {
      assert.rejects(
        () => cratos.getModuleInfo('tmp/notfound'),
        { name: 'Error' },
      )
    })
  })

  describe('findModules', () => {
    afterEach(async () => {
      await rimraf(pathResolve(__dirname, 'tmp'))
      process.env.CRATOS_PATH = ''
      process.env.HOME = HOME
    })
    it('finds modules in CRATOS_PATH', async () => {
      process.env.CRATOS_PATH = `${pathResolve('tmp/a')}:${pathResolve('tmp/project')}`
      const projectPaths = [
        'tmp/project',
        'tmp/a/project',
        'tmp/a/b/c/project',
      ]
      await map(pathToProject)(projectPaths)
      await pathToEmpty('tmp/empty')
      const y = cratos.findModules()
      assertOk(y instanceof Promise)
      const output = await y
      assertEqual(output.length, projectPaths.length)
      for (const path of projectPaths) {
        assertOk(
          isDefined(output.find(module => module.path === pathResolve(path)))
        )
      }
    })
    it('finds modules in HOME if no CRATOS PATH', async () => {
      assertOk(!process.env.CRATOS_PATH)
      process.env.HOME = pathResolve('tmp')
      const projectPaths = [
        'tmp/project',
        'tmp/a/project',
        'tmp/a/b/c/project',
      ]
      await map(pathToProject)(projectPaths)
      await pathToEmpty('tmp/empty')
      const [y, stdout] = await captureStdout(cratos.findModules)()
      assertEqual(stdout, '[WARNING] CRATOS_PATH not set; finding modules from HOME\n')
      assertOk(y instanceof Promise)
      const output = await y
      assertEqual(output.length, projectPaths.length)
      for (const path of projectPaths) {
        assertOk(
          isDefined(output.find(module => module.path === pathResolve(path)))
        )
      }
    })
    it('throws Error for no CRATOS_PATH nor HOME', async () => {
      assertOk(!process.env.CRATOS_PATH)
      process.env.HOME = ''
      assertOk(!process.env.HOME)
      assert.throws(
        cratos.findModules,
        new Error('no entrypoint found; CRATOS_PATH or HOME environment variables required'),
      )
    })
  })

  describe('switchCommand', () => {
    beforeEach(async () => {
      process.env.CRATOS_PATH = 'tmp'
    })
    afterEach(async () => {
      await rimraf(pathResolve(__dirname, 'tmp'))
      process.env.CRATOS_PATH = ''
    })
    it('cratos', async () => {
      assertEqual(
        cratos.getUsage(),
        captureStdout(cratos.switchCommand)({
          arguments: [],
          flags: [],
        })[1],
      )
    })
    it('cratos -h', async () => {
      assertEqual(
        cratos.getUsage(),
        captureStdout(cratos.switchCommand)({
          arguments: [],
          flags: ['-h'],
        })[1],
      )
    })
    it('cratos --help', async () => {
      assertEqual(
        cratos.getUsage(),
        captureStdout(cratos.switchCommand)({
          arguments: [],
          flags: ['--help'],
        })[1],
      )
    })
    it('cratos -v', async () => {
      assertEqual(
        'v' + cratosVersion + '\n',
        captureStdout(cratos.switchCommand)({
          arguments: [],
          flags: ['-v'],
        })[1],
      )
    })
    it('cratos --version', async () => {
      assertEqual(
        'v' + cratosVersion + '\n',
        captureStdout(cratos.switchCommand)({
          arguments: [],
          flags: ['--version'],
        })[1],
      )
    })
    it('cratos list; list cratos modules', async () => {
      await map(pathToProject)([
        'tmp/a/project',
        'tmp/b/c/project',
        'tmp/project',
      ])
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['list'],
        flags: [],
      }))[1], [
        'ayo-0.0.1',
        'ayo-0.0.1',
        'ayo-0.0.1',
      ].join('\n') + '\n')
    })
    it('cratos list; turns up empty', async () => {
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['list'],
        flags: [],
      }))[1], '')
    })
    it('cratos ls; list cratos modules', async () => {
      await map(pathToProject)([
        'tmp/a/project',
        'tmp/b/c/project',
        'tmp/project',
      ])
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['ls'],
        flags: [],
      }))[1], [
        'ayo-0.0.1',
        'ayo-0.0.1',
        'ayo-0.0.1',
      ].join('\n') + '\n')
    })
    it('cratos ls; turns up empty', async () => {
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['ls'],
        flags: [],
      }))[1], '')
    })
    it('cratos status; get git status for cratos modules', async () => {
      await map(pathToProject)([
        'tmp/a/project',
        'tmp/b/c/project',
        'tmp/project',
      ])
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['status'],
        flags: [],
      }))[1], [
        'ayo ?? package.json',
        'ayo ?? package.json',
        'ayo ?? package.json',
      ].join('\n') + '\n')
    })
    it('cratos status; turns up empty', async () => {
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['status'],
        flags: [],
      }))[1], '')
    })
    it('cratos s; get git status for cratos modules', async () => {
      await map(pathToProject)([
        'tmp/a/project',
        'tmp/b/c/project',
        'tmp/project',
      ])
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['s'],
        flags: [],
      }))[1], [
        'ayo ?? package.json',
        'ayo ?? package.json',
        'ayo ?? package.json',
      ].join('\n') + '\n')
    })
    it('cratos s; turns up empty', async () => {
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['s'],
        flags: [],
      }))[1], '')
    })
    it('cratos branch; get git branch for cratos modules', async () => {
      await map(pathToProject)([
        'tmp/a/project',
        'tmp/b/c/project',
        'tmp/project',
      ])
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['branch'],
        flags: [],
      }))[1], [
        'ayo No commits yet on master',
        'ayo No commits yet on master',
        'ayo No commits yet on master',
      ].join('\n') + '\n')
    })
    it('cratos branch; turns up empty', async () => {
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['branch'],
        flags: [],
      }))[1], '')
    })
    it('cratos b; get git branch for cratos modules', async () => {
      await map(pathToProject)([
        'tmp/a/project',
        'tmp/b/c/project',
        'tmp/project',
      ])
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['b'],
        flags: [],
      }))[1], [
        'ayo No commits yet on master',
        'ayo No commits yet on master',
        'ayo No commits yet on master',
      ].join('\n') + '\n')
    })
    it('cratos b; turns up empty', async () => {
      assertEqual((await captureStdout(cratos.switchCommand)({
        arguments: ['b'],
        flags: [],
      }))[1], '')
    })
    it('cratos unknown', async () => {
      assertEqual(
        `unknown is not a cratos command\n${cratos.getUsage()}`,
        captureStdout(cratos.switchCommand)({
          arguments: ['unknown'],
          flags: [],
        })[1],
      )
    })
  })
})
