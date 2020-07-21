'use strict'

const rubico = require('rubico')
const trace = require('rubico/x/trace')
const execa = require('execa')
const USAGE = require('./USAGE')

const {
  pipe, fork, assign,
  tap, tryCatch, switchCase,
  map, filter, reduce, transform, flatMap,
  any, all, and, or, not,
  eq, gt, lt, gte, lte,
  get, pick, omit,
} = rubico

// (from number, to number) => arr [any] => slicedArr [any]
const slice = (from, to) => arr => arr.slice(
  from,
  to,
  // typeof to === 'undefined' ? undefined : to < 0 ? arr.length + to : to,
)

// prefix string => string => boolean
const startsWith = prefix => s => s.startsWith(prefix)

// argv [string] => cleanedArgv [string]
const cleanArgv = slice(2)

/* argv [string] => parsedArgv {
 *   arguments: [string],
 *   flags: [string],
 * }
 */
const parseArgv = pipe([
  cleanArgv,
  fork({
    arguments: filter(not(startsWith('-'))),
    flags: filter(startsWith('-')),
  }),
])

// flag string => parsedArgv { flags: [string] } => boolean
const hasFlag = flag => ({ flags }) => flags.includes(flag)

// parsedArgv { arguments: [string] } => boolean
const isBaseCommand = ({ arguments: args }) => args.length === 0

// string => parsedArgv { arguments: [string] } => boolean
const isCommand = cmd => ({ arguments: args }) => args[0] === cmd

/*
 * argv [string] => {
 *   arguments: [string],
 *   flags: [string],
 *   command: {
 *     type: string,
 *   },
 * }
 *
 * ['node', './cli.js'] => {
 *   arguments: [],
 *   flags: [],
 *   command: {
 *     type: 'USAGE',
 *   },
 * }
 *
 * ['/usr/bin/node', '/usr/bin/cratos', '--help'] => {
 *   arguments: [],
 *   flags: ['--help'],
 *   command: {
 *     type: 'USAGE',
 *   },
 * }
 */
const cratos = pipe([
  parseArgv,
  assign({
    command: switchCase([
      or([
        hasFlag('--help'),
        hasFlag('-h'),
        isBaseCommand,
      ]), () => {
        console.log(USAGE)
        return {
          type: 'USAGE',
        }
      },
      x => {
        console.log(`${x.arguments[0]} is not a cratos command\n${USAGE}`)
        return {
          type: 'INVALID_USAGE',
        }
      },
    ]),
  }),
  trace,
])

module.exports = cratos
