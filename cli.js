#!/usr/bin/env node

const rubico = require('rubico')
const trace = require('rubico/x/trace')
const cratos = require('.')

const {
  pipe, fork, assign,
  tap, tryCatch, switchCase,
  map, filter, reduce, transform,
  any, all, and, or, not,
  eq, gt, lt, gte, lte,
  get, pick, omit,
} = rubico

// argv [string] => ()
pipe([
  cratos.parseArgv,
  cratos.switchCommand,
])(process.argv)
