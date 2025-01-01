import mongoose, { Schema, Document, Model } from "mongoose";

// Define an interface for the Otp document
export interface IOtp extends Document {
  userId: mongoose.Types.ObjectId;
  otp: string;
  expiresAt?: Date;
  verified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const OtpSchema: Schema<IOtp> = new Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: false },
    verified: { type: Boolean, default: false },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

// Set expiresAt to 30 minutes from createdAt
OtpSchema.pre<IOtp>("save", function (next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(this.createdAt!.getTime() + 30 * 60000); // 30 minutes in milliseconds
  }
  next();
});

// Middleware to remove OTPs associated with a user when the user is removed
OtpSchema.pre<IOtp>("deleteMany", async function (this: IOtp, next: any) {
  try {
    await this.model("Otp").deleteMany({ userId: this.userId });
    next();
  } catch (error) {
    next(error);
  }
});

const Otp: Model<IOtp> = mongoose.model<IOtp>("Otp", OtpSchema);
export default Otp;
