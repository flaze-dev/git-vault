# git-encrypt
A tool that allows you to encrypt files in your git repository.

## Setup
To install `git-encrypt` run:
```bash 
yarn i
```

In the .gitignore, add `#start:encrypt` followed by the filenames that need to be encrypted, end by using `#end:encrypt`.
```bash 
#start:encrypt
secret.txt
#end:encrypt
```

To set up git hooks run:
```bash 
git-encrypt install
```

To set up your initial key run:
```bash 
git-encrypt init -g
```

To set up the same key on another repo run:
```bash 
git-encrypt init -k <key>
```