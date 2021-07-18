import Logger from "./Logger";


export const catchErrors = (cb: () => void, errorMessage?: string) => {
  try {
    cb();
  }
  catch (e) {
    if (errorMessage === undefined) {
      console.log(e);
    }
    else {
      Logger.log(errorMessage);
    }
  }
}