import prompts from "prompts";


/**
 * Logger Util
 * @author Ingo Andelhofs
 */
class Logger {

  public static log(message: string, level: number = 0): void {
    const spaces = " ".repeat(level);
    console.log(`${spaces}> ${message}`);
  }

  public static warn(message: string): void {
    console.log(`> (warning): ${message}`);
  }

  public static async confirm({message, initial = false}: {message: string, initial?: boolean}): Promise<boolean> {
    const result = await prompts({
      type: 'confirm',
      name: 'value',
      message: message,
      initial: initial,
    });

    return result.value;
  }

}

export default Logger;