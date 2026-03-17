import express from 'express';
import dotenv from 'dotenv';
import { connectDb } from './config/connection.js';

dotenv.config();
const PORT=process.env.PORT;
const DB_URL=process.env.DB_URL;
const app=express();

app.use(express.json());
await connectDb(DB_URL);
app.get('/',(req,res)=>{
    res.send("working");
})

app.listen(PORT,()=>{
    console.log("server is running on port - ",PORT);
})