const USAGE = `
usage: cratos [--version] [-v] [--help] [-h] [--path=<path>] <command> [<args>]

commands:

Get status
    list, ls                      list cratos modules
    status, s                     get file status for cratos modules
    branch, b                     get current branch for cratos modules
    status-branch, sb             get file status and branch for cratos modules
    lg                            get short git log for cratos modules

Manage dependencies
    install, i                    install registered dependencies
    install, i --save, -s <mods>  install and register new dependencies
    link, ln                      symlink dependencies
    clean                         remove vendored dependencies and untracked files

Sync remotes
    fetch                         fetch remotes for cratos modules
    merge                         merge remote into current branch
    pull                          fetch+merge remote into current branch
    push                          push current branches to remote

Switch branches
    ch[eckout] <branch>           switch to existing branch
    ch[eckout] -b <branch>        switch to new branch

Release
    dist <major|minor|patch>      bump version and publish
`.trimStart()
//     test <path|module>            run module tests defined by test script or mocha at module root
//     run <script> <path|module>    run module script

module.exports = USAGE
