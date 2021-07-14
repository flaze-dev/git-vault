

export const catchErrors = (cb: () => void) => {
  try {
    cb();
  }
  catch (e) {
    console.log(e);
  }
}