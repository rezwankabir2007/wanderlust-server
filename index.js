import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

// JWKS external initialization to use caching
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyApi = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Auth Header Received:", authHeader);

    if (!authHeader) {
      return res.status(401).send({ msg: 'Unauthorized: No token provided' });
    }
    
    // Support both "Bearer <token>" and direct token string
    const token = authHeader.startsWith("Bearer ") 
      ? authHeader.split(" ")[1] 
      : authHeader;

    if (!token) {
      return res.status(401).send({ msg: "Unauthorized: Token missing" });
    }

    // টোকেন ভেরিফিকেশন সঠিকভাবে হ্যান্ডেল করা
    const { payload } = await jwtVerify(token, JWKS);

    console.log("Verified Payload:", payload);
    req.user = payload; // রিকোয়েস্টে ইউজার ডাটা যুক্ত করা হলো

    next(); // সবকিছু ঠিক থাকলে পরবর্তী ধাপে যাবে
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    return res.status(401).send({ msg: "Unauthorized: Invalid or expired token" });
  }
};

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db("wanderlust");
const destinationCollection = db.collection("destination");
const bookingCollection = db.collection('bookings');

app.post('/add-destination',async (req, res) => {
  const data = req.body;
  const result = await destinationCollection.insertOne(data);
  console.log(result);
  res.send(result);
});

app.get('/destinations', async (req, res) => {
  const result = await destinationCollection.find().toArray();
  res.send(result);
});

app.get('/destination/:id', verifyApi, async (req, res) => {
  const { id } = req.params;
  const result = await destinationCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.patch('/destination/:id', async (req, res) => {
  const { id } = req.params;
  const UpdateData = req.body;
  const result = await destinationCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: UpdateData }
  );
  res.json(result);
});

app.delete('/destination/:id', async (req, res) => {
  const { id } = req.params;
  const result = await destinationCollection.deleteOne({ _id: new ObjectId(id) });
  res.json(result);
});

app.post('/booking', async (previousReq, res) => {
  const data = previousReq.body;
  const result = await bookingCollection.insertOne(data);
  res.send(result);
});

app.get('/my-bookings/:email', async (req, res) => {
  const { email } = req.params;
  const result = await bookingCollection.find({ email: email }).toArray();
  res.send(result);
});



app.get('/featured-destinations', async (req,res)=>{
  const result = await destinationCollection.find().limit(5).toArray();
  res.send(result)
})


app.delete('/my-bookings/:id', async (req, res) => {
  const { id } = req.params;
  const result = await bookingCollection.deleteOne({
    _id: new ObjectId(id)
  });
  res.send(result);
});

app.get('/', (req, res) => {
  res.send({ massage: "Server is running fine!" });
});

app.listen(port, () => {
  console.log(`Server is running at ${port}`);
});

export default app