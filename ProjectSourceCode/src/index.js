// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.
const { error } = require('console');

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: 'dpg-ct8chg3qf0us73en2tq0-a', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/resources')); 
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// initialize session variables
app.use(
    session({
      secret: process.env.SESSION_SECRET,
      saveUninitialized: false,
      resave: false,
    })
);

app.use((req, res, next) => {
  res.locals.staticData = {
      user:req.session.user,
  };
  next();
});

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

// when navigating to website, redirect to home
app.get('/',(req,res) => {
    res.status(200).redirect('/home');
})

// GET home
app.get('/home',(req,res) => {
  res.status(200).render('pages/home');
})

// redirect to login
app.get('/login',(req,res) => {
  res.status(200).render('pages/login');
})

app.post('/login', async (req, res) => 
{
  console.log("attempting to log in user");
  try
  {
    console.log("finding user in users table");
      // find user from users table for req username
      let find_usr_q = "SELECT * FROM userInfo WHERE username=$1 LIMIT 1;";
      let values = [req.body.username];
      const found_user = await db.one(find_usr_q,values);

      try
      {
        // user exists, attempt to validate password
        console.log("user exists, validating password");
        const pwd_match = await bcrypt.compare(req.body.password, found_user.password);
        if(pwd_match == true)
        {
            //save user details in session
            req.session.user = found_user;
            req.session.username = req.body.username;
            req.session.save((err) => {
                if (err) {
                    console.log('session save error:', err);
                    res.status(500);
                }
                else
                {
                    res.status(200).redirect('/home');
                    console.log("successful login, set session user to",req.session.username);                      
                }
            })
        }
        else 
        {
          throw new Error('password is incorrect')
        }
      }
      catch (err)
      {
        console.log("incorrect password");
        res.status(409).render('pages/login',{message:"Password is incorrect. Please try again."});
      }
      
  }
  catch(err)
  {
      console.log(err);
      res.status(404).render('pages/login',{message:"User does not exist. Please try again."});
  }
});

// GET register
app.get('/register',(req,res) => {
  res.status(200).render('pages/register');
})

// POST register - register user into database
app.post('/register', async (req, res) => {
  console.log("attempting to register user");
  try
  {
    // does the password field match the confirm password field?
    if(req.body.password != req.body.cpassword)
    {
      throw new Error('password field does not match confirm password field');
    }

    try 
    { 
      console.log("determining if username is taken");
      // Is username already taken?
      let get_username_q = "SELECT * FROM userInfo WHERE username=$1 LIMIT 1;";
      let get_username_values = [req.body.username];
      const found_duplicate_username = await db.none(get_username_q, get_username_values);
      console.log("username not taken, inserting into database");

      try 
      {
        console.log("hashing password")
        //hash the password using bcrypt library 
        const hash = await bcrypt.hash(req.body.password, 10);

        console.log("adding to users table")
        // add user to users database table
        let insert_user_q = "INSERT INTO userInfo (first_name, last_name, email, username, password) VALUES ($1,$2,$3,$4,$5);";
        let insert_user_values = [req.body.first_name,req.body.last_name,req.body.email,req.body.username,hash];

        const added_user = await db.none(insert_user_q,insert_user_values);

        console.log("successfully registered")
        res.status(200).render('pages/login',{message:"Successfully registered!"})
      }
      catch
      {
        console.log("unexpected registration error")
        console.log(err);
        res.status(500).render('pages/login',{message:"Registration failed! Please try again."});
      }
    } 
    catch (err) 
    {
      console.log(err);
      console.log("username already exists")
      res.status(409).render('pages/register',{message:"That username already exists!"});
    }
  }
  catch (err)
  {
    console.log("Password field does not match confirm password field: \n password: " + req.body.password + "\nconfirm password: " + req.body.cpassword)
    console.log(err);
    res.status(409).render('pages/login',{message:"password field does not match confirm password field"});
  }
  
});

// Authentication Middleware.
const auth = (req, res, next) => 
{
    if (!req.session.user) {
        // Default to login page.
        console.log("no session user, redirecting to login");
        return res.redirect('login');
    }
    next();
}; 
    
// Authentication Required
app.use(auth);

app.get('/logout', async (req,res) => {
  req.session.destroy();
  res.status(200).render('pages/home',{message:"Logged out successfully"});
})

