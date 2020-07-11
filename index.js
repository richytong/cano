const rubico = require('rubico')
const trace = require('rubico/x/trace')
const execa = require('execa')
const nodePath = require('path')
const fs = require('fs')

const {
  pipe, fork, assign,
  tap, tryCatch, switchCase,
  map, filter, reduce, transform, flatMap,
  any, all, and, or, not,
  eq, gt, lt, gte, lte,
  get, pick, omit,
} = rubico

const identity = x => x

const pathResolve = nodePath.resolve

const isDefined = x => typeof x !== 'undefined' && x !== null

const last = arr => get(arr.length - 1)(arr)

const slice = (from, to) => arr => arr.slice(
  from,
  typeof to === 'undefined' ? undefined : to === -1 ? arr.length - 1 : to,
)

const log = (...args) => x => tap(() => console.log(
  ...args.map(arg => typeof arg === 'function' ? arg(x) : arg),
))(x)

const includes = value => arr => arr.includes(value)

const isEmpty = x => x.length === 0

const split = delim => s => s.split(delim)

const USAGE = `
usage: cratos [--version] [-v] [--help] [-h] <command> [<args>]

commands:

    list, ls                      list all modules
    s[tatus]                      git status on all modules
    ch[eckout] <branch>           conservative git checkout branch for all modules
    fetch                         fetch remotes for all modules
    merge                         conservative git merge current branch with upstream for all modules
    pull                          conservative git pull upstream into current branch for all modules
    push                          conservative git push current branch to upstream for all modules
    dist <major|minor|patch>      version bump && publish all modules, skip unchanged modules
    clean                         git clean -fxdq for all modules
    i[nstall]                     install all module dependencies into module local node_modules, does not create package-lock
    link, ln                      symlink all modules selectively into all modules\' local node_modules
`.trimStart()
//     test <path|module>            run module tests defined by test script or mocha at module root
//     run <script> <path|module>    run module script

const FLAGS = new Set(['-h', '--help', '-n', '--dry-run'])

// string => boolean
const isFlag = s => FLAGS.has(s)

// string => string => boolean
const startsWith = prefix => s => s.startsWith(prefix)

/* argv [string] => parsedArgv {
 *   arguments: [string],
 *   flags: [string],
 * }
 */
const parseArgv = argv => fork({
  arguments: pipe([
    filter(and([
      not(startsWith('-')),
      not(isFlag),
    ])),
    slice(2), // node ./cli.js ...
  ]),
  flags: filter(isFlag),
})(argv)

const hasEnvVar = name => () => !!process.env[name]

// Directory {
//   path: string,
//   dirents: [NodeDirent],
// } => boolean
const isCratosModule = ({ dirents }) => pipe([
  map(get('name')),
  and([
    includes('.git'),
    includes('package.json'),
  ]),
])(dirents)

const IGNORE_DIRS = new Set(['.git', 'node_modules'])

// NodeDirent => boolean
const isIgnoreDir = dirent => IGNORE_DIRS.has(dirent.name)

// path string => moduleNames [string]
const walkPathForModuleNames = pathArg => pipe([
  fork({
    path: identity,
    dirents: tryCatch(
      path => fs.promises.readdir(path, { withFileTypes: true }),
      () => [],
    ),
  }),
  switchCase([
    isCratosModule, ({ path }) => [path],
    ({ path, dirents }) => transform(pipe([
      filter(and([
        not(isIgnoreDir),
        dirent => dirent.isDirectory(),
      ])),
      flatMap(pipe([
        get('name'),
        dirName => pathResolve(path, dirName),
        walkPathForModuleNames,
      ])),
    ]), () => [])(dirents),
  ]),
])(pathArg)

// path string => packageJSON object
const readPackageJSON = pathArg => pipe([
  path => pathResolve(path, 'package.json'),
])(pathArg)

// path string => gitStatus object
const getGitStatus = pathArg => pipe([
  tryCatch(
    path => execa('git', [
      `--git-dir=${pathResolve(path, '.git')}`,
      `--work-tree=${path}`,
      'status',
      '--porcelain',
      '--branch',
    ]),
    () => ({ stdout: [] }),
  ),
  get('stdout'),
])(pathArg)

/* path string => module {
 *   name: string,
 *   version: string,
 * }
 */
const getModuleInfo = pathArg => pipe([
  fork({
    packageJSON: readPackageJSON,
    gitStatus: getGitStatus,
  }),
])(pathArg)

// parsedArgv => modulePaths [string]
const findModules = pipe([
  switchCase([
    gt(1, get('arguments.length')), pipe([get('arguments'), last]),
    hasEnvVar('CRATOS_PATH'), () => process.env.CRATOS_PATH,
    hasEnvVar('HOME'), () => process.env.HOME,
    () => {
      throw new RangeError('no entrypoint found; CRATOS_PATH or HOME environment variables required')
    },
  ]),
  split(':'),
  map(pipe([
    pathResolve,
    walkPathForModuleNames,
  ])),
])

// parsedArgv => ()
const commandList = parsedArgv => pipe([
  getEntrypoints,
])(parsedArgv)

// string => parsedArgv => boolean
const hasFlag = flag => ({ flags }) => flags.includes(flag)

// parsedArgv => boolean
const isBaseCommand = ({ arguments }) => arguments.length === 0

// string => parsedArgv => boolean
const isCommand = cmd => ({ arguments }) => arguments[0] === cmd

// parsedArgv => ()
const switchCommand = parsedArgv => switchCase([
  or([
    hasFlag('--help'),
    hasFlag('-h'),
    isBaseCommand,
  ]), log(USAGE),
  or([
    isCommand('ls'),
    isCommand('list'),
  ]), commandList,
  log(x => `${x.arguments[0]} is not a cratos command\n${USAGE}`),
])(parsedArgv)

// argv [string] => ()
function cratos(argv) {
  return pipe([
    parseArgv,
    switchCommand,
  ])(argv)
}

cratos.getUsage = () => USAGE + '\n'
cratos.parseArgv = parseArgv
cratos.walkPathForModuleNames = walkPathForModuleNames
cratos.readPackageJSON = readPackageJSON
cratos.getGitStatus = getGitStatus
cratos.commandList = commandList
cratos.switchCommand = switchCommand

module.exports = cratos
