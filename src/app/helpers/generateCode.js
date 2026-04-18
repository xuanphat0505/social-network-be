import UserModel from "../models/UserModel.js";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const generateUniqueCode = async () => {
  let code;
  let exists = true;
  do {
    code = Array.from({ length: 8 }, () =>
      CHARS.charAt(Math.floor(Math.random() * CHARS.length)),
    ).join("");
    exists = !!(await UserModel.findOne({ code }));
  } while (exists);
  return code;
};
