

export const config = {
  generateDynamicIvOncePerFile: true,

  bin: "git-vault",
  encryption: {
    fileExtension: ".enc",
    fileSecrets: ".gitignore",
  },
  algo: {
    aes: "aes-256-cbc",
  },
};