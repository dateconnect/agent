import Otp from "../../model/otp.model";
import { User } from "../../model/user.model";
import { hashPassword } from "../../util/hashpassword";

import { generatedOtp } from "../../util/optGenerator";
import Agent from "../agent.class";

export default class AuthAgent {
    agent:any;
    socket:any

    constructor(sockect:any) {
        this.agent = new Agent()
        this.socket = sockect
    }
    // Reusable method to handle error responses
    private async handleError( prompt: string, nextEvent: string) {
        try {
            const errorMessage = await this.agent.generateDynamicQuestion(prompt);
            this.socket.emit("error", {
                content: errorMessage,
                status: false,
                nextevent: nextEvent,
            });
        } catch (error) {
            console.error("Error handling error response:", error);
            this.socket.emit("error", {
                content: "Oops! Something went wrong. Please try again.",
                status: false,
                nextevent: nextEvent,
            });
        }
    }

    public async registerUser() {
        let userDetails = {
            fullname: "",
            email: "",
            password: ""
        };

        const events = {
            register: async () => {
                const introPrompt = `always introduce yourself to the user, this is your introduction "Welcome to DateConnect! I am Blaze, your AI guide, and I will assist you through the registration process" you can restructure the sentence as you like. Let's get started with your full name.`;
                const introMessage = await this.agent.generateDynamicQuestion(introPrompt);
                this.socket.emit("ask", { content: introMessage, status: true, nextevent: "fullname" });
            },

            fullname: async (fullname: string) => {
                if (!fullname) {
                    await this.handleError( "Generate an error message asking the user to provide their name.", "fullname");
                    this.socket.once("fullname", async (data: { fullname: string }) => events.fullname(data?.fullname));
                    return;
                }
                userDetails['fullname'] = fullname;
                const emailPrompt = `Now that we know your name, ask ${fullname} for their email address in a warm and welcoming manner.`;
                const emailQuestion = await this.agent.generateDynamicQuestion(emailPrompt);
                this.socket.emit("ask", {
                    content: emailQuestion,
                    status: true,
                    nextevent: "email"
                });
            },

            email: async (email: string, fullname: string) => {
                if (!fullname) {
                    await this.handleError( "Generate an error message asking the user to provide their name.", "fullname");
                    this.socket.once("fullname", async (data: { fullname: string }) => events.fullname(data?.fullname));
                    return;
                }

                if (!email || !this.isValidEmail(email)) {
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one.", "email");
                    this.socket.once("email", async (data:{email: string}) => events.email(data?.email, userDetails['fullname']));
                    return;
                }

                const userExists = await User.find({ email });
                if (userExists.length > 0) {
                    await this.handleError( "Generate an error message for an email address has been taken, and ask the user to provide another one.", "email");
                    this.socket.once("email", async (data:{email: string}) => events.email(data?.email, userDetails['fullname']));
                    return;
                }

                userDetails['email'] = email;
                const passwordPrompt = `Ask ${fullname} to create a password for their new account. The password should be at least 6 characters long.`;
                const passwordQuestion = await this.agent.generateDynamicQuestion(passwordPrompt);
                this.socket.emit("ask", {
                    content: passwordQuestion,
                    status: true,
                    nextevent: "password"
                });
            },

            password: async (password: string, fullname: string) => {
                if (!fullname) {
                    await this.handleError( "Generate an error message asking the user to provide their name.", "fullname");
                    this.socket.once("password", async (data:{password: string}) => events.password(data?.password, userDetails['fullname']));
                    return;
                }

                if (!userDetails['email'] || !this.isValidEmail(userDetails['email'])) {
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one before creating the password.", "email");
                    this.socket.once("password", async (data:{password: string}) => events.password(data?.password, userDetails['fullname']));
                    return;
                }

                if (!password || password.length < 6) {
                    await this.handleError( "Generate an error message for a weak password (less than 6 characters) and ask the user to provide a stronger password.", "password");
                    this.socket.once("password", async (data:{password: string}) => events.password(data?.password, userDetails['fullname']));
                    return;
                }

                userDetails['password'] = password;
                const hashedPassword = await hashPassword(userDetails['password']);
                const user = new User({
                    fullName: userDetails["fullname"],
                    email: userDetails['email'],
                    password: hashedPassword,
                });

                const savedUser = await user.save();
                const otp = new Otp({
                    userId: savedUser.id,
                    otp: generatedOtp,
                });
                await otp.save();

                if (savedUser) {
                    const successPrompt = `Generate a personalized success message for the new user ${fullname}, confirming their successful registration, also inform them that an OTP has been sent to their email ${userDetails['email']}`;
                    const successMessage = await this.agent.generateDynamicQuestion(successPrompt);
                    delete (user as any).password;
                    this.socket.emit("success", {
                        content: successMessage,
                        status: true,
                        data: user,
                        nextevent: ""
                    });
                } else {
                    await this.handleError( "Generate a generic error message for a failed registration attempt.", "");
                }
            },
            otp: async (otp: string, email: string) => {
                if (!email || !this.isValidEmail(email)) {
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one before confirming otp", "otp");
                    return;
                }

                if (!otp) {
                    await this.handleError( "Generate an error message for an invalid otp, and ask the user to provide a valid one.", "otp");
                    return;
                }

                const user = await User.findOne({ email });
                if (!user?._id) {
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one before confirming otp", "otp");
                    return;
                }

                const otpExist = await Otp.findOne({
                    otp,
                    userId: user?._id,
                    verified: false
                });
                if (!otpExist) {
                    await this.handleError( `Generate an error message for an invalid otp, and ask the user to provide a valid one. Sent to their email ${email}.`, "otp");
                    return;
                }

                await Otp.findOneAndUpdate({ otp, userId: user?._id }, { verified: true });
                await User.findOneAndUpdate({ email }, { isVerified: true });

                const successPrompt = `Generate a personalized success message for the new user ${user?.fullName}, confirming their email ${user?.email} has been verified.`;
                const successMessage = await this.agent.generateDynamicQuestion(successPrompt);
                this.socket.emit("success", {
                    content: successMessage,
                    status: true,
                    data: user,
                    nextevent: ""
                });
            }
        };

        // Initial event listener
        this.socket.setMaxListeners(15);  // Increase the max listeners limit to avoid warning
        this.socket.once("register", events.register);
        this.socket.once("fullname", async (data: { fullname: string }) => events.fullname(data?.fullname));
        this.socket.once("email", async (data:{email: string}) => events.email(data?.email, userDetails['fullname']));
        this.socket.once("password", async (data:{password: string}) => events.password(data?.password, userDetails['fullname']));
        this.socket.once("otp", async (data: { email: string, otp: string }) => events.otp(data?.otp, data?.email));
    }

    public async login(){

    }

    public async onboardUser(){

    }
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        return emailRegex.test(email);
    }

    
}


