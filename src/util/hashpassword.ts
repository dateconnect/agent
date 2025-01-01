import bcrypt from "bcrypt";

//hash password
export const hashPassword = async (password:string) => {
  if (typeof password === "string") {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  }
  return false;
};

//check if password is correct
export const PasswordCorrect = async (password:string, userExists:{password:string}) => {
  if (userExists?.password && password) {
    const passwordCorrect = await bcrypt.compare(
      password,
      userExists?.password,
    );
    return passwordCorrect;
  } else {
    return false;
  }
};

//send welcome email
//export const welcomeEmail = async(email, firstname)
