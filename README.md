# git-vault (UNSTABLE - DEVELOPMENT)
A tool that allows you to encrypt files in your git repository.

## Installation
Install locally:
```bash
$ yarn add @flaze/git-vault
```

Install globally:
```bash
$ yarn global install @flaze/git-vault
```


## Development
Install all the packages of needed to run git-vault:
```bash
yarn install
```

For local development you can run:
```bash
yarn dev <args>
```

To install `git-vault` globally for development you can run:
```bash 
# Linux
$ yarn i

# Windows
$ yarn i:win
```


## Usage
To initialize `git-vault` in a `git` repository run:
```bash
# Install git hooks, generate a key and display it to the user.
# git-vault will now automatically encrypt files on git commit.
# git-vault will also automatically decrypt files on git pull.
$ git-vault init
```

If you already have a key, you can provide that key to the `init` command:
```bash
# Install git hooks and store the provided key
$ git-vault init --key <key>
```

Because encrypted files must be ignored, you can add all the files you want to encrypt to your .gitignore file. To make sure `git-vault` knows which files to encrypt make sure to surround those files with `#start:enc` and `#end:enc`.
```bash 
# .gitignore
#start:enc
secret.txt
#end:enc
```

To `encrypt` or `decrypt` files manually, you can run:
```bash
$ git-vault encrypt --key <key>
$ git-vault decrypt --key <key>
```

To `generate` a key manually, you can run:
```bash
$ git-vault generate
```

To view or set the current `key`, you can run:
```bash
# You can also set a new key if you provide --key <key>
$ git-vault key
```