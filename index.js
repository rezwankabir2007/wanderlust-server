import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express();
const port = process.env.PORT || 8000;

// ✅ CORS কনফিগারেশন আপডেট করা হয়েছে (credentials & origins সহ)
const allowedOrigins = [
  'https://wanderlust-fontend.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// JWKS external initialization to use caching
const jwksUrl = process.env.BETTER_AUTH_URL 
  ? `${process.env.BETTER_AUTH_URL}/api/auth/jwks`
  : `${process.env.CLIENT_URL || 'http://localhost:3000'}/api/auth/jwks`;

const JWKS = createRemoteJWKSet(new URL(jwksUrl));

const verifyApi = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Auth Header Received:", authHeader);

    if (!authHeader) {
      return res.status(401).send({ msg: 'Unauthorized: No token provided' });
    }
    
    const token = authHeader.startsWith("Bearer ") 
      ? authHeader.split(" ")[1] 
      : authHeader;

    if (!token) {
      return res.status(401).send({ msg: "Unauthorized: Token missing" });
    }

    const { payload } = await jwtVerify(token, JWKS);
    console.log("Verified Payload:", payload);
    req.user = payload;

    next();
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

app.post('/add-destination', async (req, res) => {
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

app.get('/featured-destinations', async (req, res) => {
  const result = await destinationCollection.find().limit(5).toArray();
  res.send(result);
});

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

export default app;