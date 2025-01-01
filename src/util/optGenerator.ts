import otpGenerator from "otp-generator";

const otp = () => {
  const otpCode = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
  });
  return otpCode;
};

export const generatedOtp = otp();
