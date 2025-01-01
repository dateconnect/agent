import { Schema, model } from "mongoose";

const schema = new Schema(
    { 
        fullName: { type: String, required: false },
        email: { type: String, required: true },
        password: { type: String, required: true },
        isVerified: { type: Boolean, default: false },
      
    },
    { timestamps: true } // Adds createdAt and updatedAt fields
);

export const User = model('User', schema);
