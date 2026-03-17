import mongoose from "mongoose";

export const connectDb=async(url)=>{
    try{
        await mongoose.connect(url);
        console.log("Db connected");
    }catch(err){
        console.log("DB connection error ,err-",err);
        throw err;
    }
}