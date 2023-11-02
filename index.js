const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000;
require('dotenv').config();
// const ObjectId = require("mongodb").ObjectId;

// node -> require('crypto').randomBytes(64).toString('hex')

//middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { JsonWebTokenError } = require('jsonwebtoken');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.meftkqt.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//middlewares
const logger = async( req, res, next) =>{
  console.log('Log Info:', req.method, req.url);
  next();
}

const verifyToken = async(req, res, next) =>{
  const token = req?.cookies?.token;
  console.log("Token from middleware- ", token);
  // for no token
  if(!token){
    return res.status(401).send({message: 'Not authorized'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) =>{
    // error
    if(error){
      console.log(error);
      return res.status(401).send({message: 'Unauthorized'})
    }
    //decoded
    console.log('Value in the token- ', decoded);
    req.user = decoded;
    next();
  })
}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCOllection = client.db('carDoctor').collection('services');
    const bookingCollection = client.db('carDoctor').collection('bookings');

    //auth
    app.post('/jwt', logger, async(req, res)=>{
      const user = req.body;
      // console.log(user);
      // res.send(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
      res
      .cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
      .send({ Success: true });
    })

    app.post('/logout', async(req, res)=>{
      const user = req.body;
      console.log("Log out", user);
      res.clearCookie('token', {maxAge: 0 }).send({ Success: true });
    });


    //service 
    app.get('/services', logger, async(req, res)=>{
        const cursor = serviceCOllection.find();
        const result = await cursor.toArray();
        res.send(result);
    });

    app.get('/services/:id', async(req, res)=>{
      const id = req.params.id;
      const query= { _id: new ObjectId(id)}
      const options = {
        projection: {title:1, price: 1, service_id: 1, img: 1},
      };
      const result = await serviceCOllection.findOne(query, options);
      res.send(result);
    })


    //bookings
    app.post('/bookings', async (req, res) =>{
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get('/bookings', logger, verifyToken, async(req, res) =>{
      console.log(req.query.email);
      //console.log("token- ", req.cookies.token);
      console.log("User from valid token", req.user);
      if(req.user.email !== req.query.email){
        return res.status(403).send({ message: "Forbidden Access"});
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    app.patch('/bookings/:id', async(req, res)=>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateBooking = req.body;
      // console.log(updateBooking);
      const updateDOc = {
        $set: {
          status: updateBooking.status
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDOc);
      res.send(result);
    })

    app.delete('/bookings/:id', async(req, res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
      console.log(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) =>{
    res.send('Car Doctor is running')
});

app.listen(port, () =>{
    console.log(`Car Doctor server is running on port ${port}`)
});