app.post('/location/add', async (req, res) => {
  const avgHumidity = req.body.avgHumidity;
  const rainfall = req.body.rainfall;
  const avgTemp = req.body.avgTemp;
  const lightAmount = req.body.lightAmount;
  const elevation = req.body.elevation;

  db.task('create-location', task => {
      const insertLocation = 'INSERT INTO location (avgHumidity, rainfall, avgTemp, lightAmount, elevation) VALUES ($1, $2, $3, $4, $5) RETURNING id;';
      const location = task.one(insertLocation, [avgHumidity, rainfall, avgTemp, lightAmount, elevation]);

      const toOtherTable = 'INSERT INTO user_to_location (user_id, location_id) VALUES ($1, $2);';
      return task.none(toOtherTable, [req.session.user.student_id, location]);
  })
  .then(location => {
    res.redirect('/home', {
      message: `Successfully added location ${req.body.location_id}`,
    });
  })
  .catch(function (err){
      console.log(err)
  });
});

app.get('/search',(req,res) => {
  res.render('pages/search',{plants: []});
});

app.get('/searchResults', async (req,res) => {
  
  const plant_name = req.body.plantName;
  const minHeight = req.body.sizeMin;
  const maxHeight = req.body.sizeMax;
  const cycle = req.body.cycle;
  const minHardiness = req.body.minHardiness;
  const maxHardiness = req.body.maxHardiness;
  const sunlight = req.body.sunlight;
  const watering = req.body.watering;
  const flowers = req.body.flowers;
  const edible = req.body.edible;

  console.log("writing plant search query");
        // append the non-null search values to the query - if all values are null or location data does not exist select all plants
        let q_get_plants = "SELECT * FROM plants";
        // if query specifiers is true, add an AND before appending next parameter
        let query_specifiers = false;

        let q_name = "";
        let q_height = "";
        let q_cycle = "";
        let q_hardiness = "";
        let q_watering = "";
        let q_sunlight = "";
        let q_flowers = "";
        let q_edible = "";

        if(plant_name != null)
        {
          q_name = `watering = '${plant_name}'`;
          query_specifiers = true;
        }

        // have both min and max height - search for plants between min and max
        if(minHeight != null && maxHeight != null)
        {
          if (query_specifiers) q_height = ` AND height BETWEEN ${minHeight} AND ${maxHeight}`;
          else{
            q_height = ` height BETWEEN ${minHeight} AND ${maxHeight}`;
            query_specifiers = true;
          }
        }
          // have only min height - search for plants with height greater than min
        else if(minHeight != null){
          if (query_specifiers) q_height = ` AND height >= ${minHeight}`;
          else{
            q_height = ` height >= ${minHeight}`;
            query_specifiers = true;
          }
        }
          // have only max height - search for plants with height less than max
        else if(maxHeight != null){
          if (query_specifiers) q_height = ` AND height <= ${maxHeight}`;
          else{
            q_height = ` height <= ${maxHeight}`;
            query_specifiers = true;
          }
        }

        if(cycle != null)
        {
          if (query_specifiers) q_cycle = `AND watering = '${cycle}'`;
          else{
            q_cycle = `watering = '${cycle}'`;
            query_specifiers = true;
          }
        }

        // have both min and max hardiness - search for plants between min and max
        if(minHardiness != null && maxHeardiness != null)
        {
          if (query_specifiers) q_hardiness = ` AND hardiness BETWEEN ${minHardiness} AND ${maxHardiness}`;
          else{
            q_hardiness = ` hardiness BETWEEN ${minHardiness} AND ${maxHardiness}`;
            query_specifiers = true;            
          }
        }
          // have only min hardiness - search for plants with hardiness greater than min
        else if(minHardiness != null){
          if (query_specifiers) q_hardiness = ` AND hardiness >= ${minHardiness}`;
          else{
            q_hardiness = ` hardiness >= ${minHardiness}`;
            query_specifiers = true;
          }
        }
          // have only max hardiness - search for plants with hardiness less than max
        else if(maxHardiness != null){
          if (query_specifiers) q_hardiness = ` AND hardiness <= ${maxHardiness}`;
          else{
            q_hardiness = ` hardiness <= ${maxHardiness}`;
            query_specifiers = true;
          }
        }

        // search for watering value 'Minimum', 'Average', or 'Frequent'
        if(watering != null)
        {
          if (query_specifiers) q_watering = ` AND watering = '${watering}'`;
          else{
            q_watering = ` watering = '${watering}'`;
            query_specifiers = true;
          }
        }

        // search for sunlight value 'Full Shade', 'Part Shade', or 'Full Sun'
        if(sunlight != null)
        {
          if (query_specifiers) q_sunlight = ` AND sunlight = '${sunlight}'`;
          else{
            q_sunlight = ` sunlight = '${sunlight}'`;
            query_specifiers = true;
          }
          q_sunlight = ` AND sunlight = '${sunlight}'`;
        }

        if (flowers != null)
        {
          if (query_specifiers) q_flowers = ` AND flowers = '${flowers}'`;
          else{
            q_flowers = ` flowers = '${flowers}'`;
            query_specifiers = true;
          }
        }
        
        if (edible != null)
        {
          if (query_specifiers) q_edible = ` AND edible = '${edible}'`;
          else{
            q_edible = ` edible = '${edible}'`;
            query_specifiers = true;
          }
        }

        if(query_specifiers) q_get_plants = q_get_plants + " WHERE" + q_name + q_height + q_cycle + q_hardiness + q_watering + q_sunlight + q_flowers + q_edible;
        q_get_plants = q_get_plants + ";"

        try
        {
          console.log("attempting to retrieve matching plants from database");
          const plant_data = await db.any(q_get_plants);
          //console.log("successfully retrieved plants\n",plant_data);

          let plant_search = [];
          if(plant_data.length > 15)
          // select random plants from selected plants
          {
            
            let max_idx = plant_data.length - 1;
            let idx = 0;
            for(let i = 0; i < 15; i++)
            {
              idx = Math.floor(Math.random() * max_idx);
              let plant = plant_data[idx];
              if(plant_search.includes(plant)) i--;
              else plant_search.push(plant);
            }
          }
          else plant_search = plant_data;

          res.status(200).render('pages/searchResults',{plants:plant_search})
        }
        catch (err)
        {
          console.log(err);
          res.status(500).render('pages/searchResults',{message:"Server failed to retrieve plants from database"});
        }
});

