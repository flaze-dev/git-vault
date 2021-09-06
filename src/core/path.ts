import fg from "fast-glob";
import { config } from "../config/config";
import FileManager, { FileInfo } from "./utils/FileManager";


/**
 * Between Helper
 * @author Ingo Andelhofs
 */
class Between {

  private started = false;

  public start(): void {
    this.started = true;
  }

  public end(): void {
    this.started = false;
  }

  public isBetween(): boolean {
    return this.started;
  }
}



/**
 * Path Helper
 * @author Ingo Andelhofs
 */
class PathHelper {

  // Get Paths to Encrypt
  private static isEndComment(line: string): boolean {
    return line.startsWith("#end:enc") ||
      line.startsWith("#stop:enc");
  }

  private static isStartComment(line: string): boolean {
    return line.startsWith("#start:enc") ||
      line.startsWith("#begin:enc")
  }

  private static getIgnoreFiles(): FileInfo[] {
    return FileManager.getAllFilesOfName(".", config.encryption.fileSecrets);
  }

  private static getPlainPathsFromIgnoreFile(ignoreFile: FileInfo): string[] {
    const { path } = ignoreFile;
    const rPaths: string[] = [];
    const b = new Between();

    const lines = FileManager.readLines(path);
    const trimmedLines = lines.map((line: string) => line.trim());

    // For Each Line in the .gitignore file
    trimmedLines.forEach((line: string) => {
      const isComment = line.startsWith("#");
      const isEnd = PathHelper.isEndComment(line);
      const isStart = PathHelper.isStartComment(line);

      isEnd && b.end();

      if (!isComment && b.isBetween() && line !== "") {
        rPaths.push(line);
      }

      isStart && b.start();
    });

    return rPaths;
  }

  private static async getPathsFromIgnoreFile(ignoreFile: FileInfo): Promise<{ dir: string, paths: string[] }> {
    const { dir } = ignoreFile;
    const plainPaths: string[] = this.getPlainPathsFromIgnoreFile(ignoreFile);
    const paths = await fg(plainPaths, {dot: true, cwd: dir});

    return {
      dir: dir,
      paths: paths,
    };
  }

  public static async getPathsToEncrypt(): Promise<{ dir: string, paths: string[] }[]> {
    const ignoredFiles = PathHelper.getIgnoreFiles();

    const pathsToEncrypt: { dir: string, paths: string[] }[] = [];

    for (const ignoredFile of ignoredFiles) {
      const data = await PathHelper.getPathsFromIgnoreFile(ignoredFile);
      pathsToEncrypt.push(data);
    }

    return pathsToEncrypt;
  }


  // Get Paths to Decrypt
  // @todo: Find .encrypted folders at any level 
  public static getPathsToDecrypt(): string[] {
    // const res = FileManager.getAllFilesOfName(".", ".encrypted");
    const fileInfos = FileManager.getDirectoryFiles(".", {recursive: true, ignore: [".git", ".encrypted"]});

    const filtered = fileInfos.filter((fileInfo: FileInfo) => {
      return fileInfo.isDirectory && fileInfo.filename === '.encrypted';
    });

    const paths2: any = [];

    for (const filter of filtered) {
      
      
      const fileInfos2 = FileManager.getDirectoryFiles(filter.path, { recursive: true });
      const paths = fileInfos2.map((fileInfo: FileInfo) => fileInfo.path);
      paths2.push(...paths);
    }

    return paths2;
  }

}

export default PathHelper;