import Otp from "../../model/otp.model";
import { User } from "../../model/user.model";
import { hashPassword, PasswordCorrect } from "../../util/hashpassword";
import jwt from "jsonwebtoken";
import { generatedOtp } from "../../util/optGenerator";
import Agent from "../agent.class";
import { response } from "express";

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
            const errorMessage = await this.agent.generateDynamicQuestion(prompt,"error message");
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
        let prompt:string = ""
        const events = {
            register: async () => {
                const introPrompt = `always introduce yourself to the user, this is your introduction "Welcome to DateConnect! I am Blaze, your AI guide, and I will assist you through the registration process" you can restructure the sentence as you like. Let's get started with your full name.`;
                const introMessage = await this.agent.generateDynamicQuestion(introPrompt,"user register");
                prompt= introMessage
                this.socket.emit("ask", { content: introMessage, status: true, nextevent: "fullname" });
            },

            fullname: async (fullname: string) => {
                if (!fullname) {
                    await this.handleError( "Generate an error message asking the user to provide their name.", "fullname");
                    this.socket.once("fullname", async (data: { response: string }) => events.fullname(data?.response));
                    return;
                }
                //validate the fullname
                const isValidName = await this.agent.validateUserResponse(prompt,fullname)
         
                if(!isValidName){
                    await this.handleError( "Generate an error message for an invalid name, and ask the user to provide a valid one.", "fullname");
                    this.socket.once("fullname", async (data: { response: string }) => events.fullname(data?.response));
                    return;
                }
                const extractedAnswer = await this.agent.extractAnswer(prompt,fullname,'string');
                console.log("extractedAnswer",extractedAnswer)
                userDetails['fullname'] = extractedAnswer;
                const emailPrompt = `Now that we know your name, ask ${userDetails['fullname']} for their email address in a warm and welcoming manner.`;
                const emailQuestion = await this.agent.generateDynamicQuestion(emailPrompt,"user register");
                prompt= emailQuestion
                this.socket.emit("ask", {
                    content: emailQuestion,
                    status: true,
                    nextevent: "email"
                });
            },

            email: async (email: string, fullname: string) => {
                if (!fullname) {
                    await this.handleError( "Generate an error message asking the user to provide their name.", "fullname");
                    this.socket.once("fullname", async (data: { response: string }) => events.fullname(data?.response));
                    return;
                }
                if (!email ) {
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one.", "email");
                    this.socket.once("email", async (data:{response: string}) => events.email(data?.response, userDetails['fullname']));
                    return;
                }
                const isValidEmail = await this.agent.validateUserResponse(prompt,email)
                if(!isValidEmail){
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one.", "email");
                    this.socket.once("email", async (data:{response: string}) => events.email(data?.response, userDetails['fullname']));
                    return;
                }
              
                const extractedAnswer = await this.agent.extractAnswer(prompt,email,'string');
                
                if(!this.isValidEmail(extractedAnswer)){
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one.", "email");
                    this.socket.once("email", async (data:{response: string}) => events.email(data?.response, userDetails['fullname']));
                    return;
                }  
                const userExists = await User.find({ email:extractedAnswer });
                if (userExists.length > 0) {
                    await this.handleError( "Generate an error message for an email address has been taken, and ask the user to provide another one.", "email");
                    this.socket.once("email", async (data:{response: string}) => events.email(data?.response, userDetails['fullname']));
                    return;
                }
                userDetails['email'] = extractedAnswer;
                const passwordPrompt = `Ask ${fullname} to create a password for their new account. The password should be at least 6 characters long.`;
                prompt= passwordPrompt
                const passwordQuestion = await this.agent.generateDynamicQuestion(passwordPrompt,"user register");
                this.socket.emit("ask", {
                    content: passwordQuestion,
                    status: true,
                    nextevent: "password"
                });
            },

            password: async (password: string, fullname: string) => {
                if (!fullname) {
                    await this.handleError( "Generate an error message asking the user to provide their name.", "fullname");
                    this.socket.once("password", async (data:{response: string}) => events.password(data?.response, userDetails['fullname']));
                    return;
                }

                if (!userDetails['email'] || !this.isValidEmail(userDetails['email'])) {
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one before creating the password.", "email");
                    this.socket.once("password", async (data:{response: string}) => events.password(data?.response, userDetails['fullname']));
                    return;
                }

                const isValidPassword = await this.agent.validateUserResponse(prompt,password)
                console.log("isValidPassword",isValidPassword,prompt,password)
                if(!isValidPassword){
                    await this.handleError( "Generate an error message for an invalid password, and ask the user to provide a valid one.", "loginPassword");
                    this.socket.once("password", async (data:{response: string}) => events.password(data?.response, userDetails['fullname']));
                    return;  // Return early to avoid unnecessary processing,l.÷;\ 
                }
                const extractAnswer = await this.agent.extractAnswer(prompt,password,"string")
                console.log("isValidPassword",isValidPassword,extractAnswer)

                userDetails['password'] = extractAnswer;
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
                    const successMessage = await this.agent.generateDynamicQuestion(successPrompt,"user register");
                    (user as any).password = null
                    delete (user as any).password;

                    const accessToken = jwt.sign(
                        { user: { data: savedUser } },
                        process.env.JWT_SECRET as string,
                      );
                    this.socket.emit("success", {
                        content: successMessage,
                        status: true,
                        token:accessToken,
                        data: user,
                        nextevent: "otp"
                    });
                } else {
                    await this.handleError( "Generate a generic error message for a failed registration attempt.", "");
                }
            },
            otp: async (otp: string, email: string) => {
                 const otpPrompt = `inform them that an OTP has been sent to their email`
                prompt = await this.agent.generateDynamicQuestion(otpPrompt,"user register");
                if (!email || !this.isValidEmail(email)) {
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one before confirming otp", "otp");
                    return;
                }

                if (!otp) {
                    await this.handleError( "Generate an error message for an invalid otp, and ask the user to provide a valid one.", "otp");
                    return;
                }
                const isValidOtp = await this.agent.validateUserResponse(prompt,otp)
                if(!isValidOtp){
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
        this.socket.once("fullname", async (data: { response: string }) => events.fullname(data?.response));
        this.socket.once("email", async (data:{response: string}) => events.email(data?.response, userDetails['fullname']));
        this.socket.once("password", async (data:{response: string}) => events.password(data?.response, userDetails['fullname']));
        this.socket.once("otp", async (data: { email: string, otp: string }) => events.otp(data?.otp, data?.email));
    }

    public async login(){
        let userDetails = {
            email: "",
            password: ""
        };
        let userExists :any;
        let prompt:string = ""
        const loginEvent = {
            login: async () => {
                const introPrompt = `always introduce yourself to the user, this is your introduction "Welcome to DateConnect! I am Blaze, your AI guide, and I will assist you through the login process" you can restructure the sentence as you like. Enter your email to login.`;
                const introMessage = await this.agent.generateDynamicQuestion(introPrompt,"login");
                prompt = introMessage
                this.socket.emit("ask", { content: introMessage, status: true, nextevent: "loginEmail" });
            },
            email: async (email: string) => {
                console.log("email",email)
             if (!email) {
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one.", "loginEmail");
                    this.socket.once("loginEmail", async (data:{email: string}) => loginEvent.email(data?.email));
                    return;
                }
                const isValidEmail = await this.agent.validateUserResponse(prompt,email)
                console.log("isValidEmail",isValidEmail,prompt,email)
                if(!isValidEmail){
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one.", "loginEmail");
                    this.socket.once("loginEmail", async (data:{email: string}) => loginEvent.email(data?.email));
                    return;
                }
                const extractedAnswer = await this.agent.extractAnswer(prompt,email,'string');
                if(!this.isValidEmail(extractedAnswer)){
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one.", "loginEmail");
                    this.socket.once("loginEmail", async (data:{email: string}) => loginEvent.email(data?.email));
                    return; 
                }
              
                userExists = await User.findOne({ email:extractedAnswer });
                if (!userExists) {
                    await this.handleError( "Generate an error message for an email address is not on our system, and ask the user to provide another one.", "loginEmail");
                    this.socket.once("loginEmail", async (data:{email: string}) => loginEvent.email(data?.email));
                    return;
                }
               
               // userExists?.fullName
                userDetails['email'] = email;
                const passwordPrompt = `Ask ${userExists?.fullName} to enter the password to there account to be able to login. note: this is for a chat based ai agent`;
                const passwordQuestion = await this.agent.generateDynamicQuestion(passwordPrompt,"login");
                prompt = passwordQuestion
    
            },
            password: async (password: string)=>{
                if(!userDetails.email){
                    await this.handleError( "Generate an error message for an invalid email address, and ask the user to provide a valid one.", "loginPassword");
                    this.socket.once("loginPassword", async (data:{email: string}) => loginEvent.password(data?.email));
                    return;
                }
                const isValidPassword = await this.agent.validateUserResponse(prompt,password)
                console.log("isValidPassword",isValidPassword,prompt,password)
                if(!isValidPassword){
                    await this.handleError( "Generate an error message for an invalid password, and ask the user to provide a valid one.", "loginPassword");
                    this.socket.once("loginPassword", async (data:{password: string}) => loginEvent.password(data?.password));
                    return;  // Return early to avoid unnecessary processing,l.÷;\ 
                }
                const extractAnswer = await this.agent.extractAnswer(prompt,password,"string")
                console.log("isValidPassword",isValidPassword,extractAnswer)
                const passwordCorrect = await PasswordCorrect(extractAnswer,userExists)
                console.log("passwordCorrect",passwordCorrect)

            }
        }

        // Initial event listener
        this.socket.setMaxListeners(15);  // Increase the max listeners limit to avoid warning
        this.socket.once("login", loginEvent.login);
        this.socket.once("loginEmail", async (data:{response: string}) => loginEvent.email(data?.response));
        this.socket.once("loginPassword", async (data:{response: string}) => loginEvent.password(data?.response));

    }

    public async onboardUser(){

    }
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        return emailRegex.test(email);
    }

    
}


