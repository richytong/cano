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

const pathResolve = nodePath.resolve

const isDefined = x => typeof x !== 'undefined' && x !== null

const last = arr => get(arr.length - 1)(arr)

const slice = (from, to) => arr => arr.slice(
  from,
  typeof to === 'undefined' ? undefined : to === -1 ? arr.length - 1 : to,
)

const USAGE = `
usage: cratos [--version] [-v] [--help] [-h] <command> [<args>] [path]

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
const getUsage = () => USAGE

// string => boolean
const isOpt = s => s.startsWith('-')

// argv [string] => boolean
const hasPathArg = and([
  pipe([last, not(isOpt)]),
  pipe([slice(3), gt(get('length'), 0)]),
  pipe([slice(3), gt(get('length'), 0)]),
])

// () => string
const getPathFromEnv = () => {
  if (process.env.CRATOS_PATH) return process.env.CRATOS_PATH
  if (process.env.HOME) return process.env.HOME
  throw new RangeError('no entrypoint found; $CRATOS_PATH or $HOME environment variables required')
}

/* argv [string] => {
 *   entrypoints: [string],
 *   command: string,
 *   arguments: [string],
 * }
 */
const parseArgv = argv => fork({
  entrypoints: pipe([
    argv => hasPathArg(argv) ? last(argv) : getPathFromEnv(),
    path => path.split(':'),
    map(pathResolve),
  ]),
  command: get(2),
  arguments: switchCase([hasPathArg, slice(3, -1), slice(3)]),
})(argv)

module.exports = {
  parseArgv,
}
