const rubico = require('rubico')
const trace = require('rubico/x/trace')
const execa = require('execa')
const nodePath = require('path')

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

const last = arr => get(arr.length - 1)(arr)

const slice = (from, to) => arr => arr.slice(
  from,
  typeof to === 'undefined' ? undefined : to === -1 ? arr.length - 1 : to,
)

const log = (...args) => x => tap(() => console.log(
  ...args.map(arg => typeof arg === 'function' ? arg(x) : arg),
))(x)

const includes = value => arr => arr.includes(value)

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

// () => string
const getPathFromEnv = () => {
  if (process.env.CRATOS_PATH) return process.env.CRATOS_PATH
  if (process.env.HOME) return process.env.HOME
  throw new RangeError('no entrypoint found; $CRATOS_PATH or $HOME environment variables required')
}

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
  /*
  entrypoints: pipe([
    argv => argvHasPathArg(argv) ? last(argv) : getPathFromEnv(),
    path => path.split(':'),
    map(pathResolve),
  ]),
  */
  arguments: pipe([
    filter(and([
      not(startsWith('-')),
      not(isFlag),
    ])),
    slice(2), // node ./cli.js ...
  ]),
  flags: filter(isFlag),
})(argv)

// string => parsedArgv => boolean
const hasFlag = flag => ({ flags }) => flags.includes(flag)

// parsedArgv => boolean
const isBaseCommand = ({ arguments }) => arguments.length === 0

// parsedArgv => ()
const switchCommand = parsedArgv => switchCase([
  or([
    hasFlag('--help'),
    hasFlag('-h'),
    isBaseCommand,
  ]), log(USAGE),
  log(x => `${x.arguments[0]} is not a cratos command\n${USAGE}`),
])(parsedArgv)

module.exports = {
  getUsage: () => USAGE + '\n',
  parseArgv,
  switchCommand,
}