app.get('/plantInformation', async (req,res) => {
  // get plantID from URL query
  const plant_id = req.query.plant_id;
  const plantQuery = 'SELECT * FROM plants WHERE plant_id = $1';

  try{
    // retrieve plant from database and 
    console.log("attempting to retrieve plant from database")
    const plant = await db.one(plantQuery, [plant_id]);
    console.log("successfully retrieved plant ", plant_id, "\n", plant)
    res.status(200).render('pages/plantInformation',{plant: plant});
  }
  catch (error){
    res.status(404).json({ message: 'Plant not found' });
  }

});

app.get('/profile',(req,res) => {
  res.render('pages/settings/profile', { title: 'Profile' });
});

app.get('/setting',(req,res) => {
  res.render('pages/settings/profile', { title: 'Setting' });
});

app.post('/setting', (req, res) => {
  
});

app.delete('/removePlant', async (req,res) => {
  const plant_id = req.query.plant_id;

  try{
    const plantAlreadyIn = 'SELECT * FROM user_to_plants WHERE user_id = $1 AND plant_id = $2;';
    const inGarden = db.oneOrNone(plantAlreadyIn, [req.session.user.user_id, plant_id]);
    if(!inGarden){
      return res.status(400).json({ message: 'Not in your garden' });
    }

    const remove = 'DELETE FROM user_to_plants WHERE user_id = $1 AND plant_id = $2;';
    await db.none(remove, [req.session.user.user_id, plant_id]);
    res.status(200).redirect(`/pages/profile`);
  }
  catch (error){
    res.status(500).json({ message: 'Failed to remove plant' });
  }
});

app.post('/addPlant', async (req,res) => {
  const plant_id = req.body.plant_id;
  console.log("inside addPlant\n",plant_id);

  try
  {
    let q_get_plant = "SELECT * FROM plants WHERE plant_id = $1;";
    const search_plant = await db.one(q_get_plant,[plant_id]);

    const plantAlreadyIn = 'SELECT * FROM user_to_plants WHERE user_id = $1 AND plant_id = $2;';
    // const plantAlreadyIn = 'SELECT * FROM userInfo INNER JOIN user_to_plants ON userInfo.user_id = user_to_plants.user_id INNER JOIN plants ON user_to_plants.plant_id = plants.plant_id WHERE plants.plant_id;';

    const inGarden = await db.oneOrNone(plantAlreadyIn, [req.session.user.user_id, plant_id]);
    if(inGarden){
      return res.status(400).render('pages/plantInformation',{message: 'Already in your garden',plant:search_plant});
    }

    try
    {
      const insert = 'INSERT INTO user_to_plants (user_id, plant_id) VALUES ($1, $2);';
      await db.none(insert, [req.session.user.user_id, plant_id]);
      res.status(200).render('pages/plantInformation',{message: 'Plant added successfully',plant:search_plant});
    }
    catch (err)
    {
      console.log(err);
      res.status(500).render('pages/plantInformation',{message:"insert plant failed",plant:search_plant})
    }
  }
  catch (error){
    console.error('Failed to add plant:', error);
    res.status(500).render('pages/plantInformation',{message: 'Failed to add plant',plant:search_plant});
  }
});

