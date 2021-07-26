import fs from "fs";
import {basename, dirname} from "path";


export type FileInfo = {
  path: string;
  dir: string;
  filename: string;
  isDirectory: boolean;
};

export type GDFOptions = {
  recursive: boolean;
  ignore: string[];
};

export type GFONOptions = {
  ignore: string[];
};




/**
 * FileManager Util
 * @author Ingo Andelhofs
 */
class FileManager {

  private static readonly ENCODING: BufferEncoding = "utf-8";

  // Primitive
  public static read(path: string): string {
    return fs.readFileSync(path).toString(FileManager.ENCODING);
  }

  public static readLines(path: string): string[] {
    if (!FileManager.fileExists(path))
      return [];

    const fileData = FileManager.read(path);
    return fileData.split(/\r?\n/);
  }

  public static writeLines(path: string, lines: string[]): void {
    fs.writeFileSync(path, lines.join("\n"), FileManager.ENCODING);
  }

  public static createDirectory(directoryPath: string): void {
    if (FileManager.fileExists(directoryPath))
      return;

    fs.mkdirSync(directoryPath, {recursive: true});
  }

  public static createFile(path: string, data: string): void {
    fs.writeFileSync(path, data, FileManager.ENCODING);
  }

  public static isDirectory(path: string): boolean {
    if (!FileManager.fileExists(path))
      return false;

    return fs.lstatSync(path).isDirectory();
  }

  public static fileExists(path: string): boolean {
    return fs.existsSync(path);
  }

  // Advanced
  public static getDirectoryFiles(directory: string, options?: Partial<GDFOptions>): FileInfo[] {
    // Default Options
    const defaultOptions: GDFOptions = {
      recursive: false,
      ignore: [],
    };

    // Merge options
    const foptions = <GDFOptions>{
      ...defaultOptions,
      ...options,
    };


    if (!fs.existsSync(directory))
      return [];

    const files = fs.readdirSync(directory);
    const results: FileInfo[] = [];

    files.forEach((filename: string) => {
      const path = `${directory}/${filename}`;
      const baseFilename = basename(path);
      const isDirectory = FileManager.isDirectory(path);

      if (!foptions.ignore.includes(baseFilename) && isDirectory && foptions.recursive) {
        const recursiveFiles = FileManager.getDirectoryFiles(path, {
          recursive: foptions.recursive,
          ignore: foptions.ignore,
        });

        results.push(...recursiveFiles);
      }
      else {
        results.push({
          path: path,
          filename: baseFilename,
          isDirectory: isDirectory,
          dir: dirname(path),
        });
      }
    });

    return results;
  }

  public static getAllFilesOfName(dir: string, filename: string, options?: Partial<GFONOptions>): FileInfo[] {
    const defaultOptions: GFONOptions = {
      ignore: [],
    };
    
    const foptions = {
      ...defaultOptions,
      ...options,
    };

    const dirsToIgnore = ["node_modules"];

    const fileInfos = FileManager.getDirectoryFiles(dir, {recursive: true, ignore: dirsToIgnore});
    const gitIgnoreFiles = fileInfos.filter((fileInfo: FileInfo) => fileInfo.filename === filename);
    return gitIgnoreFiles;
  }

  public static flattenFiles(paths: string[]): FileInfo[] {
    const results: FileInfo[] = [];

    paths.forEach((path: string) => {
      const isDirectory = FileManager.isDirectory(path);

      isDirectory ?
        results.push(...FileManager.getDirectoryFiles(path)) :
        results.push({
          path: path,
          filename: basename(path),
          isDirectory: isDirectory,
          dir: dirname(path),
        })
    });

    return results;
  }

}

export default FileManager;