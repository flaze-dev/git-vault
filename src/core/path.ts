import { join, basename, resolve, dirname } from "path";
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

  private static getPathsFromIgnoreFile(ignoreFile: FileInfo): string[] {
    const {dir, path} = ignoreFile;
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
        const path = join(dir, line);
       
        // Directory
        if (FileManager.isDirectory(path)) {
          const fileInfos = FileManager.getDirectoryFiles(path, {recursive: true});
          const filePaths = fileInfos.filter((fileInfo: FileInfo) => {
            return fileInfo.isDirectory === false;
          });

          const paths = filePaths.map((fileInfo: FileInfo) => {
            return fileInfo.path;
          });

          rPaths.push(...paths);
          return;
        }

        // File
        if (FileManager.fileExists(path)) {
          rPaths.push(path);
          return;
        }

        // Star
        if (path.endsWith("*")) {         
          const fileInfos = FileManager.getDirectoryFiles(join(dir, dirname(path)), {recursive: false});
          const filePaths = fileInfos.filter((fileInfo: FileInfo) => {
            return fileInfo.isDirectory === false;
          });

          const resolvedPaths = filePaths.filter((fileInfo: FileInfo) => {
            const base = basename(path).slice(0, -1);           
            return fileInfo.filename.startsWith(base);
          });

          const paths = resolvedPaths.map((fileInfo: FileInfo) => {
            return fileInfo.path;
          });

          rPaths.push(...paths);
          return;
        }
      }
      
      isStart && b.start();
    });

    return rPaths;
  }

  public static getPathsToEncrypt(): string[] {
    const ignoredFiles = PathHelper.getIgnoreFiles();
    const pathsToEncrypt = ignoredFiles.flatMap((ignoreFile: FileInfo) => {
      return PathHelper.getPathsFromIgnoreFile(ignoreFile);
    });

    return pathsToEncrypt;
  }


  // Get Paths to Decrypt
  public static getPathsToDecrypt(): string[] {
    return [];
  }

}

export default PathHelper;