# git-encrypt
A tool that allows you to encrypt files in your git repository.

## Installation
Add an `.npmrc` file to your project where you want to install `git-encrypt`:
```bash
# .npmrc
@stadro:registry=https://npm.pkg.github.com
```

Install locally:
```bash
$ yarn add @stadro/git-encrypt
```

Install globally:
```bash
$ yarn global install @stadro/git-encrypt
```


## Development
Install all the packages of needed to run git-encrypt:
```bash
yarn install
```

For local development you can run:
```bash
yarn dev <args>
```

To install `git-encrypt` globally for development you can run:
```bash 
# Linux
$ yarn i

# Windows
$ yarn i:win
```


## Usage
To initialize `git-encrypt` in a `git` repository run:
```bash
# Install git hooks, generate a key and display it to the user.
# git-encrypt will now automatically encrypt files on git commit.
# git-encrypt will also automatically decrypt files on git pull.
$ git-encrypt init
```

If you already have a key, you can provide that key to the `init` command:
```bash
# Install git hooks and store the provided key
$ git-encrypt init --key <key>
```

Because encrypted files must be ignored, you can add all the files you want to encrypt to your .gitignore file. To make sure `git-encrypt` knows which files to encrypt make sure to surround those files with `#start:enc` and `#end:enc`.
```bash 
# .gitignore
#start:enc
secret.txt
#end:enc
```

To `encrypt` or `decrypt` files manually, you can run:
```bash
$ git-encrypt encrypt --key <key>
$ git-encrypt decrypt --key <key>
```

To `generate` a key manually, you can run:
```bash
# The --store flag makes sure the generated key is stored so you don't have to provide a key to encrypt or decrypt files.
$ git-encrypt generate --store
```

To view or set the current `key`, you can run:
```bash
# You can also set a new key if you provide --key <key>
$ git-encrypt key
```