app.get('/reccommendations', async (req,res) => {
  try
  {
    // get user's location data
    console.log("attempting to retrieve user location data for", req.session.username);
    
    let q_get_location_data = `SELECT * FROM userInfo INNER JOIN location ON userInfo.user_id = location.user_id WHERE userInfo.username = $1 LIMIT 1;`;
    let values_get_location_data = [req.session.username];

    const location_data = await db.oneOrNone(q_get_location_data,values_get_location_data);

    try 
    {
      if(location_data)
      {
        console.log("extracting climate data");
        // extract minHardiness, maxHardiness, watering, and sunlight values
        let minHardiness = location_data.minhardiness;
        let maxHardiness = location_data.maxhardiness;
        let watering = location_data.watering;
        let sunlight = location_data.sunlight;

        console.log("writing plant search query");
        // append the non-null search values to the query - if all values are null or location data does not exist select all plants
        let q_get_plants = "SELECT * FROM plants";
        // if query specifiers is true, add an AND before appending next parameter
        let query_specifiers = false;

        let q_hardiness = "";
        let q_watering = "";
        let q_sunlight = "";

        // have both min and max hardiness - search for plants between min and max
        if(minHardiness != null && maxHardiness != null)
        {
          q_hardiness = ` hardiness BETWEEN ${minHardiness} AND ${maxHardiness}`;
        }
        // have only min hardiness - search for plants with hardiness greater than min
        else if(minHardiness != null)
        {
          q_hardiness = ` hardiness >= ${minHardiness}`;
        }
        // have only max hardiness - search for plants with hardiness less than max
        else if(maxHardiness != null)
        {
          q_hardiness = ` hardiness <= ${maxHardiness}`;
        }
        if(q_hardiness != "") query_specifiers = true;

        // search for watering value 'Minimum', 'Average', or 'Frequent'
        if(watering != null)
        {
          q_watering = ` AND watering = '${watering}'`;
        }

        // search for sunlight value 'Full Shade', 'Part Shade', or 'Full Sun'
        if(sunlight)
        {
          q_sunlight = ` AND sunlight = '${sunlight}'`;
        }

        if(query_specifiers) q_get_plants = q_get_plants + " WHERE" + q_hardiness + q_watering + q_sunlight;
        q_get_plants = q_get_plants + ";"

        try
        {
          console.log("attempting to retrieve matching plants from database");
          const plant_data = await db.any(q_get_plants);
          //console.log("successfully retrieved plants\n",plant_data);

          let plant_reccs = [];
          if(plant_data.length > 6)
          // select random plants from selected plants
          {
            
            let max_idx = plant_data.length - 1;
            let idx = 0;
            for(let i = 0; i < 6; i++)
            {
              idx = Math.floor(Math.random() * max_idx);
              let plant = plant_data[idx];
              if(plant_reccs.includes(plant)) i--;
              else plant_reccs.push(plant);
            }
          }
          else plant_reccs = plant_data;

          res.status(200).render('pages/reccommendations',{plants:plant_reccs})
        }
        catch (err)
        {
          console.log(err);
          res.status(500).render('pages/reccommendations',{message:"Server failed to retrieve plants from database"});
        }
      }
      else
      {
        throw new Error("No location data found for user " + res.session.user);
      }
    } 
    catch (err) 
    {
      console.log(err);
      res.status(404).render('pages/reccommendations',{message:"No location data found"});
    }
  }
  catch(err)
  {
    console.log(err); 
    res.status(500).render('pages/reccommendations',{message:"Server failed to retrieve user location data."})
  }
})

app.get('/profile',(req,res) => {
  res.render('pages/settings/profile', { title: 'Profile' });
})

app.get('/p-location',(req,res) => {
  res.render('pages/settings/location', { title: 'Location Settings' });
})

app.get('/account-settings',(req,res) => {
  res.render('pages/settings/accountSettings', { title: 'Account Settings' });
})

app.get('/favorite-plants',(req,res) => {
  res.render('pages/settings/favoritePlants', { title: 'Favorite Plants' });
})

app.get('/delete-account',(req,res) => {
  res.render('pages/settings/deleteAccount', { title: 'Delete Account' });
})

app.get('/my-garden',(req,res) => {
  res.render('pages/settings/plants', { title: 'Current Plants' });
})

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
