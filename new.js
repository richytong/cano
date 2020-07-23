'use strict'

const rubico = require('rubico')
const trace = require('rubico/x/trace')
const tracef = require('rubico/x/tracef')
const last = require('rubico/x/last')
const execa = require('execa')
const fs = require('fs')
const nodePath = require('path')
const USAGE = require('./USAGE')
const cratosPackageJSON = require('./package.json')

const {
  pipe, fork, assign,
  tap, tryCatch, switchCase,
  map, filter, reduce, transform, flatMap,
  any, all, and, or, not,
  eq, gt, lt, gte, lte,
  get, pick, omit,
} = rubico

// any => any
const identity = x => x

// string => string
const pathResolve = nodePath.resolve

// (from number, to number) => arr [any] => slicedArr [any]
const slice = (from, to) => arr => arr.slice(
  from,
  to,
  // typeof to === 'undefined' ? undefined : to < 0 ? arr.length + to : to,
)

// string => [string]
const split = delim => s => s.split(delim)

// [any] => string
const join = delim => arr => arr.join(delim)

// value any => someArray [any] => boolean
const includes = value => arr => arr.includes(value)

// string => string
const lastWord = pipe([split(' '), last])

// prefix string => s string => boolean
const startsWith = prefix => s => s.startsWith(prefix)

// level string => (args ...any) => ()
const logWithLevel = level => (...args) => console.log(level, ...args)

const logger = {
  warn: logWithLevel('[WARNING]'),
}

// argv [string] => cleanedArgv [string]
const cleanArgv = slice(2)

/*
 * argv [string] => parsedArgv {
 *   args: [string],
 *   flags: [string],
 * }
 */
const parseArgv = pipe([
  cleanArgv,
  fork({
    args: filter(not(startsWith('-'))),
    flags: filter(startsWith('-')),
  }),
])

// parsedArgv { flags: [string] } => parsedFlags Map { parsedFlag string -> flagValue string|boolean }
const parseFlags = ({ flags }) => transform(
  map(pipe([
    flag => flag.split('='),
    fork([
      pipe([get(0), s => s.replace(/-/g, '')]),
      get(1, true),
    ]),
  ])),
  () => new Map(),
)(flags)

/*
 * parsedArgv {
 *   args: [string],
 *   flags: [string],
 * } => entryPath string
 */
const findEntryPath = pipe([
  parseFlags,
  switchCase([
    flags => flags.has('path'), flags => flags.get('path'),
    () => 'CRATOS_PATH' in process.env, () => process.env.CRATOS_PATH,
    () => 'HOME' in process.env, pipe([
      tap(() => {
        logger.warn('CRATOS_PATH not set; finding modules from HOME')
      }),
      () => process.env.HOME,
    ]),
    () => {
      throw new Error('no entrypoint found; CRATOS_PATH or HOME environment variables required')
    },
  ]),
])

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
const walkPathForModuleNames = pipe([
  fork({
    path: identity,
    dirents: tryCatch(
      path => fs.promises.readdir(path, { withFileTypes: true }),
      () => [],
    ),
  }),
  switchCase([
    isCratosModule, ({ path }) => [path],
    ({ path, dirents }) => transform(
      pipe([
        filter(and([
          not(isIgnoreDir),
          dirent => dirent.isDirectory(),
        ])),
        flatMap(pipe([
          get('name'),
          dirName => pathResolve(path, dirName),
          walkPathForModuleNames,
        ])),
      ]),
      () => [],
    )(dirents),
  ]),
])

/*
 * parsedArgv {
 *   args: [string],
 *   flags: [string],
 * } => modulePaths [string]
 */
const findModulePaths = pipe([
  findEntryPath,
  split(':'),
  flatMap(pipe([
    pathResolve,
    walkPathForModuleNames,
  ])),
])

/*
 * path string => packageJSON {
 *   name: string,
 *   version: string,
 * }
 */
const getPackageJSON = pipe([
  path => pathResolve(path, 'package.json'),
  fs.promises.readFile,
  JSON.parse,
])

// path string => gitStatus object
const getGitStatus = pipe([
  tryCatch(
    path => execa('git', [
      `--git-dir=${pathResolve(path, '.git')}`,
      `--work-tree=${path}`,
      'status',
      '--porcelain',
      '--branch',
    ]),
    err => {
      throw new Error(err.stderr)
    },
  ),
  get('stdout'),
  stdout => stdout.split('\n'),
  fork({
    branch: get(0),
    files: slice(1),
  }),
  assign({
    fileNames: ({ files }) => map(lastWord)(files),
  }),
])

