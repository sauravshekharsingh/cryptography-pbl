const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    epic: {
      type: String,
      required: true,
      unique: true,
    },
    validationNumber: {
      type: String,
      default: "",
    },
    name: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    voted: {
      type: Boolean,
      required: true,
      enum: [true, false],
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
