const mongoose = require("mongoose");
require("dotenv").config();
const url = process.env.MONGODB_URI;

const connectionParams = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

const connectDB = async () => {
  try {
    await mongoose.connect(url, connectionParams);
    console.log("Connected to the database");
  } catch (err) {
    console.error(`Error connecting to the database: ${err}`);
  }
};

module.exports = connectDB;
