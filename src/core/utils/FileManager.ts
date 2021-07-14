import fs from "fs";
import {basename} from "path";


export type File = {
  path: string;
  filename: string;
  isDirectory: boolean;
};



/**
 * FileManager Util
 * @author Ingo Andelhofs
 */
class FileManager {

  private static readonly encoding: string = "utf-8";

  public static readLines(path: string): string[] {
    if (!fs.existsSync(path))
      return [];

    const fileData = fs.readFileSync(path);
    return fileData.toString().split(/\r?\n/);
  }

  public static read(path: string): string {
    return fs.readFileSync(path).toString();
  }

  public static createDirectory(directoryPath: string): void {
    if (FileManager.fileExists(directoryPath))
      return;

    fs.mkdirSync(directoryPath, {recursive: true});
  }

  public static createFile(path: string, data: string): void {
    fs.writeFileSync(path, data, FileManager.encoding);
  }

  public static isDirectory(path: string): boolean {
    if (!fs.existsSync(path))
      return false;

    return fs.lstatSync(path).isDirectory();
  }

  public static getDirectoryFiles(directory: string, recursive: boolean = false): File[] {
    if (!fs.existsSync(directory))
      return [];

    const files = fs.readdirSync(directory);
    const results: File[] = [];

    files.forEach((filename: string) => {
      const path = `${directory}/${filename}`
      const isDirectory = FileManager.isDirectory(path);

      if (isDirectory && recursive) {
        const recursiveFiles = FileManager.getDirectoryFiles(path, recursive);
        results.push(...recursiveFiles);
      }
      else {
        results.push({
          path: path,
          filename: basename(path),
          isDirectory: isDirectory,
        });
      }
    });

    return results;
  }

  public static flattenFiles(paths: string[]): File[] {
    const results: File[] = [];

    paths.forEach((path: string) => {
      const isDirectory = FileManager.isDirectory(path);

      isDirectory ?
        results.push(...FileManager.getDirectoryFiles(path)) :
        results.push({
          path: path,
          filename: basename(path),
          isDirectory: isDirectory,
        })
    });

    return results;
  }

  public static fileExists(path: string): boolean {
    return fs.existsSync(path);
  }

}

export default FileManager;