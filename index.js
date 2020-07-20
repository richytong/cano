const rubico = require('rubico')
const trace = require('rubico/x/trace')
const execa = require('execa')
const nodePath = require('path')
const fs = require('fs')
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

const identity = x => x

const pathResolve = nodePath.resolve

const isDefined = x => typeof x !== 'undefined' && x !== null

const split = delim => s => s.split(delim)

const join = delim => arr => arr.join(delim)

const last = arr => get(arr.length - 1)(arr)

// string => string
const lastWord = pipe([split(' '), last])

const slice = (from, to) => arr => arr.slice(
  from,
  typeof to === 'undefined' ? undefined : to === -1 ? arr.length - 1 : to,
)

const log = (...args) => x => tap(() => console.log(
  ...args.map(arg => typeof arg === 'function' ? arg(x) : arg),
))(x)

const includes = value => arr => arr.includes(value)

const isEmpty = x => x.length === 0

const cratosVersion = 'v' + cratosPackageJSON.version

const FLAGS = new Set([
  '-h', '--help',
  '-n', '--dry-run',
  '-v', '--version',
  '--path',
])

// string => boolean
const isFlag = s => FLAGS.has(s.split('=')[0])

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

const getEnvVar = name => () => process.env[name]

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
const getPackageJSON = pathArg => pipe([
  path => pathResolve(path, 'package.json'),
  fs.promises.readFile,
  JSON.parse,
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
])(pathArg)

/* path string => cratosModule {
 *   packageName: string,
 *   packageVersion: string,
 *   gitCurrentBranch: [string],
 *   gitStatusFiles: [string],
 * }
 */
const getModuleInfo = pathArg => pipe([
  fork({
    path: identity,
    packageJSON: getPackageJSON,
    gitStatus: getGitStatus,
  }),
  fork({
    path: get('path'),
    packageName: get('packageJSON.name'),
    packageVersion: get('packageJSON.version'),
    gitCurrentBranch: pipe([
      get('gitStatus.branch'),
      s => s.slice(3),
    ]),
    gitStatusFiles: get('gitStatus.files'),
    gitStatusFileNames: get('gitStatus.fileNames'),
  }),
])(pathArg)

const logWithLevel = level => (...args) => console.log(level, ...args)

const logger = {
  warn: logWithLevel('[WARNING]'),
}

// parsedArgv { flags: [string] } => parsedFlags object
const parseFlags = ({ flags }) => transform(map(pipe([
  flag => flag.split('='),
  fork([
    pipe([get(0), s => s.replace(/-/g, '')]),
    get(1, true),
  ]),
])), () => new Map())(flags)

const parsedFlagsHas = key => ({ parsedFlags }) => parsedFlags.has(key)

const parsedFlagsGet = key => ({ parsedFlags }) => parsedFlags.get(key)

// parsedArgv {
//   arguments: [string],
//   flags: [string],
// } => modulePaths [string]
const findModulePaths = parsedArgv => pipe([
  assign({ parsedFlags: parseFlags }),
  switchCase([
    parsedFlagsHas('path'), pipe([
      parsedFlagsGet('path'),
      pathResolve,
    ]),
    hasEnvVar('CRATOS_PATH'), getEnvVar('CRATOS_PATH'),
    hasEnvVar('HOME'), pipe([
      tap(() => {
        logger.warn('CRATOS_PATH not set; finding modules from HOME')
      }),
      getEnvVar('HOME'),
    ]),
    () => {
      throw new Error('no entrypoint found; CRATOS_PATH or HOME environment variables required')
    },
  ]),
  split(':'),
  flatMap(pipe([
    pathResolve,
    walkPathForModuleNames,
  ])),
])(parsedArgv)

// parsedArgv => ()
const commandList = parsedArgv => pipe([
  findModulePaths,
  map(pipe([
    getModuleInfo,
    fork([
      get('packageName'),
      get('packageVersion'),
    ]),
    fields => fields.join('-'),
    trace,
  ])),
])(parsedArgv)

// parsedArgv => ()
const commandStatus = parsedArgv => pipe([
  findModulePaths,
  map(pipe([
    getModuleInfo,
    ({ packageName, gitStatusFiles }) => map(pipe([
      file => [packageName, file].join(' '),
      trace,
    ]))(gitStatusFiles),
  ])),
])(parsedArgv)

// parsedArgv => ()
const commandBranch = parsedArgv => pipe([
  findModulePaths,
  map(pipe([
    getModuleInfo,
    fork([
      get('packageName'),
      get('gitCurrentBranch'),
    ]),
    fields => fields.join(' '),
    trace,
  ])),
])(parsedArgv)

// parsedArgv => ()
const commandStatusBranch = parsedArgv => pipe([
  findModulePaths,
  map(pipe([
    getModuleInfo,
    fork([
      get('packageName'),
      get('gitCurrentBranch'),
      pipe([
        get('gitStatusFileNames'),
        join(','),
      ]),
    ]),
    join(' '),
    trace,
  ])),
])(parsedArgv)

// string => parsedArgv => boolean
const hasFlag = flag => ({ flags }) => flags.includes(flag)

// parsedArgv => boolean
const isBaseCommand = ({ arguments }) => arguments.length === 0

// string => parsedArgv => boolean
const isCommand = cmd => ({ arguments }) => arguments[0] === cmd

// parsedArgv => output string
const switchCommand = parsedArgv => switchCase([
  or([
    hasFlag('--version'),
    hasFlag('-v'),
  ]), pipe([() => cratosVersion, trace]),
  or([
    hasFlag('--help'),
    hasFlag('-h'),
    isBaseCommand,
  ]), pipe([() => USAGE, trace]),
  or([
    isCommand('list'),
    isCommand('ls'),
  ]), commandList,
  or([
    isCommand('status'),
    isCommand('s'),
  ]), commandStatus,
  or([
    isCommand('branch'),
    isCommand('b'),
  ]), commandBranch,
  or([
    isCommand('status-branch'),
    isCommand('sb'),
  ]), commandStatusBranch,
  pipe([
    x => `${x.arguments[0]} is not a cratos command\n${USAGE}`,
    trace,
  ]),
])(parsedArgv)

// argv [string] => ()
const cli = argv => pipe([
  parseArgv,
  switchCommand,
])(argv)

const cratos = {}

cratos.cli = cli
cratos.getUsage = () => USAGE
cratos.parseArgv = parseArgv
cratos.walkPathForModuleNames = walkPathForModuleNames
cratos.getPackageJSON = getPackageJSON
cratos.getGitStatus = getGitStatus
cratos.getModuleInfo = getModuleInfo
cratos.findModulePaths = findModulePaths
cratos.switchCommand = switchCommand

module.exports = cratos
