const rubico = require('rubico')
const trace = require('rubico/x/trace')
const tracef = require('rubico/x/tracef')
const execa = require('execa')
const assert = require('assert')
const rimrafCb = require('rimraf')
const nodePath = require('path')
const util = require('util')
const fs = require('fs')
const { promisify } = require('util')
const ryt = require('.')
const rytPackageJSON = require('./package.json')

const {
  pipe, fork, assign,
  tap, tryCatch, switchCase,
  map, filter, reduce, transform,
  any, all, and, or, not,
  eq, gt, lt, gte, lte,
  get, pick, omit,
} = rubico

const pathResolve = nodePath.resolve

const rimraf = promisify(rimrafCb)

const ade = assert.deepEqual

const ase = assert.strictEqual

const git = (args, path) => execa('git', [
  `--git-dir=${pathResolve(path, '.git')}`,
  `--work-tree=${path}`,
  ...args,
])

const createProjectFixture = (path, packageJSON) => fork.series([
  path => fs.promises.mkdir(pathResolve(path), { recursive: true }),
  path => git(['init'], pathResolve(path)),
  fork([
    path => fs.promises.writeFile(
      pathResolve(path, 'package.json'),
      JSON.stringify(packageJSON, null, 2),
    ),
    path => fs.promises.writeFile(
      pathResolve(path, 'index.js'),
      `
module.exports = {}
`.trimStart(),
    ),
  ]),
])(path)

const createEmptyDirectory = path => fs.promises.mkdir(path, { recursive: true })

describe('ryt', () => {
  beforeEach(() => {
    process.env.RYT_PATH = 'tmp'
  })

  afterEach(async () => {
    await rimraf('tmp')
  })

  it('base command', async () => {
    ade(
      ryt(['node', './cli.js']),
      {
        args: [],
        flags: [],
        command: {
          type: 'USAGE',
          body: {},
        },
      },
    )
    ade(
      ryt(['/usr/bin/node', '/usr/bin/ryt', '--yo']),
      {
        args: [],
        flags: ['--yo'],
        command: {
          type: 'USAGE',
          body: {},
        },
      },
    )
  })

  it('invalid command', async () => {
    ade(
      ryt(['/usr/bin/node', '/usr/bin/ryt', 'hey']),
      {
        args: ['hey'],
        flags: [],
        command: {
          type: 'INVALID_USAGE',
          body: {},
        },
      },
    )
  })

  it('--version', async () => {
    ade(
      ryt(['node', 'ryt', '--version']),
      {
        args: [],
        flags: ['--version'],
        command: {
          type: 'VERSION',
          body: {
            version: rytPackageJSON.version,
          },
        },
      },
    )
  })

  it('-v', async () => {
    ade(
      ryt(['node', 'ryt', '-v']),
      {
        args: [],
        flags: ['-v'],
        command: {
          type: 'VERSION',
          body: {
            version: rytPackageJSON.version,
          },
        },
      },
    )
  })

  it('--help', async () => {
    ade(
      ryt(['/usr/bin/node', '/usr/bin/ryt', '--help']),
      {
        args: [],
        flags: ['--help'],
        command: {
          type: 'USAGE',
          body: {},
        },
      },
    )
  })

  it('-h', async () => {
    ade(
      ryt(['/usr/bin/node', '/usr/bin/ryt', '-h']),
      {
        args: [],
        flags: ['-h'],
        command: {
          type: 'USAGE',
          body: {},
        },
      },
    )
  })

  /*
   * string => packageJSON {
   *   name: string,
   *   version: string,
   * }
   */
  const generatePackageJSON = s => ({
    name: `new-project-${s}`,
    version: `0.0.${s.charCodeAt(0)}`,
  })

  it('list', async () => {
    await map(
      s => createProjectFixture(`tmp/${s}`, generatePackageJSON(s)),
    )(['a', 'b', 'c'])
    await map(
      s => createEmptyDirectory(`tmp/${s}`)
    )(['d', 'e', 'f'])
    await pipe([
      ryt,
      x => {
        ade(x.args, ['list'])
        ade(x.flags, [])
        ase(x.command.type, 'LIST')
        ase(x.command.body.modules.length, 3)
      },
    ])(['/usr/bin/node', '/usr/bin/ryt', 'list'])
  })

  it('ls', async () => {
    await map(
      s => createProjectFixture(`tmp/${s}`, generatePackageJSON(s)),
    )(['a', 'b', 'c'])
    await map(
      s => createEmptyDirectory(`tmp/${s}`)
    )(['d', 'e', 'f'])
    await pipe([
      ryt,
      x => {
        ade(x.args, ['ls'])
        ade(x.flags, [])
        ase(x.command.type, 'LIST')
        ase(x.command.body.modules.length, 3)
      },
    ])(['/usr/bin/node', '/usr/bin/ryt', 'ls'])
  })

  it('ls, no env.RYT_PATH, yes env.HOME', async () => {
    delete process.env.RYT_PATH
    process.env.HOME = 'tmp'
    await map(
      s => createProjectFixture(`tmp/${s}`, generatePackageJSON(s)),
    )(['a', 'b', 'c'])
    await pipe([
      ryt,
      x => {
        ade(x.args, ['ls'])
        ade(x.flags, [])
        ase(x.command.type, 'LIST')
        ase(x.command.body.modules.length, 3)
      },
    ])(['/usr/bin/node', '/usr/bin/ryt', 'ls'])
  })

  it('ls, no env.RYT_PATH, no env.HOME', async () => {
    delete process.env.RYT_PATH
    delete process.env.HOME
    assert.throws(
      () => ryt(['/usr/bin/node', '/usr/bin/ryt', 'ls']),
      new Error('no entrypoint found; RYT_PATH or HOME environment variables required'),
    )
  })

  it('ls, --path=tmp', async () => {
    delete process.env.RYT_PATH
    delete process.env.HOME
    await map(
      s => createProjectFixture(`tmp/${s}`, generatePackageJSON(s)),
    )(['a', 'b', 'c'])
    await pipe([
      ryt,
      x => {
        ade(x.args, ['ls'])
        ade(x.flags, ['--path=tmp'])
        ase(x.command.type, 'LIST')
        ase(x.command.body.modules.length, 3)
      },
    ])(['/usr/bin/node', '/usr/bin/ryt', '--path=tmp', 'ls'])
    await pipe([
      ryt,
      x => {
        ade(x.args, ['ls'])
        ade(x.flags, ['--path=tmp'])
        ase(x.command.type, 'LIST')
        ase(x.command.body.modules.length, 3)
      },
    ])(['/usr/bin/node', '/usr/bin/ryt', 'ls', '--path=tmp'])
  })

  it('status', async () => {
    await map(
      s => createProjectFixture(`tmp/${s}`, generatePackageJSON(s)),
    )(['a', 'b', 'c'])
    await pipe([
      ryt,
      x => {
        ade(x.args, ['status'])
        ade(x.flags, [])
        ase(x.command.type, 'STATUS')
        ase(x.command.body.modules.length, 3)
      },
    ])(['node', 'ryt', 'status'])
  })

  it('s', async () => {
    await map(
      s => createProjectFixture(`tmp/${s}`, generatePackageJSON(s)),
    )(['a', 'b', 'c'])
    await pipe([
      ryt,
      x => {
        ade(x.args, ['s'])
        ade(x.flags, [])
        ase(x.command.type, 'STATUS')
        ase(x.command.body.modules.length, 3)
      },
    ])(['node', 'ryt', 's'])
  })
})