/* path string => cratosModule {
 *   path: string,
 *   packageName: string,
 *   packageVersion: string,
 *   gitCurrentBranch: [string],
 *   gitStatusFiles: [string],
 *   gitStatusFileNames: [string],
 * }
 */
const getModuleInfo = pipe([
  fork({
    path: identity,
    packageJSON: getPackageJSON,
    gitStatus: getGitStatus,
  }),
  fork({
    path: get('path'),
    packageName: get('packageJSON.name', 'UNNAMED'),
    packageVersion: get('packageJSON.version', '0.0.0'),
    gitCurrentBranch: pipe([
      get('gitStatus.branch'),
      s => s.slice(3), // ##\ 
    ]),
    gitStatusFiles: get('gitStatus.files'),
    gitStatusFileNames: get('gitStatus.fileNames'),
  }),
])

// flag string => parsedArgv { flags: [string] } => boolean
const hasFlag = flag => ({ flags }) => flags.includes(flag)

// parsedArgv { args: [string] } => boolean
const isBaseCommand = ({ args }) => args.length === 0

// string => parsedArgv { args: [string] } => boolean
const isCommand = cmd => ({ args }) => args[0] === cmd

// replacement string => s string => replaced string
const replaceHomeWith = replacement => s => s.replace(process.env.HOME, replacement)

const command = {
  /*
   * () => command {
   *   type: 'VERSION',
   *   body: {
   *     version: string,
   *   },
   * }
   */
  version: pipe([
    () => ({
      type: 'VERSION',
      body: {
        version: cratosPackageJSON.version,
      },
    }),
    tap(({ body: { version } }) => {
      console.log('v' + version)
    }),
  ]),

  /*
   * () => command {
   *   type: 'USAGE',
   *   body: {},
   * }
   */
  usage: () => {
    console.log(USAGE)
    return {
      type: 'USAGE',
      body: {},
    }
  },

  /*
   * parsedArgv {
   *   args: [string],
   *   flags: [string],
   * } => command {
   *   type: 'LIST',
   *   body: {
   *     modules: [cratosModule {
   *       path: string,
   *       packageName: string,
   *       packageVersion: string,
   *       gitCurrentBranch: [string],
   *       gitStatusFiles: [string],
   *       gitStatusFileNames: [string],
   *     }]
   *   },
   * }
   */
  list: pipe([
    findModulePaths,
    fork({
      type: () => 'LIST',
      body: fork({
        modules: map(pipe([
          getModuleInfo,
          tap(({ packageName, packageVersion }) => {
            console.log(`${packageName}-${packageVersion}`)
          }),
        ])),
      }),
    }),
  ]),

  /*
   * parsedArgv {
   *   args: [string],
   *   flags: [string],
   * } => command {
   *   type: 'STATUS',
   *   body: {
   *     modules: [cratosModule {
   *       path: string,
   *       packageName: string,
   *       packageVersion: string,
   *       gitCurrentBranch: [string],
   *       gitStatusFiles: [string],
   *       gitStatusFileNames: [string],
   *     }]
   *   },
   * }
   */
  status: pipe([
    findModulePaths,
    fork({
      type: () => 'STATUS',
      body: fork({
        modules: map(pipe([
          getModuleInfo,
          tap(({ packageName, gitStatusFiles }) => {
            for (const file of gitStatusFiles) {
              console.log(packageName, file)
            }
          }),
        ])),
      }),
    }),
  ]),
}

/*
 * argv [string] => {
 *   args: [string],
 *   flags: [string],
 *   command: {
 *     type: string,
 *     body: {
 *       version: string,
 *       modules: [cratosModule],
 *     },
 *   },
 * }
 *
 * ['node', 'cratos', '--version'] => {
 *   args: [],
 *   flags: ['--version'],
 *   command: {
 *     type: 'VERSION',
 *     body: {
 *       version: string,
 *     },
 *   },
 * }
 *
 * ['node', 'cratos', 'list'] => {
 *   args: ['list'],
 *   flags: [],
 *   command: {
 *     type: 'LIST',
 *     body: {
 *       modules: [cratosModule],
 *     },
 *   },
 * }
 */
const cratos = pipe([
  parseArgv,
  assign({
    command: switchCase([
      or([
        hasFlag('--version'),
        hasFlag('-v'),
      ]), command.version,
      or([
        hasFlag('--help'),
        hasFlag('-h'),
        isBaseCommand,
      ]), command.usage,
      or([
        isCommand('list'),
        isCommand('ls'),
      ]), command.list,
      or([
        isCommand('status'),
        isCommand('s'),
      ]), command.status,
      x => {
        console.log(`${x.args[0]} is not a cratos command\n${USAGE}`)
        return {
          type: 'INVALID_USAGE',
          body: {},
        }
      },
    ]),
  }),
])

module.exports = cratos
