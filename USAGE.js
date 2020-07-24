const USAGE = `
description: tooling for JavaScript workspaces

usage: ryt <command> [<args>]
    --version, -v                 print version
    --help, -h                    print usage
    --path=<path>, -p <path>      specify entrypoint path
    --grep=<pattern>              filter for package names that match pattern

commands:

Get info
    list, ls                      list packages
    status, s                     get packages' file status
    branch, b                     get packages' branches
    log, lg                       get packages' commit history
        -<number>, -n <number>    number of commits to display per package
        --max-count=<number>

Manage dependencies
    install, i                    install packages' registered dependencies
    link, ln                      symlink all packages that are dependencies of other packages
    clean                         remove packages' node_modules and ignored package-lock.json
        -f                        remove all ignored and untracked files

Sync branches and remotes
    fetch                         fetch all branches of all remotes
    merge                         merge all branches of all remotes into local branches
    pull                          fetch+merge remote into current branch
    push                          push current branches to remote

Control versions
    checkout, ch <branch>         switch modules to existing branch, noop if non-existing branch
        -b                        switch modules to new branch, keep if existing branch
        -B                        switch modules to new branch, overwrite if existing branch
        --dry-run, -n             noop, showing output
    delete <branch>               deletes branch from packages

Release
    dist <major|minor|patch>      bump version and publish
        --dry-run, -n             noop, showing output
`.trimStart()
//     test <path|module>            run module tests defined by test script or mocha at module root
//     run <script> <path|module>    run module script

module.exports = USAGE
